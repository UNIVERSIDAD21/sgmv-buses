import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

import { env } from '../config/env.js'
import { AppError } from '../shared/http.js'

const TOKEN_VERSION = 'v1'

function csrfConfigurationError() {
  return new AppError(
    500,
    'AUTH_CONFIGURATION_ERROR',
    'La autenticacion no esta configurada correctamente',
  )
}

function getSecret() {
  if (!env.CSRF_SECRET) {
    throw csrfConfigurationError()
  }

  return env.CSRF_SECRET
}

function sign(payload: string) {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url')
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

export function createCsrfToken(now = Date.now()) {
  const issuedAt = Math.floor(now / 1000)
  const nonce = randomBytes(32).toString('base64url')
  const payload = `${TOKEN_VERSION}.${issuedAt}.${nonce}`

  return `${payload}.${sign(payload)}`
}

export function verifyCsrfToken(token: string, now = Date.now()) {
  const [version, issuedAtInput, nonce, signature, ...extra] = token.split('.')

  if (
    version !== TOKEN_VERSION ||
    !issuedAtInput ||
    !nonce ||
    !signature ||
    extra.length > 0 ||
    !/^\d+$/.test(issuedAtInput) ||
    !/^[A-Za-z0-9_-]{43}$/.test(nonce)
  ) {
    return false
  }

  const issuedAtMs = Number(issuedAtInput) * 1000

  if (
    !Number.isSafeInteger(issuedAtMs) ||
    issuedAtMs > now + 30_000 ||
    now - issuedAtMs > env.CSRF_TOKEN_TTL_MS
  ) {
    return false
  }

  const payload = `${version}.${issuedAtInput}.${nonce}`

  return safeEqual(signature, sign(payload))
}

export function csrfTokensMatch(cookieToken: string, headerToken: string) {
  return safeEqual(cookieToken, headerToken)
}
