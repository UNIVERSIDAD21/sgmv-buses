import { createHmac, timingSafeEqual } from 'node:crypto'

import type { RolCodigo } from '@prisma/client'

import { env } from '../config/env.js'
import { AppError } from '../shared/http.js'
import type { SessionTokenPayload } from './auth.types.js'

interface JwtClaims extends SessionTokenPayload {
  exp: number
  iat: number
}

function encodeJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function decodeJson<T>(value: string): T {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T
}

function sign(unsignedToken: string, secret: string) {
  return createHmac('sha256', secret).update(unsignedToken).digest('base64url')
}

function assertJwtSecret() {
  if (!env.JWT_SECRET) {
    throw new AppError(
      500,
      'AUTH_CONFIGURATION_ERROR',
      'La autenticacion no esta configurada correctamente',
    )
  }

  return env.JWT_SECRET
}

function parseExpiresIn(value: string) {
  const match = /^(\d+)([smhd])$/.exec(value.trim())

  if (!match) {
    throw new AppError(500, 'AUTH_CONFIGURATION_ERROR', 'JWT_EXPIRES_IN no es valido')
  }

  const amount = Number(match[1])
  const unit = match[2] as 's' | 'm' | 'h' | 'd'
  const multiplierByUnit = {
    d: 86_400,
    h: 3_600,
    m: 60,
    s: 1,
  } satisfies Record<typeof unit, number>

  return amount * multiplierByUnit[unit]
}

export function getCookieMaxAgeMs() {
  return parseExpiresIn(env.JWT_EXPIRES_IN) * 1000
}

export function createSessionToken(payload: SessionTokenPayload) {
  const secret = assertJwtSecret()
  const now = Math.floor(Date.now() / 1000)
  const expiresInSeconds = parseExpiresIn(env.JWT_EXPIRES_IN)
  const header = { alg: 'HS256', typ: 'JWT' }
  const claims: JwtClaims = {
    ...payload,
    exp: now + expiresInSeconds,
    iat: now,
  }
  const unsignedToken = `${encodeJson(header)}.${encodeJson(claims)}`
  const signature = sign(unsignedToken, secret)

  return `${unsignedToken}.${signature}`
}

function isRolCodigo(value: unknown): value is RolCodigo {
  return value === 'ADMINISTRADOR' || value === 'MECANICO' || value === 'CONDUCTOR'
}

export function verifySessionToken(token: string): SessionTokenPayload {
  try {
    const secret = assertJwtSecret()
    const [encodedHeader, encodedPayload, encodedSignature] = token.split('.')

    if (!encodedHeader || !encodedPayload || !encodedSignature) {
      throw new AppError(401, 'UNAUTHORIZED', 'Sesion invalida o expirada')
    }

    const unsignedToken = `${encodedHeader}.${encodedPayload}`
    const expectedSignature = Buffer.from(sign(unsignedToken, secret), 'base64url')
    const receivedSignature = Buffer.from(encodedSignature, 'base64url')

    if (
      expectedSignature.length !== receivedSignature.length ||
      !timingSafeEqual(expectedSignature, receivedSignature)
    ) {
      throw new AppError(401, 'UNAUTHORIZED', 'Sesion invalida o expirada')
    }

    const claims = decodeJson<Partial<JwtClaims>>(encodedPayload)
    const now = Math.floor(Date.now() / 1000)

    if (
      !claims.sub ||
      !claims.email ||
      !isRolCodigo(claims.rol) ||
      typeof claims.exp !== 'number' ||
      claims.exp <= now
    ) {
      throw new AppError(401, 'UNAUTHORIZED', 'Sesion invalida o expirada')
    }

    return {
      email: claims.email,
      rol: claims.rol,
      sub: claims.sub,
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error
    }

    throw new AppError(401, 'UNAUTHORIZED', 'Sesion invalida o expirada')
  }
}
