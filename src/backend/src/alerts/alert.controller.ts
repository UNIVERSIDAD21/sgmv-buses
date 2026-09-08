import type { RequestHandler } from 'express'

import { sendData } from '../shared/http.js'
import { AlertService } from './alert.service.js'
import { alertRecipientIdParamSchema, listAlertsQuerySchema } from './alert.schemas.js'

export class AlertController {
  constructor(private readonly alertService = new AlertService()) {}

  listOwn: RequestHandler = async (request, response) => {
    sendData(
      response,
      await this.alertService.listOwn(listAlertsQuerySchema.parse(request.query), request.user!),
      'Alertas consultadas',
    )
  }

  countUnread: RequestHandler = async (request, response) => {
    sendData(
      response,
      await this.alertService.countUnread(request.user!),
      'Conteo de alertas no leidas',
    )
  }

  markRead: RequestHandler = async (request, response) => {
    const { destinatarioId } = alertRecipientIdParamSchema.parse(request.params)
    sendData(
      response,
      await this.alertService.markRead(destinatarioId, request.user!),
      'Alerta marcada como leida',
    )
  }

  markAttended: RequestHandler = async (request, response) => {
    const { destinatarioId } = alertRecipientIdParamSchema.parse(request.params)
    sendData(
      response,
      await this.alertService.markAttended(destinatarioId, request.user!),
      'Alerta marcada como atendida',
    )
  }
}
