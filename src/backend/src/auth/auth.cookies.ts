import type { CookieOptions } from 'express'

import { env } from '../config/env.js'

export function sessionCookieOptions(maxAge?: number): CookieOptions {
  return {
    httpOnly: true,
    maxAge,
    path: '/',
    sameSite: env.COOKIE_SAMESITE,
    secure: env.COOKIE_SECURE,
  }
}
