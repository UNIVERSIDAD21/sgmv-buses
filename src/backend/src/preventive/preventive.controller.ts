import type { RequestHandler } from 'express'

import { sendData } from '../shared/http.js'
import {
  createPreventiveScheduleSchema,
  generatePreventiveOrderSchema,
  listPreventiveSchedulesQuerySchema,
  programacionIdParamSchema,
  updatePreventiveScheduleSchema,
} from './preventive.schemas.js'
import { PreventiveService } from './preventive.service.js'

export class PreventiveController {
  constructor(private readonly preventiveService = new PreventiveService()) {}

  createSchedule: RequestHandler = async (request, response) => {
    const input = createPreventiveScheduleSchema.parse(request.body)
    const result = await this.preventiveService.createSchedule(input, request.user!)

    response.status(201)
    sendData(response, result, 'Programacion preventiva registrada')
  }

  generateOrder: RequestHandler = async (request, response) => {
    const { programacionId } = programacionIdParamSchema.parse(request.params)
    const input = generatePreventiveOrderSchema.parse(request.body)
    const result = await this.preventiveService.generateOrder(programacionId, input, request.user!)

    sendData(
      response,
      result,
      result.yaExistia
        ? 'La programacion ya tenia una orden preventiva activa'
        : 'Orden preventiva generada',
    )
  }

  getSchedule: RequestHandler = async (request, response) => {
    const { programacionId } = programacionIdParamSchema.parse(request.params)
    const result = await this.preventiveService.getSchedule(programacionId, request.user!)

    sendData(response, result, 'Detalle de programacion preventiva')
  }

  listSchedules: RequestHandler = async (request, response) => {
    const query = listPreventiveSchedulesQuerySchema.parse(request.query)
    const result = await this.preventiveService.listSchedules(query, request.user!)

    sendData(response, result, 'Programaciones preventivas consultadas')
  }

  summarize: RequestHandler = async (request, response) => {
    const result = await this.preventiveService.summarize(request.user!)

    sendData(response, result, 'Resumen preventivo')
  }

  updateSchedule: RequestHandler = async (request, response) => {
    const { programacionId } = programacionIdParamSchema.parse(request.params)
    const input = updatePreventiveScheduleSchema.parse(request.body)
    const result = await this.preventiveService.updateSchedule(programacionId, input, request.user!)

    sendData(response, result, 'Programacion preventiva actualizada')
  }
}
