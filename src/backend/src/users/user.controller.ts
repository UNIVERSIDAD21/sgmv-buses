import type { RequestHandler } from 'express'

import { sendData } from '../shared/http.js'
import {
  changeUserRoleSchema,
  changeUserStateSchema,
  createUserSchema,
  listUsersQuerySchema,
  updateUserSchema,
  userIdParamSchema,
} from './user.schemas.js'
import { UserService } from './user.service.js'

export class UserController {
  constructor(private readonly service = new UserService()) {}

  list: RequestHandler = async (request, response) => {
    const result = await this.service.list(listUsersQuerySchema.parse(request.query), request.user!)
    sendData(response, result, 'Usuarios consultados')
  }

  get: RequestHandler = async (request, response) => {
    const { usuarioId } = userIdParamSchema.parse(request.params)
    sendData(response, await this.service.get(usuarioId, request.user!), 'Detalle de usuario')
  }

  create: RequestHandler = async (request, response) => {
    const result = await this.service.create(createUserSchema.parse(request.body), request.user!)
    response.status(201)
    sendData(response, result, 'Usuario creado; activacion pendiente')
  }

  update: RequestHandler = async (request, response) => {
    const { usuarioId } = userIdParamSchema.parse(request.params)
    const result = await this.service.update(
      usuarioId,
      updateUserSchema.parse(request.body),
      request.user!,
    )
    sendData(response, result, 'Usuario actualizado')
  }

  changeRole: RequestHandler = async (request, response) => {
    const { usuarioId } = userIdParamSchema.parse(request.params)
    const result = await this.service.changeRole(
      usuarioId,
      changeUserRoleSchema.parse(request.body),
      request.user!,
    )
    sendData(response, result, 'Rol actualizado')
  }

  changeState: RequestHandler = async (request, response) => {
    const { usuarioId } = userIdParamSchema.parse(request.params)
    const result = await this.service.changeState(
      usuarioId,
      changeUserStateSchema.parse(request.body),
      request.user!,
    )
    sendData(response, result, 'Estado de cuenta actualizado')
  }

  reissueActivation: RequestHandler = async (request, response) => {
    const { usuarioId } = userIdParamSchema.parse(request.params)
    const result = await this.service.reissueActivation(usuarioId, request.user!)
    sendData(response, result, 'Codigo de activacion renovado')
  }
}
