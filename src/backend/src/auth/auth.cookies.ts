import type { CookieOptions } from 'express'

import { env } from '../config/env.js'

export function sessionCookieOptions(maxAge?: number): CookieOptions {
  return {
    httpOnly: true,
    maxAge,
    path: '/',
    priority: 'high',
    sameSite: env.COOKIE_SAMESITE,
    secure: env.COOKIE_SECURE,
  }
}

export function csrfCookieOptions(maxAge = env.CSRF_TOKEN_TTL_MS): CookieOptions {
  return {
    httpOnly: true,
    maxAge,
    path: '/',
    priority: 'high',
    sameSite: env.COOKIE_SAMESITE,
    secure: env.COOKIE_SECURE,
  }
}
