import type { RequestHandler } from 'express'

import { env } from '../config/env.js'
import { sendData } from '../shared/http.js'
import { sessionCookieOptions } from './auth.cookies.js'
import { loginSchema } from './auth.schemas.js'
import { AuthService } from './auth.service.js'

export class AuthController {
  constructor(private readonly authService = new AuthService()) {}

  login: RequestHandler = async (request, response) => {
    const input = loginSchema.parse(request.body)
    const result = await this.authService.login(input.email, input.contrasena)

    response.cookie(env.COOKIE_NAME, result.token, sessionCookieOptions(result.cookieMaxAgeMs))

    sendData(response, { user: result.user }, 'Inicio de sesion exitoso')
  }

  me: RequestHandler = (request, response) => {
    sendData(response, { user: request.user }, 'Sesion activa')
  }

  logout: RequestHandler = (_request, response) => {
    response.clearCookie(env.COOKIE_NAME, sessionCookieOptions())
    sendData(response, { ok: true }, 'Sesion cerrada')
  }
}
