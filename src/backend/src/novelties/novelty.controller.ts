import type { RequestHandler } from 'express'

import { sendData } from '../shared/http.js'
import {
  convertNoveltySchema,
  createNoveltySchema,
  listNoveltiesQuerySchema,
  noveltyIdParamSchema,
  reviewNoveltySchema,
} from './novelty.schemas.js'
import { NoveltyService } from './novelty.service.js'

export class NoveltyController {
  constructor(private readonly noveltyService = new NoveltyService()) {}

  convertToCorrectiveOrder: RequestHandler = async (request, response) => {
    const { novedadId } = noveltyIdParamSchema.parse(request.params)
    const input = convertNoveltySchema.parse(request.body)
    const result = await this.noveltyService.convertToCorrectiveOrder(
      novedadId,
      input,
      request.user!,
    )

    sendData(
      response,
      result,
      result.yaExistia ? 'La novedad ya tenia orden asociada' : 'Orden correctiva generada',
    )
  }

  createNovelty: RequestHandler = async (request, response) => {
    const input = createNoveltySchema.parse(request.body)
    const result = await this.noveltyService.createNovelty(input, request.user!)

    response.status(201)
    sendData(response, result, 'Novedad registrada')
  }

  getAdminNovelty: RequestHandler = async (request, response) => {
    const { novedadId } = noveltyIdParamSchema.parse(request.params)
    const result = await this.noveltyService.getAdminNovelty(novedadId, request.user!)

    sendData(response, result, 'Detalle de novedad')
  }

  getOwnNovelty: RequestHandler = async (request, response) => {
    const { novedadId } = noveltyIdParamSchema.parse(request.params)
    const result = await this.noveltyService.getOwnNovelty(novedadId, request.user!)

    sendData(response, result, 'Detalle de novedad')
  }

  listAdminNovelties: RequestHandler = async (request, response) => {
    const query = listNoveltiesQuerySchema.parse(request.query)
    const result = await this.noveltyService.listAdminNovelties(query, request.user!)

    sendData(response, result, 'Novedades consultadas')
  }

  listOwnNovelties: RequestHandler = async (request, response) => {
    const query = listNoveltiesQuerySchema.parse(request.query)
    const result = await this.noveltyService.listOwnNovelties(query, request.user!)

    sendData(response, result, 'Novedades propias consultadas')
  }

  reviewNovelty: RequestHandler = async (request, response) => {
    const { novedadId } = noveltyIdParamSchema.parse(request.params)
    const input = reviewNoveltySchema.parse(request.body)
    const result = await this.noveltyService.reviewNovelty(novedadId, input, request.user!)

    sendData(response, result, 'Novedad revisada')
  }

  summarize: RequestHandler = async (request, response) => {
    const result = await this.noveltyService.summarize(request.user!)

    sendData(response, result, 'Resumen de novedades')
  }
}
