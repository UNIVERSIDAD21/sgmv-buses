import type { RequestHandler } from 'express'

import { sendData } from '../shared/http.js'
import {
  cancelJourneySchema,
  createJourneySchema,
  journeyIdParamSchema,
  journeyReadingSchema,
  listJourneysQuerySchema,
  reassignJourneySchema,
} from './journey.schemas.js'
import { JourneyService } from './journey.service.js'

export class JourneyController {
  constructor(private readonly service = new JourneyService()) {}

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
