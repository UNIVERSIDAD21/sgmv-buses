import { randomUUID } from 'node:crypto'

import type { RolCodigo } from '@prisma/client'
import { jwtVerify, SignJWT } from 'jose'
import { z } from 'zod'

import { env } from '../config/env.js'
import { AppError } from '../shared/http.js'
import type { SessionTokenPayload } from './auth.types.js'

const sessionClaimsSchema = z.object({
  email: z.email(),
  rol: z.enum(['ADMINISTRADOR', 'DESPACHADOR', 'MECANICO', 'CONDUCTOR']),
  sub: z.uuid(),
})

function getJwtSecret() {
  if (!env.JWT_SECRET) {
    throw new AppError(
      500,
      'AUTH_CONFIGURATION_ERROR',
      'La autenticacion no esta configurada correctamente',
    )
  }

  return new TextEncoder().encode(env.JWT_SECRET)
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

  const seconds = amount * multiplierByUnit[unit]

  if (seconds < 60 || seconds > 86_400) {
    throw new AppError(
      500,
      'AUTH_CONFIGURATION_ERROR',
      'JWT_EXPIRES_IN debe estar entre 1 minuto y 24 horas',
    )
  }

  return seconds
}

export function getCookieMaxAgeMs() {
  return parseExpiresIn(env.JWT_EXPIRES_IN) * 1000
}

export async function createSessionToken(payload: SessionTokenPayload) {
  const expiresInSeconds = parseExpiresIn(env.JWT_EXPIRES_IN)

  return new SignJWT({ email: payload.email, rol: payload.rol })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(payload.sub)
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setIssuedAt()
    .setNotBefore(0)
    .setExpirationTime(`${expiresInSeconds}s`)
    .setJti(randomUUID())
    .sign(getJwtSecret())
}

export async function verifySessionToken(token: string): Promise<SessionTokenPayload> {
  try {
    const { payload, protectedHeader } = await jwtVerify(token, getJwtSecret(), {
      algorithms: ['HS256'],
      audience: env.JWT_AUDIENCE,
      clockTolerance: 5,
      issuer: env.JWT_ISSUER,
      maxTokenAge: env.JWT_EXPIRES_IN,
      requiredClaims: ['sub', 'iat', 'nbf', 'exp', 'iss', 'aud', 'jti'],
    })

    if (protectedHeader.alg !== 'HS256' || protectedHeader.typ !== 'JWT') {
      throw new AppError(401, 'UNAUTHORIZED', 'Sesion invalida o expirada')
    }

    const claims = sessionClaimsSchema.safeParse(payload)

    if (!claims.success) {
      throw new AppError(401, 'UNAUTHORIZED', 'Sesion invalida o expirada')
    }

    return {
      email: claims.data.email,
      rol: claims.data.rol as RolCodigo,
      sub: claims.data.sub,
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error
    }

    throw new AppError(401, 'UNAUTHORIZED', 'Sesion invalida o expirada')
  }
}
