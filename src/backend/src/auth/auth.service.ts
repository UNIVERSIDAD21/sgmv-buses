import { compare } from 'bcryptjs'

import { env } from '../config/env.js'
import { AppError } from '../shared/http.js'
import { type AuthUserRecord, AuthRepository } from './auth.repository.js'
import type { AuthenticatedUser, LoginResult } from './auth.types.js'
import { createSessionToken, getCookieMaxAgeMs } from './token.service.js'

interface AnonymousAttempt {
  count: number
  resetAt: number
}

const anonymousAttempts = new Map<string, AnonymousAttempt>()

function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

function sanitizeUser(user: NonNullable<AuthUserRecord>): AuthenticatedUser {
  return {
    email: user.email,
    estado: user.estado,
    id: user.id,
    nombre: user.nombre,
    rol: {
      codigo: user.rol.codigo,
      nombre: user.rol.nombre,
    },
  }
}

function invalidCredentialsError() {
  return new AppError(401, 'UNAUTHORIZED', 'Credenciales invalidas')
}

function anonymousKey(email: string) {
  return `anonymous:${email}`
}

function checkAnonymousLimit(email: string) {
  const key = anonymousKey(email)
  const now = Date.now()
  const current = anonymousAttempts.get(key)

  if (!current || current.resetAt <= now) {
    anonymousAttempts.set(key, {
      count: 0,
      resetAt: now + env.LOGIN_RATE_LIMIT_WINDOW_MS,
    })
    return
  }

  if (current.count >= env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS) {
    throw new AppError(
      429,
      'RATE_LIMITED',
      'Demasiados intentos de inicio de sesion. Intente mas tarde.',
    )
  }
}

function recordAnonymousFailure(email: string) {
  const key = anonymousKey(email)
  const now = Date.now()
  const current = anonymousAttempts.get(key)

  if (!current || current.resetAt <= now) {
    anonymousAttempts.set(key, {
      count: 1,
      resetAt: now + env.LOGIN_RATE_LIMIT_WINDOW_MS,
    })
    return
  }

  current.count += 1
  anonymousAttempts.set(key, current)
}

export class AuthService {
  constructor(private readonly authRepository = new AuthRepository()) {}

  async login(emailInput: string, contrasena: string): Promise<LoginResult> {
    const email = normalizeEmail(emailInput)
    checkAnonymousLimit(email)

    const user = await this.authRepository.findByEmailForAuth(email)

    if (!user) {
      recordAnonymousFailure(email)
      throw invalidCredentialsError()
    }

    if (user.bloqueadoHasta && user.bloqueadoHasta.getTime() > Date.now()) {
      throw new AppError(
        429,
        'RATE_LIMITED',
        'Demasiados intentos de inicio de sesion. Intente mas tarde.',
      )
    }

    if (user.estado !== 'ACTIVO') {
      throw new AppError(403, 'FORBIDDEN', 'La cuenta esta inactiva')
    }

    const passwordMatches = await compare(contrasena, user.contrasenaHash)

    if (!passwordMatches) {
      const failedAttempts = user.intentosFallidosLogin + 1
      const blockedUntil =
        failedAttempts >= env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS
          ? new Date(Date.now() + env.LOGIN_RATE_LIMIT_WINDOW_MS)
          : null

      await this.authRepository.registerFailedLogin(user.id, failedAttempts, blockedUntil)
      throw invalidCredentialsError()
    }

    await this.authRepository.registerSuccessfulLogin(user.id)

    const publicUser = sanitizeUser(user)
    const token = createSessionToken({
      email: publicUser.email,
      rol: publicUser.rol.codigo,
      sub: publicUser.id,
    })

    return {
      cookieMaxAgeMs: getCookieMaxAgeMs(),
      token,
      user: publicUser,
    }
  }

  async getSessionUser(userId: string) {
    const user = await this.authRepository.findByIdForSession(userId)

    if (!user || user.estado !== 'ACTIVO') {
      throw new AppError(401, 'UNAUTHORIZED', 'Sesion invalida o expirada')
    }

    return sanitizeUser(user)
  }
}
