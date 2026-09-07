import type { RequestHandler } from 'express'

import { sendData } from '../shared/http.js'
import { compatibilityIdParamSchema, createCompatibilitySchema } from './compatibility.schemas.js'
import { CompatibilityService } from './compatibility.service.js'

export class CompatibilityController {
  constructor(private readonly service = new CompatibilityService()) {}

  create: RequestHandler = async (request, response) => {
    const { repuestoId } = compatibilityIdParamSchema
      .omit({ compatibilidadId: true })
      .parse(request.params)
    const result = await this.service.create(
      repuestoId,
      createCompatibilitySchema.parse(request.body),
      request.user!,
    )
    response.status(201)
    sendData(response, result, 'Compatibilidad creada')
  }

  deactivate: RequestHandler = async (request, response) => {
    const params = compatibilityIdParamSchema.parse(request.params)
    const result = await this.service.deactivate(
      params.repuestoId,
      params.compatibilidadId,
      request.user!,
    )
    sendData(response, result, 'Compatibilidad inactivada')
  }

  list: RequestHandler = async (request, response) => {
    const { repuestoId } = compatibilityIdParamSchema
      .omit({ compatibilidadId: true })
      .parse(request.params)
    sendData(
      response,
      await this.service.list(repuestoId, request.user!),
      'Compatibilidades consultadas',
    )
  }
}
