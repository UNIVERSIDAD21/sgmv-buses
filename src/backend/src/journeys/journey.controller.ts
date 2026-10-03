import type { RequestHandler } from 'express'

import { sendData } from '../shared/http.js'
import {
  cancelJourneySchema,
  reportClosureProblemSchema,
  createJourneySchema,
  journeyPeriodSchema,
  journeyIdParamSchema,
  journeyReadingSchema,
  interruptJourneySchema,
  reconcileFinalReadingSchema,
  markReadingUnrecoverableSchema,
  listJourneysQuerySchema,
  reassignJourneySchema,
} from './journey.schemas.js'
import { JourneyService } from './journey.service.js'

export class JourneyController {
  constructor(private readonly service = new JourneyService()) {}
  previewPeriod: RequestHandler = async (request, response) => {
    const input = journeyPeriodSchema.parse(request.body)
    sendData(
      response,
      await this.service.previewPeriod(input, request.user!),
      'Período previsualizado',
    )
  }

  confirmPeriod: RequestHandler = async (request, response) => {
    const input = journeyPeriodSchema.parse(request.body)
    const result = await this.service.confirmPeriod(input, request.user!)
    response.status(201)
    sendData(response, result, 'Jornadas del período programadas')
  }

  reconcileFinalReading: RequestHandler = async (request, response) => {
    const { jornadaId } = journeyIdParamSchema.parse(request.params)
    const input = reconcileFinalReadingSchema.parse(request.body)
    sendData(
      response,
      await this.service.reconcileFinalReading(jornadaId, input, request.user!),
      'Lectura final conciliada',
    )
  }
  markReadingUnrecoverable: RequestHandler = async (request, response) => {
    const { jornadaId } = journeyIdParamSchema.parse(request.params)
    const input = markReadingUnrecoverableSchema.parse(request.body)
    sendData(
      response,
      await this.service.markReadingUnrecoverable(jornadaId, input, request.user!),
      'Lectura final declarada no recuperable',
    )
  }
  interrupt: RequestHandler = async (request, response) => {
    const { jornadaId } = journeyIdParamSchema.parse(request.params)
    const input = interruptJourneySchema.parse(request.body)
    sendData(
      response,
      await this.service.interrupt(jornadaId, input, request.user!),
      'Jornada interrumpida',
    )
  }
  reportClosureProblem: RequestHandler = async (request, response) => {
    const { jornadaId } = journeyIdParamSchema.parse(request.params)
    const { motivo } = reportClosureProblemSchema.parse(request.body)
    sendData(
      response,
      await this.service.reportClosureProblem(jornadaId, motivo, request.user!),
      'Despacho recibió el informe de cierre pendiente',
    )
  }

  cancel: RequestHandler = async (request, response) => {
    const { jornadaId } = journeyIdParamSchema.parse(request.params)
    const input = cancelJourneySchema.parse(request.body)
    const result = await this.service.cancel(jornadaId, input, request.user!)
    sendData(response, result, 'Jornada cancelada')
  }

  create: RequestHandler = async (request, response) => {
    const input = createJourneySchema.parse(request.body)
    const result = await this.service.create(input, request.user!)
    response.status(201)
    sendData(response, result, 'Jornada programada')
  }

  finish: RequestHandler = async (request, response) => {
    const { jornadaId } = journeyIdParamSchema.parse(request.params)
    const input = journeyReadingSchema.parse(request.body)
    const result = await this.service.finish(jornadaId, input, request.user!)
    sendData(response, result, 'Jornada finalizada')
  }

  getById: RequestHandler = async (request, response) => {
    const { jornadaId } = journeyIdParamSchema.parse(request.params)
    const result = await this.service.getById(jornadaId, request.user!)
    sendData(response, result, 'Jornada consultada')
  }

  getMyJourney: RequestHandler = async (request, response) => {
    const result = await this.service.getMyJourney(request.user!)
    sendData(response, result, 'Jornada propia consultada')
  }

  getOptions: RequestHandler = async (request, response) => {
    const result = await this.service.getOptions(request.user!)
    sendData(response, result, 'Opciones operativas consultadas')
  }

  list: RequestHandler = async (request, response) => {
    const query = listJourneysQuerySchema.parse(request.query)
    const result = await this.service.list(query, request.user!)
    sendData(response, result, 'Jornadas consultadas')
  }

  listAttention: RequestHandler = async (request, response) => {
    const result = await this.service.listAttention(request.user!)
    sendData(response, result, 'Pendientes operativos consultados')
  }

  listReadings: RequestHandler = async (request, response) => {
    const { jornadaId } = journeyIdParamSchema.parse(request.params)
    const result = await this.service.listReadings(jornadaId, request.user!)
    sendData(response, result, 'Lecturas de jornada consultadas')
  }

  reassign: RequestHandler = async (request, response) => {
    const { jornadaId } = journeyIdParamSchema.parse(request.params)
    const input = reassignJourneySchema.parse(request.body)
    const result = await this.service.reassign(jornadaId, input, request.user!)
    response.status(201)
    sendData(response, result, 'Jornada reasignada mediante sucesora')
  }

  start: RequestHandler = async (request, response) => {
    const { jornadaId } = journeyIdParamSchema.parse(request.params)
    const input = journeyReadingSchema.parse(request.body)
    const result = await this.service.start(jornadaId, input, request.user!)
    sendData(response, result, 'Jornada iniciada')
  }
}
