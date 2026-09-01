import type { RequestHandler } from 'express'

import { sendData } from '../shared/http.js'
import { ReportService } from './report.service.js'
import { busHistoryParamSchema, reportQuerySchema } from './report.schemas.js'

export class ReportController {
  constructor(private readonly reportService = new ReportService()) {}

  summarize: RequestHandler = async (request, response) => {
    const query = reportQuerySchema.parse(request.query)
    const result = await this.reportService.summarize(query, request.user!)
    sendData(response, result, 'Resumen de historial consultado')
  }

  listBuses: RequestHandler = async (request, response) => {
    const query = reportQuerySchema.parse(request.query)
    const result = await this.reportService.listBuses(query, request.user!)
    sendData(response, result, 'Buses con historial consultados')
  }

  getBusHistory: RequestHandler = async (request, response) => {
    const { busId } = busHistoryParamSchema.parse(request.params)
    const query = reportQuerySchema.parse(request.query)
    const result = await this.reportService.getBusHistory(busId, query, request.user!)
    sendData(response, result, 'Historial del bus consultado')
  }

  getMyBusHistory: RequestHandler = async (request, response) => {
    const query = reportQuerySchema.parse(request.query)
    const result = await this.reportService.getMyBusHistory(query, request.user!)
    sendData(response, result, 'Historial del bus asignado consultado')
  }

  maintenanceReport: RequestHandler = async (request, response) => {
    const query = reportQuerySchema.parse(request.query)
    const result = await this.reportService.maintenanceReport(query, request.user!)
    sendData(response, result, 'Informe de mantenimiento generado')
  }

  partsReport: RequestHandler = async (request, response) => {
    const query = reportQuerySchema.parse(request.query)
    const result = await this.reportService.partsReport(query, request.user!)
    sendData(response, result, 'Informe de repuestos generado')
  }

  costReport: RequestHandler = async (request, response) => {
    const query = reportQuerySchema.parse(request.query)
    const result = await this.reportService.costReport(query, request.user!)
    sendData(response, result, 'Informe de costos generado')
  }
}
