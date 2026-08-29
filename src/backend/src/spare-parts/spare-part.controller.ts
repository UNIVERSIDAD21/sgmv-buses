import type { RequestHandler } from 'express'

import { sendData } from '../shared/http.js'
import {
  createSparePartSchema,
  listInventoryMovementsQuerySchema,
  listSparePartsQuerySchema,
  sparePartIdParamSchema,
  stockAdjustmentSchema,
  stockEntrySchema,
  updateSparePartSchema,
} from './spare-part.schemas.js'
import { SparePartService } from './spare-part.service.js'

export class SparePartController {
  constructor(private readonly sparePartService = new SparePartService()) {}

  activate: RequestHandler = async (request, response) => {
    const { repuestoId } = sparePartIdParamSchema.parse(request.params)
    const result = await this.sparePartService.activate(repuestoId, request.user!)

    sendData(response, result, result.yaExistia ? 'Repuesto ya estaba activo' : 'Repuesto activo')
  }

  create: RequestHandler = async (request, response) => {
    const input = createSparePartSchema.parse(request.body)
    const result = await this.sparePartService.create(input, request.user!)

    if (!result.yaExistia) {
      response.status(201)
    }

    sendData(response, result, result.yaExistia ? 'Repuesto ya registrado' : 'Repuesto creado')
  }

  deactivate: RequestHandler = async (request, response) => {
    const { repuestoId } = sparePartIdParamSchema.parse(request.params)
    const result = await this.sparePartService.deactivate(repuestoId, request.user!)

    sendData(
      response,
      result,
      result.yaExistia ? 'Repuesto ya estaba inactivo' : 'Repuesto inactivo',
    )
  }

  getById: RequestHandler = async (request, response) => {
    const { repuestoId } = sparePartIdParamSchema.parse(request.params)
    const result = await this.sparePartService.getById(repuestoId, request.user!)

    sendData(response, result, 'Detalle de repuesto')
  }

  list: RequestHandler = async (request, response) => {
    const query = listSparePartsQuerySchema.parse(request.query)
    const result = await this.sparePartService.list(query, request.user!)

    sendData(response, result, 'Repuestos consultados')
  }

  listMovements: RequestHandler = async (request, response) => {
    const query = listInventoryMovementsQuerySchema.parse(request.query)
    const result = await this.sparePartService.listMovements(query, request.user!)

    sendData(response, result, 'Movimientos consultados')
  }

  listPartMovements: RequestHandler = async (request, response) => {
    const { repuestoId } = sparePartIdParamSchema.parse(request.params)
    const query = listInventoryMovementsQuerySchema.parse(request.query)
    const result = await this.sparePartService.listMovements(query, request.user!, repuestoId)

    sendData(response, result, 'Movimientos del repuesto consultados')
  }

  registerAdjustment: RequestHandler = async (request, response) => {
    const { repuestoId } = sparePartIdParamSchema.parse(request.params)
    const input = stockAdjustmentSchema.parse(request.body)
    const result = await this.sparePartService.registerAdjustment(repuestoId, input, request.user!)

    if (!result.yaExistia) {
      response.status(201)
    }

    sendData(response, result, result.yaExistia ? 'Ajuste ya aplicado' : 'Ajuste registrado')
  }

  registerEntry: RequestHandler = async (request, response) => {
    const { repuestoId } = sparePartIdParamSchema.parse(request.params)
    const input = stockEntrySchema.parse(request.body)
    const result = await this.sparePartService.registerEntry(repuestoId, input, request.user!)

    if (!result.yaExistia) {
      response.status(201)
    }

    sendData(response, result, result.yaExistia ? 'Entrada ya aplicada' : 'Entrada registrada')
  }

  summarize: RequestHandler = async (request, response) => {
    const result = await this.sparePartService.summarize(request.user!)

    sendData(response, result, 'Resumen de repuestos')
  }

  update: RequestHandler = async (request, response) => {
    const { repuestoId } = sparePartIdParamSchema.parse(request.params)
    const input = updateSparePartSchema.parse(request.body)
    const result = await this.sparePartService.update(repuestoId, input, request.user!)

    sendData(response, result, 'Repuesto actualizado')
  }
}
