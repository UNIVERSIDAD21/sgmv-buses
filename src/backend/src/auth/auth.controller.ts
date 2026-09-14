import type { RequestHandler } from 'express'

import { env } from '../config/env.js'
import { sendData } from '../shared/http.js'
import { csrfCookieOptions, sessionCookieOptions } from './auth.cookies.js'
import { loginSchema } from './auth.schemas.js'
import { AuthService } from './auth.service.js'
import { createCsrfToken } from './csrf.service.js'
import { activateAccountSchema, changeOwnPasswordSchema } from '../users/user.schemas.js'
import { UserService } from '../users/user.service.js'

export class AuthController {
  constructor(
    private readonly authService = new AuthService(),
    private readonly userService = new UserService(),
  ) {}

  activate: RequestHandler = async (request, response) => {
    const input = activateAccountSchema.parse(request.body)
    const user = await this.userService.activate(input.token, input.contrasena)

    request.user = {
      email: user.email,
      estado: user.estado,
      id: user.id,
      nombre: user.nombre,
      rol: { codigo: user.rol.codigo, nombre: user.rol.nombre },
    }
    sendData(response, { user }, 'Cuenta activada; ya puede iniciar sesion')
  }

  changeOwnPassword: RequestHandler = async (request, response) => {
    const input = changeOwnPasswordSchema.parse(request.body)
    const result = await this.userService.changeOwnPassword(
      request.user!,
      input.contrasenaActual,
      input.contrasenaNueva,
    )
    sendData(response, result, 'Contrasena actualizada')
  }

  csrf: RequestHandler = (_request, response) => {
    const csrfToken = createCsrfToken()

    response.cookie(env.CSRF_COOKIE_NAME, csrfToken, csrfCookieOptions())
    sendData(response, { csrfToken }, 'Token CSRF emitido')
  }

  login: RequestHandler = async (request, response) => {
    const input = loginSchema.parse(request.body)
    const result = await this.authService.login(input.email, input.contrasena)

    request.user = result.user
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
