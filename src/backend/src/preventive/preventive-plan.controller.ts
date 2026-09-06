import type { RequestHandler } from 'express'

import { sendData } from '../shared/http.js'
import {
  createPreventivePlanSchema,
  createPreventivePlanVersionSchema,
  listPreventivePlansQuerySchema,
  planIdParamSchema,
} from './preventive-plan.schemas.js'
import { PreventivePlanService } from './preventive-plan.service.js'

export class PreventivePlanController {
  constructor(private readonly service = new PreventivePlanService()) {}

  create: RequestHandler = async (request, response) => {
    const result = await this.service.createPlan(
      createPreventivePlanSchema.parse(request.body),
      request.user!,
    )
    response.status(201)
    sendData(response, result, 'Plan preventivo registrado')
  }

  createVersion: RequestHandler = async (request, response) => {
    const { planId } = planIdParamSchema.parse(request.params)
    const result = await this.service.createVersion(
      planId,
      createPreventivePlanVersionSchema.parse(request.body),
      request.user!,
    )
    response.status(201)
    sendData(response, result, 'Nueva versión preventiva registrada')
  }

  deactivate: RequestHandler = async (request, response) => {
    const { planId } = planIdParamSchema.parse(request.params)
    const result = await this.service.deactivatePlan(planId, request.user!)
    sendData(response, result, 'Plan preventivo inactivado')
  }

  get: RequestHandler = async (request, response) => {
    const { planId } = planIdParamSchema.parse(request.params)
    sendData(
      response,
      await this.service.getPlan(planId, request.user!),
      'Detalle de plan preventivo',
    )
  }

  list: RequestHandler = async (request, response) => {
    const result = await this.service.listPlans(
      listPreventivePlansQuerySchema.parse(request.query),
      request.user!,
    )
    sendData(response, result, 'Planes preventivos consultados')
  }
}
