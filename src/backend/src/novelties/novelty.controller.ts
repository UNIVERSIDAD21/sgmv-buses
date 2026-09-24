import type { RequestHandler } from 'express'

import { sendData } from '../shared/http.js'
import {
  convertNoveltySchema,
  createNoveltySchema,
  deleteNoveltyEvidenceSchema,
  listNoveltiesQuerySchema,
  noveltyEvidenceParamSchema,
  noveltyIdParamSchema,
  reviewNoveltySchema,
  uploadNoveltyEvidenceSchema,
} from './novelty.schemas.js'
import { NoveltyService } from './novelty.service.js'
import { NoveltyEvidenceService } from './novelty-evidence.service.js'
import { validateUploadedImages } from '../media/image-upload.middleware.js'

export class NoveltyController {
  constructor(
    private readonly noveltyService = new NoveltyService(),
    private readonly evidenceService = new NoveltyEvidenceService(),
  ) {}

  uploadEvidence: RequestHandler = async (request, response) => {
    const { novedadId } = noveltyIdParamSchema.parse(request.params)
    const { cargaId } = uploadNoveltyEvidenceSchema.parse(request.body)
    const files = validateUploadedImages(request)
    const result = await this.evidenceService.upload(novedadId, cargaId, files, request.user!)

    response.status(result.yaExistia ? 200 : 201)
    sendData(response, result, result.yaExistia ? 'Carga recuperada' : 'Evidencias guardadas')
  }

  downloadEvidence: RequestHandler = async (request, response) => {
    const { evidenciaId, novedadId } = noveltyEvidenceParamSchema.parse(request.params)
    const { buffer, evidence } = await this.evidenceService.download(
      novedadId,
      evidenciaId,
      request.user!,
    )

    response.set({
      'Cache-Control': 'private, no-store',
      Vary: 'Cookie, Origin',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(evidence.nombreOriginal)}`,
      'Content-Length': String(buffer.length),
      'Content-Type': evidence.mimeType,
      'X-Content-Type-Options': 'nosniff',
    })
    response.send(buffer)
  }

  deleteEvidence: RequestHandler = async (request, response) => {
    const { evidenciaId, novedadId } = noveltyEvidenceParamSchema.parse(request.params)
    const { motivo } = deleteNoveltyEvidenceSchema.parse(request.body)
    const result = await this.evidenceService.delete(novedadId, evidenciaId, motivo, request.user!)
    sendData(response, result, 'Evidencia eliminada')
  }

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
