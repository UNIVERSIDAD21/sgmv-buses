import type { RequestHandler } from 'express'

import { sendData } from '../shared/http.js'
import {
  assignWorkOrderSchema,
  availableMechanicsQuerySchema,
  availablePartsQuerySchema,
  createActivitySchema,
  createConsumptionSchema,
  createManualWorkOrderSchema,
  interventionUpdateSchema,
  listWorkOrdersQuerySchema,
  orderIdParamSchema,
  reassignWorkOrderSchema,
  returnWorkOrderSchema,
  transitionObservationSchema,
} from './work-order.schemas.js'
import { WorkOrderService } from './work-order.service.js'

export class WorkOrderController {
  constructor(private readonly workOrderService = new WorkOrderService()) {}

  assign: RequestHandler = async (request, response) => {
    const { ordenId } = orderIdParamSchema.parse(request.params)
    const input = assignWorkOrderSchema.parse(request.body)
    const result = await this.workOrderService.assign(ordenId, input, request.user!)

    sendData(response, result, 'Orden asignada')
  }

  close: RequestHandler = async (request, response) => {
    const { ordenId } = orderIdParamSchema.parse(request.params)
    const input = transitionObservationSchema.parse(request.body)
    const result = await this.workOrderService.close(ordenId, input, request.user!)

    sendData(response, result, 'Orden cerrada administrativamente')
  }

  complete: RequestHandler = async (request, response) => {
    const { ordenId } = orderIdParamSchema.parse(request.params)
    const input = transitionObservationSchema.parse(request.body)
    const result = await this.workOrderService.complete(ordenId, input, request.user!)

    sendData(response, result, 'Orden completada tecnicamente')
  }

  createActivity: RequestHandler = async (request, response) => {
    const { ordenId } = orderIdParamSchema.parse(request.params)
    const input = createActivitySchema.parse(request.body)
    const result = await this.workOrderService.createActivity(ordenId, input, request.user!)

    response.status(201)
    sendData(response, result, 'Actividad registrada')
  }

  createConsumption: RequestHandler = async (request, response) => {
    const { ordenId } = orderIdParamSchema.parse(request.params)
    const input = createConsumptionSchema.parse(request.body)
    const result = await this.workOrderService.createConsumption(ordenId, input, request.user!)

    if (!result.yaExistia) {
      response.status(201)
    }

    sendData(response, result, result.yaExistia ? 'Consumo ya registrado' : 'Consumo registrado')
  }

  createManual: RequestHandler = async (request, response) => {
    const input = createManualWorkOrderSchema.parse(request.body)
    const result = await this.workOrderService.createManual(input, request.user!)

    response.status(201)
    sendData(response, result, 'Orden de trabajo creada')
  }

  getAvailableMechanics: RequestHandler = async (request, response) => {
    const query = availableMechanicsQuerySchema.parse(request.query)
    const result = await this.workOrderService.getAvailableMechanics(query, request.user!)

    sendData(response, result, 'Mecanicos disponibles')
  }

  getAvailableSpareParts: RequestHandler = async (request, response) => {
    const { ordenId } = orderIdParamSchema.parse(request.params)
    const query = availablePartsQuerySchema.parse(request.query)
    const result = await this.workOrderService.getAvailableSpareParts(ordenId, query, request.user!)

    sendData(response, result, 'Repuestos disponibles')
  }

  getOrder: RequestHandler = async (request, response) => {
    const { ordenId } = orderIdParamSchema.parse(request.params)
    const result = await this.workOrderService.getOrder(ordenId, request.user!)

    sendData(response, result, 'Detalle de orden')
  }

  getReassignments: RequestHandler = async (request, response) => {
    const { ordenId } = orderIdParamSchema.parse(request.params)
    const result = await this.workOrderService.getReassignments(ordenId, request.user!)

    sendData(response, result, 'Reasignaciones de orden')
  }

  getStateHistory: RequestHandler = async (request, response) => {
    const { ordenId } = orderIdParamSchema.parse(request.params)
    const result = await this.workOrderService.getStateHistory(ordenId, request.user!)

    sendData(response, result, 'Historial de estados')
  }

  listAdminOrders: RequestHandler = async (request, response) => {
    const query = listWorkOrdersQuerySchema.parse(request.query)
    const result = await this.workOrderService.listAdminOrders(query, request.user!)

    sendData(response, result, 'Ordenes consultadas')
  }

  listMyOrders: RequestHandler = async (request, response) => {
    const query = listWorkOrdersQuerySchema.parse(request.query)
    const result = await this.workOrderService.listMyOrders(query, request.user!)

    sendData(response, result, 'Ordenes asignadas consultadas')
  }

  reassign: RequestHandler = async (request, response) => {
    const { ordenId } = orderIdParamSchema.parse(request.params)
    const input = reassignWorkOrderSchema.parse(request.body)
    const result = await this.workOrderService.reassign(ordenId, input, request.user!)

    sendData(response, result, 'Orden reasignada')
  }

  resume: RequestHandler = async (request, response) => {
    const { ordenId } = orderIdParamSchema.parse(request.params)
    const input = transitionObservationSchema.parse(request.body)
    const result = await this.workOrderService.resume(ordenId, input, request.user!)

    sendData(response, result, 'Orden reanudada')
  }

  returnForCorrection: RequestHandler = async (request, response) => {
    const { ordenId } = orderIdParamSchema.parse(request.params)
    const input = returnWorkOrderSchema.parse(request.body)
    const result = await this.workOrderService.returnForCorrection(ordenId, input, request.user!)

    sendData(response, result, 'Orden devuelta para correccion')
  }

  start: RequestHandler = async (request, response) => {
    const { ordenId } = orderIdParamSchema.parse(request.params)
    const input = transitionObservationSchema.parse(request.body)
    const result = await this.workOrderService.start(ordenId, input, request.user!)

    sendData(response, result, 'Ejecucion iniciada')
  }

  summarize: RequestHandler = async (request, response) => {
    const result = await this.workOrderService.summarize(request.user!)

    sendData(response, result, 'Resumen de ordenes')
  }

  updateIntervention: RequestHandler = async (request, response) => {
    const { ordenId } = orderIdParamSchema.parse(request.params)
    const input = interventionUpdateSchema.parse(request.body)
    const result = await this.workOrderService.updateIntervention(ordenId, input, request.user!)

    sendData(response, result, 'Intervencion actualizada')
  }
}
