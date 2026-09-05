import { createHmac } from 'node:crypto'

import { env } from '../config/env.js'
import { AppError } from '../shared/http.js'
import { RateLimitRepository } from './rate-limit.repository.js'

interface ConsumeLoginAttemptInput {
  identity: string
  ip: string
}

interface CounterDefinition {
  ambito: string
  identifier: string
  maxAttempts: number
}

function getSecret() {
  const secret = env.RATE_LIMIT_SECRET ?? env.CSRF_SECRET ?? env.JWT_SECRET

  if (!secret) {
    throw new AppError(
      500,
      'AUTH_CONFIGURATION_ERROR',
      'La autenticacion no esta configurada correctamente',
    )
  }

  return secret
}

function hashIdentifier(scope: string, identifier: string) {
  return createHmac('sha256', getSecret()).update(`${scope}:${identifier}`).digest('hex')
}

export class RateLimitService {
  constructor(private readonly repository = new RateLimitRepository()) {}

  async consumeLoginAttempt(input: ConsumeLoginAttemptInput, now = Date.now()) {
    const windowStartMs =
      Math.floor(now / env.LOGIN_RATE_LIMIT_WINDOW_MS) * env.LOGIN_RATE_LIMIT_WINDOW_MS
    const ventanaInicio = new Date(windowStartMs)
    const expiraAt = new Date(windowStartMs + env.LOGIN_RATE_LIMIT_WINDOW_MS)
    const counters: CounterDefinition[] = [
      {
        ambito: 'LOGIN_IP',
        identifier: input.ip,
        maxAttempts: env.LOGIN_IP_RATE_LIMIT_MAX_ATTEMPTS,
      },
      {
        ambito: 'LOGIN_IDENTIDAD',
        identifier: input.identity,
        maxAttempts: env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
      },
    ]

    const results = await this.repository.transaction(async (database) => {
      const increments = []

      for (const counter of counters) {
        const row = await this.repository.increment(database, {
          ambito: counter.ambito,
          claveHash: hashIdentifier(counter.ambito, counter.identifier),
          expiraAt,
          ventanaInicio,
        })

        increments.push({ ...counter, ...row })
      }

      return increments
    })

    const exceeded = results.find((result) => result.contador > result.maxAttempts)

    if (exceeded) {
      const retryAfterSeconds = Math.max(1, Math.ceil((exceeded.expiraAt.getTime() - now) / 1000))

      throw new AppError(
        429,
        'RATE_LIMITED',
        'Demasiados intentos de inicio de sesion. Intente mas tarde.',
        { retryAfterSeconds },
      )
    }
  }

  resetSuccessfulIdentity(identity: string) {
    return this.repository.deleteCounter(
      'LOGIN_IDENTIDAD',
      hashIdentifier('LOGIN_IDENTIDAD', identity.trim().toLowerCase()),
    )
  }
}
