import type { RequestHandler } from 'express'

import { sendData } from '../shared/http.js'
import {
  availableDriversQuerySchema,
  busIdParamSchema,
  changeBusStateSchema,
  createBusSchema,
  historyQuerySchema,
  listBusesQuerySchema,
  registerMileageSchema,
  updateBusSchema,
} from './fleet.schemas.js'
import { FleetService } from './fleet.service.js'

export class FleetController {
  constructor(private readonly fleetService = new FleetService()) {}

  changeState: RequestHandler = async (request, response) => {
    const { busId } = busIdParamSchema.parse(request.params)
    const input = changeBusStateSchema.parse(request.body)
    const result = await this.fleetService.changeState(busId, input, request.user!)

    sendData(response, result, 'Estado del bus actualizado')
  }

  createBus: RequestHandler = async (request, response) => {
    const input = createBusSchema.parse(request.body)
    const result = await this.fleetService.createBus(input, request.user!)

    response.status(201)
    sendData(response, result, 'Bus registrado')
  }

  getAssignments: RequestHandler = async (request, response) => {
    const { busId } = busIdParamSchema.parse(request.params)
    const { limite } = historyQuerySchema.parse(request.query)
    const result = await this.fleetService.getAssignments(busId, limite, request.user!)

    sendData(response, result, 'Historial de asignaciones')
  }

  getAssignedBus: RequestHandler = async (request, response) => {
    const result = await this.fleetService.getAssignedBusForDriver(request.user!)

    sendData(response, result, 'Bus asignado')
  }

  getAvailableDrivers: RequestHandler = async (request, response) => {
    const { busId } = availableDriversQuerySchema.parse(request.query)
    const result = await this.fleetService.getAvailableDrivers(busId, request.user!)

    sendData(response, result, 'Conductores disponibles')
  }

  getBus: RequestHandler = async (request, response) => {
    const { busId } = busIdParamSchema.parse(request.params)
    const result = await this.fleetService.getBus(busId, request.user!)

    sendData(response, result, 'Detalle del bus')
  }

  getMileageReadings: RequestHandler = async (request, response) => {
    const { busId } = busIdParamSchema.parse(request.params)
    const { limite } = historyQuerySchema.parse(request.query)
    const result = await this.fleetService.getMileageReadings(busId, limite, request.user!)

    sendData(response, result, 'Lecturas de kilometraje')
  }

  getStateHistory: RequestHandler = async (request, response) => {
    const { busId } = busIdParamSchema.parse(request.params)
    const { limite } = historyQuerySchema.parse(request.query)
    const result = await this.fleetService.getStateHistory(busId, limite, request.user!)

    sendData(response, result, 'Historial de estados')
  }

  listBuses: RequestHandler = async (request, response) => {
    const query = listBusesQuerySchema.parse(request.query)
    const result = await this.fleetService.listBuses(query, request.user!)

    sendData(response, result, 'Buses consultados')
  }

  registerMileage: RequestHandler = async (request, response) => {
    const { busId } = busIdParamSchema.parse(request.params)
    const input = registerMileageSchema.parse(request.body)
    const result = await this.fleetService.registerMileage(busId, input, request.user!)

    sendData(response, result, 'Kilometraje registrado')
  }

  summarize: RequestHandler = async (request, response) => {
    const result = await this.fleetService.summarize(request.user!)

    sendData(response, result, 'Resumen de flota')
  }

  updateBus: RequestHandler = async (request, response) => {
    const { busId } = busIdParamSchema.parse(request.params)
    const input = updateBusSchema.parse(request.body)
    const result = await this.fleetService.updateBus(busId, input, request.user!)

    sendData(response, result, 'Bus actualizado')
  }
}
