import { createHash } from 'node:crypto'

import { Prisma } from '@prisma/client'
import type { Request } from 'express'

import { env } from '../config/env.js'
import { AppError } from '../shared/http.js'
import {
  IdempotencyRepository,
  type IdempotencyReservation,
  type IdempotencyScope,
} from './idempotency.repository.js'

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SENSITIVE_RESPONSE_KEY =
  /^(authorization|cookie|set-cookie|contrasena|contrasenahash|password|secret|token)$/i
const LEGACY_BODY_KEY_ROUTES = new Set([
  '/ordenes-trabajo/:ordenId/consumos',
  '/repuestos',
  '/repuestos/:repuestoId/ajustes',
  '/repuestos/:repuestoId/entradas',
])

interface SafeResponse {
  body: Prisma.InputJsonValue
  recursoId?: string
  recursoTipo?: string
}

export interface PreparedIdempotency {
  reservation: IdempotencyReservation
  scope: IdempotencyScope
}

export type IdempotencyPreparation =
  | { kind: 'EXECUTE'; prepared: PreparedIdempotency }
  | { body: Prisma.JsonValue; kind: 'REPLAY'; statusCode: number }

function normalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeForHash)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, nested]) => nested !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, normalizeForHash(nested)]),
    )
  }

  return value
}

function routeTemplate(request: Request) {
  const routePath = request.route?.path as unknown

  if (typeof routePath !== 'string') {
    throw new Error('La ruta idempotente no tiene una plantilla HTTP resoluble')
  }

  const combined = `${request.baseUrl}${routePath === '/' ? '' : routePath}`

  return combined || '/'
}

function legacyBodyKey(request: Request) {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
    return undefined
  }

  const value = (request.body as Record<string, unknown>).claveIdempotencia

  return typeof value === 'string' ? value : undefined
}

export function hashIdempotentPayload(input: { body: unknown; params: unknown; query: unknown }) {
  const body =
    input.body && typeof input.body === 'object' && !Array.isArray(input.body)
      ? Object.fromEntries(
          Object.entries(input.body as Record<string, unknown>).filter(
            ([key]) => key !== 'claveIdempotencia',
          ),
        )
      : input.body
  const canonical = JSON.stringify(
    normalizeForHash({
      body: body ?? null,
      params: input.params,
      query: input.query,
    }),
  )

  return createHash('sha256').update(canonical).digest('hex')
}

export function hashIdempotentRequest(request: Request) {
  return hashIdempotentPayload({
    body: request.body,
    params: request.params,
    query: request.query,
  })
}

function assertNoSensitiveResponseFields(value: unknown, path = 'response'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveResponseFields(item, `${path}[${index}]`))
    return
  }

  if (!value || typeof value !== 'object') {
    return
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_RESPONSE_KEY.test(key)) {
      throw new Error(`La respuesta idempotente contiene un campo sensible en ${path}.${key}`)
    }

    assertNoSensitiveResponseFields(nested, `${path}.${key}`)
  }
}

function findResourceId(value: unknown): string | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const object = value as Record<string, unknown>

  if (typeof object.id === 'string') {
    return object.id.slice(0, 120)
  }

  if (object.data) {
    return findResourceId(object.data)
  }

  for (const nested of Object.values(object)) {
    const id = findResourceId(nested)

    if (id) {
      return id
    }
  }

  return undefined
}

export class IdempotencyService {
  constructor(private readonly repository = new IdempotencyRepository()) {}

  async prepare(request: Request): Promise<IdempotencyPreparation> {
    if (!request.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Sesion requerida')
    }

    const headerKey = request.get('idempotency-key')
    const legacyKey = legacyBodyKey(request)
    const key = headerKey ?? legacyKey

    if (!key) {
      throw new AppError(
        400,
        'IDEMPOTENCY_KEY_REQUIRED',
        'Idempotency-Key es obligatorio para esta operacion',
      )
    }

    if (!UUID_V4_PATTERN.test(key)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Idempotency-Key debe ser un UUID v4')
    }

    if (headerKey && legacyKey && headerKey.toLowerCase() !== legacyKey.toLowerCase()) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'Idempotency-Key no coincide con claveIdempotencia del cuerpo',
      )
    }

    const template = routeTemplate(request)

    if (
      headerKey &&
      !legacyKey &&
      LEGACY_BODY_KEY_ROUTES.has(template) &&
      request.body &&
      typeof request.body === 'object' &&
      !Array.isArray(request.body)
    ) {
      request.body = {
        ...(request.body as Record<string, unknown>),
        claveIdempotencia: key,
      }
    }

    const scope: IdempotencyScope = {
      actorId: request.user.id,
      clave: key.toLowerCase(),
      hashSolicitud: hashIdempotentRequest(request),
      metodo: request.method,
      operacion: `${request.method} ${template}`,
      requestId: request.id,
      rutaPlantilla: template,
    }
    const decision = await this.repository.reserve(scope, env.IDEMPOTENCY_IN_PROGRESS_TTL_MS)

    if (decision.kind === 'REUSED') {
      throw new AppError(
        409,
        'IDEMPOTENCY_KEY_REUSED',
        'La clave de idempotencia ya fue usada con otro contenido',
      )
    }

    if (decision.kind === 'IN_PROGRESS') {
      throw new AppError(
        409,
        'IDEMPOTENCY_REQUEST_IN_PROGRESS',
        'La solicitud original continua en proceso',
        { retryAfterSeconds: 1 },
      )
    }

    if (decision.kind === 'REPLAY') {
      return {
        body: decision.response,
        kind: 'REPLAY',
        statusCode: decision.statusCode,
      }
    }

    return {
      kind: 'EXECUTE',
      prepared: {
        reservation: decision.reservation,
        scope,
      },
    }
  }

  serializeResponse(body: unknown, request: Request): SafeResponse {
    assertNoSensitiveResponseFields(body)

    const serialized = JSON.stringify(body)

    if (Buffer.byteLength(serialized, 'utf8') > env.IDEMPOTENCY_RESPONSE_MAX_BYTES) {
      throw new Error('La respuesta idempotente supera el limite seguro de almacenamiento')
    }

    const safeBody = JSON.parse(serialized) as Prisma.InputJsonValue

    return {
      body: safeBody,
      recursoId: findResourceId(safeBody),
      recursoTipo: request.baseUrl.split('/').filter(Boolean)[0]?.slice(0, 100),
    }
  }

  async complete(prepared: PreparedIdempotency, statusCode: number, response: SafeResponse) {
    const completed = await this.repository.complete({
      recursoId: response.recursoId,
      recursoTipo: response.recursoTipo,
      reservation: prepared.reservation,
      response: response.body,
      statusCode,
    })

    if (completed.count !== 1) {
      throw new Error('La reserva idempotente perdio su vigencia antes de completarse')
    }
  }
}
