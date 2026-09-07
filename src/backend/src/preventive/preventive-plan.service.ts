import { Prisma, type CriterioMantenimiento, type PrioridadOrden } from '@prisma/client'

import type { AuthenticatedUser } from '../auth/auth.types.js'
import { AppError } from '../shared/http.js'
import {
  PreventivePlanRepository,
  type PlanData,
  type PreventivePlanRecord,
} from './preventive-plan.repository.js'
import type {
  CreatePreventivePlanInput,
  CreatePreventivePlanVersionInput,
  ListPreventivePlansQuery,
} from './preventive-plan.schemas.js'
import type { EffectivePreventivePlanDto, PreventivePlanDto } from './preventive-plan.types.js'

function ensureAdmin(actor: AuthenticatedUser) {
  if (actor.rol.codigo !== 'ADMINISTRADOR') {
    throw new AppError(403, 'FORBIDDEN', 'No tiene permisos para administrar planes preventivos')
  }
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

export function normalizeTaskKey(value: string) {
  return value.trim().toUpperCase()
}

function isDuplicate(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

function isConstraint(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003'
}

export class PreventivePlanService {
  constructor(private readonly repository = new PreventivePlanRepository()) {}

  async createPlan(input: CreatePreventivePlanInput, actor: AuthenticatedUser) {
    ensureAdmin(actor)
    const data = this.prepareData(input)
    await this.ensureDestinationExists(data)

    try {
      const plan = await this.repository.createFirstVersion(data, actor.id)
      return { plan: this.mapPlan(plan) }
    } catch (error) {
      this.translate(error)
    }
  }

  async createVersion(
    planId: string,
    input: CreatePreventivePlanVersionInput,
    actor: AuthenticatedUser,
  ) {
    ensureAdmin(actor)
    const current = await this.repository.findById(planId)
    if (!current)
      throw new AppError(404, 'PREVENTIVE_PLAN_NOT_FOUND', 'Plan preventivo no encontrado')
    const data = this.prepareData(input, current)

    try {
      const result = await this.repository.createSuccessor(planId, data, actor.id)
      if (!result)
        throw new AppError(404, 'PREVENTIVE_PLAN_NOT_FOUND', 'Plan preventivo no encontrado')
      if (result.conflict || !result.plan) {
        throw new AppError(
          409,
          'PREVENTIVE_PLAN_STALE_VERSION',
          'Existe una versión activa más reciente del plan',
        )
      }
      return { plan: this.mapPlan(result.plan), planAnteriorId: current.id }
    } catch (error) {
      this.translate(error)
    }
  }

  async deactivatePlan(planId: string, actor: AuthenticatedUser) {
    ensureAdmin(actor)
    const current = await this.repository.findById(planId)
    if (!current)
      throw new AppError(404, 'PREVENTIVE_PLAN_NOT_FOUND', 'Plan preventivo no encontrado')
    const plan = current.activo ? await this.repository.deactivate(planId, actor.id) : current
    return { plan: this.mapPlan(plan) }
  }

  async getPlan(planId: string, actor: AuthenticatedUser) {
    ensureAdmin(actor)
    const plan = await this.repository.findById(planId)
    if (!plan) throw new AppError(404, 'PREVENTIVE_PLAN_NOT_FOUND', 'Plan preventivo no encontrado')
    const versions = await this.repository.list({
      busId: plan.busId,
      claveTarea: plan.claveTarea,
      modeloBusId: plan.modeloBusId,
    })
    return { plan: this.mapPlan(plan), versiones: versions.map((item) => this.mapPlan(item)) }
  }

  async listPlans(query: ListPreventivePlansQuery, actor: AuthenticatedUser) {
    ensureAdmin(actor)
    const where: Prisma.PlanMantenimientoPreventivoWhereInput = {}
    if (query.activo !== undefined) where.activo = query.activo
    else if (!query.incluirHistoricos) where.activo = true
    if (query.busId) where.busId = query.busId
    if (query.modeloBusId) where.modeloBusId = query.modeloBusId
    if (query.claveTarea) where.claveTarea = normalizeTaskKey(query.claveTarea)
    const planes = await this.repository.list(where)
    return { planes: planes.map((plan) => this.mapPlan(plan)) }
  }

  /** Internal selector for P6-C materialization; it performs no write or authorization decision. */
  async resolveEffectivePlanForBus(
    busId: string,
    claveTarea: string,
  ): Promise<EffectivePreventivePlanDto | null> {
    const result = await this.repository.resolveEffective(busId, normalizeTaskKey(claveTarea))
    return result ? { origenPlan: result.origenPlan, plan: this.mapPlan(result.plan) } : null
  }

  private async ensureDestinationExists(data: PlanData) {
    if (data.busId && !(await this.repository.findBusForResolution(data.busId))) {
      throw new AppError(404, 'BUS_NOT_FOUND', 'Bus no encontrado')
    }
    if (data.modeloBusId && !(await this.repository.findModeloBusById(data.modeloBusId))) {
      throw new AppError(404, 'BUS_MODEL_NOT_FOUND', 'Modelo de bus no encontrado')
    }
  }

  private mapPlan(plan: PreventivePlanRecord): PreventivePlanDto {
    return {
      activa: plan.activo,
      actividad: plan.actividad,
      anticipacionDias: plan.anticipacionDias,
      anticipacionKm: plan.anticipacionKm,
      bloqueaAlVencer: plan.bloqueaAlVencer,
      claveTarea: plan.claveTarea,
      componente: plan.componente,
      creadoPor: {
        email: plan.creadoPor.email,
        id: plan.creadoPor.id,
        nombre: plan.creadoPor.nombre,
      },
      createdAt: plan.createdAt.toISOString(),
      criterio: plan.criterio,
      destino: plan.busId
        ? { busId: plan.busId, tipo: 'BUS' }
        : { modeloBusId: plan.modeloBusId!, tipo: 'MODELO' },
      id: plan.id,
      intervaloDias: plan.intervaloDias,
      intervaloKm: plan.intervaloKm,
      prioridad: plan.prioridad,
      programacionesAsociadas: plan._count.programacionesMantenimiento,
      updatedAt: plan.updatedAt.toISOString(),
      version: plan.version,
    }
  }

  private prepareData(
    input: CreatePreventivePlanInput | CreatePreventivePlanVersionInput,
    current?: PreventivePlanRecord,
  ): PlanData {
    return {
      actividad: normalizeText(input.actividad),
      anticipacionDias: input.anticipacionDias ?? null,
      anticipacionKm: input.anticipacionKm ?? null,
      bloqueaAlVencer: input.bloqueaAlVencer,
      busId: current ? current.busId : ((input as CreatePreventivePlanInput).busId ?? null),
      claveTarea: current
        ? current.claveTarea
        : normalizeTaskKey((input as CreatePreventivePlanInput).claveTarea),
      componente: normalizeText(input.componente),
      criterio: input.criterio as CriterioMantenimiento,
      intervaloDias: input.intervaloDias ?? null,
      intervaloKm: input.intervaloKm ?? null,
      modeloBusId: current
        ? current.modeloBusId
        : ((input as CreatePreventivePlanInput).modeloBusId ?? null),
      prioridad: input.prioridad as PrioridadOrden,
    }
  }

  private translate(error: unknown): never {
    if (error instanceof AppError) throw error
    if (isDuplicate(error)) {
      throw new AppError(
        409,
        'DUPLICATE_PREVENTIVE_PLAN',
        'Ya existe una versión activa para esa tarea y destino',
      )
    }
    if (isConstraint(error)) {
      throw new AppError(
        404,
        'PREVENTIVE_PLAN_DESTINATION_NOT_FOUND',
        'El destino del plan no existe',
      )
    }
    throw error
  }
}
