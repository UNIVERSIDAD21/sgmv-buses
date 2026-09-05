import type { RequestHandler } from 'express'

import { sendData } from '../shared/http.js'
import {
  catalogListQuerySchema,
  createModeloBusSchema,
  createRutaSchema,
  modeloBusIdParamSchema,
  rutaIdParamSchema,
  updateModeloBusSchema,
  updateRutaSchema,
} from './fleet-catalog.schemas.js'
import { FleetCatalogService } from './fleet-catalog.service.js'

export class FleetCatalogController {
  constructor(private readonly service = new FleetCatalogService()) {}

  activateModeloBus: RequestHandler = async (request, response) => {
    const { modeloBusId } = modeloBusIdParamSchema.parse(request.params)
    const result = await this.service.setModeloBusActive(modeloBusId, true, request.user!)
    sendData(response, result, 'Modelo de bus activado')
  }

  activateRuta: RequestHandler = async (request, response) => {
    const { rutaId } = rutaIdParamSchema.parse(request.params)
    const result = await this.service.setRutaActive(rutaId, true, request.user!)
    sendData(response, result, 'Ruta activada')
  }

  createModeloBus: RequestHandler = async (request, response) => {
    const input = createModeloBusSchema.parse(request.body)
    const result = await this.service.createModeloBus(input, request.user!)
    response.status(201)
    sendData(response, result, 'Modelo de bus registrado')
  }

  createRuta: RequestHandler = async (request, response) => {
    const input = createRutaSchema.parse(request.body)
    const result = await this.service.createRuta(input, request.user!)
    response.status(201)
    sendData(response, result, 'Ruta registrada')
  }

  deactivateModeloBus: RequestHandler = async (request, response) => {
    const { modeloBusId } = modeloBusIdParamSchema.parse(request.params)
    const result = await this.service.setModeloBusActive(modeloBusId, false, request.user!)
    sendData(response, result, 'Modelo de bus inactivado')
  }

  deactivateRuta: RequestHandler = async (request, response) => {
    const { rutaId } = rutaIdParamSchema.parse(request.params)
    const result = await this.service.setRutaActive(rutaId, false, request.user!)
    sendData(response, result, 'Ruta inactivada')
  }

  getModeloBus: RequestHandler = async (request, response) => {
    const { modeloBusId } = modeloBusIdParamSchema.parse(request.params)
    const result = await this.service.getModeloBus(modeloBusId, request.user!)
    sendData(response, result, 'Modelo de bus consultado')
  }

  getRuta: RequestHandler = async (request, response) => {
    const { rutaId } = rutaIdParamSchema.parse(request.params)
    const result = await this.service.getRuta(rutaId, request.user!)
    sendData(response, result, 'Ruta consultada')
  }

  listModelosBus: RequestHandler = async (request, response) => {
    const query = catalogListQuerySchema.parse(request.query)
    const result = await this.service.listModelosBus(query, request.user!)
    sendData(response, result, 'Modelos de bus consultados')
  }

  listRutas: RequestHandler = async (request, response) => {
    const query = catalogListQuerySchema.parse(request.query)
    const result = await this.service.listRutas(query, request.user!)
    sendData(response, result, 'Rutas consultadas')
  }

  updateModeloBus: RequestHandler = async (request, response) => {
    const { modeloBusId } = modeloBusIdParamSchema.parse(request.params)
    const input = updateModeloBusSchema.parse(request.body)
    const result = await this.service.updateModeloBus(modeloBusId, input, request.user!)
    sendData(response, result, 'Modelo de bus actualizado')
  }

  updateRuta: RequestHandler = async (request, response) => {
    const { rutaId } = rutaIdParamSchema.parse(request.params)
    const input = updateRutaSchema.parse(request.body)
    const result = await this.service.updateRuta(rutaId, input, request.user!)
    sendData(response, result, 'Ruta actualizada')
  }
}
