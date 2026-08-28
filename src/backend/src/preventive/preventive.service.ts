import { Prisma, type CriterioMantenimiento, type PrioridadOrden } from '@prisma/client'

import type { AuthenticatedUser } from '../auth/auth.types.js'
import { env } from '../config/env.js'
import { AppError } from '../shared/http.js'
import {
  classifyPreventiveSchedule,
  type PreventiveClassification,
} from './preventive.classification.js'
import {
  PreventiveRepository,
  type PreventiveScheduleRecord,
  type PreventiveWorkOrderRecord,
} from './preventive.repository.js'
import type {
  CreatePreventiveScheduleInput,
  GeneratePreventiveOrderInput,
  ListPreventiveSchedulesQuery,
  UpdatePreventiveScheduleInput,
} from './preventive.schemas.js'
import type {
  GeneratePreventiveOrderDto,
  PreventiveListDto,
  PreventiveOrderSummaryDto,
  PreventiveScheduleDto,
  PreventiveSummaryDto,
  PreventiveUserDto,
} from './preventive.types.js'

const classificationDefaults: Record<PreventiveClassification, number> = {
  PROXIMO: 0,
  VENCIDO: 0,
  VIGENTE: 0,
}

const timeZone = 'America/Bogota'

interface PreparedScheduleData {
  actividad: string
  busId: string
  criterio: CriterioMantenimiento
  fechaProgramada: Date | null
  kilometrajeObjetivo: number | null
  tipo: string
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function ensureAdmin(actor: AuthenticatedUser) {
  if (actor.rol.codigo !== 'ADMINISTRADOR') {
    throw new AppError(403, 'FORBIDDEN', 'No tiene permisos para realizar esta operacion')
  }
}

function dateOnlyToUtc(value: string) {
  const [yearText, monthText, dayText] = value.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new AppError(400, 'INVALID_DATE', 'La fecha programada no es valida')
  }

  return date
}

function dateColumnToIsoDate(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null
}

function mapUser(user: PreventiveUserDto): PreventiveUserDto {
  return {
    email: user.email,
    id: user.id,
    nombre: user.nombre,
  }
}

function mapOrder(
  order: PreventiveWorkOrderRecord | null | undefined,
): PreventiveOrderSummaryDto | null {
  if (!order) {
    return null
  }

  return {
    codigo: order.codigo,
    descripcion: order.descripcion,
    estado: order.estado,
    fechaCreacion: order.fechaCreacion.toISOString(),
    fechaObjetivoPreventivo: dateColumnToIsoDate(order.fechaObjetivoPreventivo),
    id: order.id,
    kilometrajeObjetivoPreventivo: order.kilometrajeObjetivoPreventivo,
    origen: 'PREVENTIVO',
    prioridad: order.prioridad,
    tipo: 'PREVENTIVA',
  }
}

function duplicateMessageFromTarget(target: unknown) {
  const serializedTarget = Array.isArray(target) ? target.join(',') : String(target ?? '')

  if (serializedTarget.includes('codigo')) {
    return 'No fue posible generar un codigo unico para la orden'
  }

  return 'La programacion ya tiene una orden preventiva activa'
}

function isPrismaDuplicate(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

function translatePrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new AppError(
        409,
        'DUPLICATE_PREVENTIVE_ORDER',
        duplicateMessageFromTarget(error.meta?.target),
      )
    }

    if (error.code === 'P2025') {
      throw new AppError(404, 'PREVENTIVE_SCHEDULE_NOT_FOUND', 'Programacion no encontrada')
    }
  }

  throw error
}

function compareNullableNumber(a: number | null, b: number | null) {
  if (a === b) {
    return 0
  }

  if (a === null) {
    return -1
  }

  if (b === null) {
    return 1
  }

  return a - b
}

function compareNullableString(a: string | null, b: string | null) {
  if (a === b) {
    return 0
  }

  if (a === null) {
    return -1
  }

  if (b === null) {
    return 1
  }

  return a.localeCompare(b)
}

export class PreventiveService {
  constructor(private readonly preventiveRepository = new PreventiveRepository()) {}

  async createSchedule(input: CreatePreventiveScheduleInput, actor: AuthenticatedUser) {
    ensureAdmin(actor)

    const data = this.prepareCreateData(input)
    const bus = await this.preventiveRepository.findBusById(data.busId)

    if (!bus) {
      throw new AppError(404, 'BUS_NOT_FOUND', 'Bus no encontrado')
    }

    if (bus.estadoOperativo === 'INACTIVO') {
      throw new AppError(400, 'BUS_NOT_ELIGIBLE', 'No se puede programar un bus inactivo')
    }

    const duplicate = await this.preventiveRepository.findLogicalDuplicate(data)

    if (duplicate) {
      throw new AppError(
        409,
        'DUPLICATE_PREVENTIVE_SCHEDULE',
        'Ya existe una programacion preventiva activa con los mismos criterios',
      )
    }

    try {
      const schedule = await this.preventiveRepository.createSchedule(data, actor.id)

      return {
        programacion: this.mapSchedule(schedule),
      }
    } catch (error) {
      translatePrismaError(error)
    }
  }

  async generateOrder(
    programacionId: string,
    input: GeneratePreventiveOrderInput,
    actor: AuthenticatedUser,
  ): Promise<GeneratePreventiveOrderDto> {
    ensureAdmin(actor)

    const schedule = await this.preventiveRepository.findScheduleById(programacionId)

    if (!schedule) {
      throw new AppError(404, 'PREVENTIVE_SCHEDULE_NOT_FOUND', 'Programacion no encontrada')
    }

    if (!schedule.activa) {
      throw new AppError(
        400,
        'PREVENTIVE_SCHEDULE_INACTIVE',
        'No se puede generar orden desde una programacion inactiva',
      )
    }

    const classification = this.classify(schedule)

    if (classification.estado === 'VIGENTE') {
      throw new AppError(
        400,
        'PREVENTIVE_SCHEDULE_NOT_ELIGIBLE',
        'Solo las programaciones proximas o vencidas pueden generar orden preventiva',
      )
    }

    const descripcionOrden =
      input.descripcionOrden?.trim() ||
      `Orden preventiva generada desde programacion: ${schedule.tipo}.`

    try {
      const result = await this.preventiveRepository.generatePreventiveOrder(
        programacionId,
        actor.id,
        {
          descripcionOrden: normalizeText(descripcionOrden),
          fechaObjetivoPreventivo: schedule.fechaProgramada,
          kilometrajeObjetivoPreventivo: schedule.kilometrajeObjetivo,
          observacion: input.observacion ? normalizeText(input.observacion) : null,
          prioridad: input.prioridad as PrioridadOrden,
        },
      )

      if (result.status === 'NOT_FOUND' || !result.programacion || !result.orden) {
        throw new AppError(404, 'PREVENTIVE_SCHEDULE_NOT_FOUND', 'Programacion no encontrada')
      }

      return {
        orden: mapOrder(result.orden)!,
        programacion: this.mapSchedule(result.programacion),
        yaExistia: result.status === 'ALREADY_GENERATED',
      }
    } catch (error) {
      if (isPrismaDuplicate(error)) {
        const [reloadedSchedule, order] = await Promise.all([
          this.preventiveRepository.findScheduleById(programacionId),
          this.preventiveRepository.findExistingActiveOrderBySchedule(programacionId),
        ])

        if (reloadedSchedule && order) {
          return {
            orden: mapOrder(order)!,
            programacion: this.mapSchedule(reloadedSchedule),
            yaExistia: true,
          }
        }
      }

      translatePrismaError(error)
    }
  }

  async getSchedule(programacionId: string, actor: AuthenticatedUser) {
    ensureAdmin(actor)

    const schedule = await this.preventiveRepository.findScheduleById(programacionId)

    if (!schedule) {
      throw new AppError(404, 'PREVENTIVE_SCHEDULE_NOT_FOUND', 'Programacion no encontrada')
    }

    return {
      programacion: this.mapSchedule(schedule),
    }
  }

  async listSchedules(
    query: ListPreventiveSchedulesQuery,
    actor: AuthenticatedUser,
  ): Promise<PreventiveListDto> {
    ensureAdmin(actor)

    const records = await this.preventiveRepository.listSchedules(this.createWhere(query))
    const mapped = records.map((schedule) => this.mapSchedule(schedule))
    const filtered = query.estado
      ? mapped.filter((schedule) => schedule.clasificacion.estado === query.estado)
      : mapped
    const sorted = this.sortSchedules(filtered, query)
    const total = sorted.length
    const start = (query.pagina - 1) * query.limite
    const programaciones = sorted.slice(start, start + query.limite)

    return {
      paginacion: {
        limite: query.limite,
        pagina: query.pagina,
        total,
        totalPaginas: Math.max(1, Math.ceil(total / query.limite)),
      },
      programaciones,
    }
  }

  async summarize(actor: AuthenticatedUser): Promise<PreventiveSummaryDto> {
    ensureAdmin(actor)

    const [records, ordenesActivas] = await Promise.all([
      this.preventiveRepository.listSchedules({}),
      this.preventiveRepository.countActiveOrders(),
    ])
    const estados = { ...classificationDefaults }
    let activas = 0
    let elegiblesParaOrden = 0

    for (const schedule of records) {
      const classification = this.classify(schedule)
      estados[classification.estado] += 1

      if (schedule.activa) {
        activas += 1
      }

      if (
        schedule.activa &&
        classification.estado !== 'VIGENTE' &&
        schedule.ordenesTrabajo.length === 0
      ) {
        elegiblesParaOrden += 1
      }
    }

    return {
      activas,
      elegiblesParaOrden,
      estados,
      inactivas: records.length - activas,
      ordenesActivas,
      total: records.length,
      umbrales: {
        dias: env.PREVENTIVE_SOON_DAYS,
        kilometros: env.PREVENTIVE_SOON_KM,
      },
    }
  }

  async updateSchedule(
    programacionId: string,
    input: UpdatePreventiveScheduleInput,
    actor: AuthenticatedUser,
  ) {
    ensureAdmin(actor)

    const schedule = await this.preventiveRepository.findScheduleById(programacionId)

    if (!schedule) {
      throw new AppError(404, 'PREVENTIVE_SCHEDULE_NOT_FOUND', 'Programacion no encontrada')
    }

    if (schedule.ordenesTrabajo.length > 0) {
      throw new AppError(
        400,
        'PREVENTIVE_SCHEDULE_LOCKED_BY_ORDER',
        'La programacion ya tiene una orden preventiva activa y no puede modificarse',
      )
    }

    const data = this.prepareUpdateData(schedule, input)

    if (data.activa && schedule.bus.estadoOperativo === 'INACTIVO') {
      throw new AppError(400, 'BUS_NOT_ELIGIBLE', 'No se puede reactivar un bus inactivo')
    }

    const duplicate = await this.preventiveRepository.findLogicalDuplicate(
      { ...data, busId: schedule.busId },
      programacionId,
    )

    if (duplicate) {
      throw new AppError(
        409,
        'DUPLICATE_PREVENTIVE_SCHEDULE',
        'Ya existe una programacion preventiva activa con los mismos criterios',
      )
    }

    try {
      const updated = await this.preventiveRepository.updateSchedule(programacionId, data)

      return {
        programacion: this.mapSchedule(updated),
      }
    } catch (error) {
      translatePrismaError(error)
    }
  }

  private classify(schedule: PreventiveScheduleRecord) {
    return classifyPreventiveSchedule({
      fechaProgramada: schedule.fechaProgramada,
      kilometrajeActual: schedule.bus.kilometrajeActual,
      kilometrajeObjetivo: schedule.kilometrajeObjetivo,
      thresholds: {
        soonDays: env.PREVENTIVE_SOON_DAYS,
        soonKm: env.PREVENTIVE_SOON_KM,
        timeZone,
      },
    })
  }

  private createWhere(
    query: ListPreventiveSchedulesQuery,
  ): Prisma.ProgramacionMantenimientoWhereInput {
    const filters: Prisma.ProgramacionMantenimientoWhereInput[] = []

    if (query.activa !== undefined) {
      filters.push({ activa: query.activa })
    }

    if (query.busId) {
      filters.push({ busId: query.busId })
    }

    if (query.criterio) {
      filters.push({ criterio: query.criterio })
    }

    if (query.busqueda) {
      filters.push({
        OR: [
          {
            tipo: {
              contains: query.busqueda,
              mode: 'insensitive',
            },
          },
          {
            actividad: {
              contains: query.busqueda,
              mode: 'insensitive',
            },
          },
          {
            bus: {
              codigoInterno: {
                contains: query.busqueda,
                mode: 'insensitive',
              },
            },
          },
          {
            bus: {
              placa: {
                contains: query.busqueda,
                mode: 'insensitive',
              },
            },
          },
        ],
      })
    }

    return filters.length > 0 ? { AND: filters } : {}
  }

  private mapSchedule(schedule: PreventiveScheduleRecord): PreventiveScheduleDto {
    return {
      activa: schedule.activa,
      actividad: schedule.actividad,
      bus: {
        anio: schedule.bus.anio,
        codigoInterno: schedule.bus.codigoInterno,
        estadoOperativo: schedule.bus.estadoOperativo,
        id: schedule.bus.id,
        kilometrajeActual: schedule.bus.kilometrajeActual,
        marca: schedule.bus.marca,
        modelo: schedule.bus.modelo,
        placa: schedule.bus.placa,
      },
      clasificacion: this.classify(schedule),
      creadaPor: mapUser(schedule.creadaPor),
      createdAt: schedule.createdAt.toISOString(),
      criterio: schedule.criterio,
      fechaProgramada: dateColumnToIsoDate(schedule.fechaProgramada),
      id: schedule.id,
      kilometrajeObjetivo: schedule.kilometrajeObjetivo,
      ordenActiva: mapOrder(schedule.ordenesTrabajo[0]),
      tipo: schedule.tipo,
      updatedAt: schedule.updatedAt.toISOString(),
    }
  }

  private prepareCreateData(input: CreatePreventiveScheduleInput): PreparedScheduleData {
    return {
      actividad: normalizeText(input.actividad),
      busId: input.busId,
      criterio: input.criterio,
      fechaProgramada: input.fechaProgramada ? dateOnlyToUtc(input.fechaProgramada) : null,
      kilometrajeObjetivo: input.kilometrajeObjetivo ?? null,
      tipo: normalizeText(input.tipo),
    }
  }

  private prepareUpdateData(
    schedule: PreventiveScheduleRecord,
    input: UpdatePreventiveScheduleInput,
  ): PreparedScheduleData & { activa?: boolean } {
    const criterio = input.criterio ?? schedule.criterio
    const tipo = input.tipo !== undefined ? normalizeText(input.tipo) : schedule.tipo
    const actividad =
      input.actividad !== undefined ? normalizeText(input.actividad) : schedule.actividad
    let fechaProgramada =
      input.fechaProgramada !== undefined
        ? dateOnlyToUtc(input.fechaProgramada)
        : schedule.fechaProgramada
    let kilometrajeObjetivo =
      input.kilometrajeObjetivo !== undefined
        ? input.kilometrajeObjetivo
        : schedule.kilometrajeObjetivo

    if (criterio === 'FECHA') {
      kilometrajeObjetivo = null
    }

    if (criterio === 'KILOMETRAJE') {
      fechaProgramada = null
    }

    if (criterio === 'FECHA' && !fechaProgramada) {
      throw new AppError(400, 'INVALID_PREVENTIVE_CRITERIA', 'La fecha programada es obligatoria')
    }

    if (criterio === 'KILOMETRAJE' && kilometrajeObjetivo === null) {
      throw new AppError(
        400,
        'INVALID_PREVENTIVE_CRITERIA',
        'El kilometraje objetivo es obligatorio',
      )
    }

    if (criterio === 'FECHA_KILOMETRAJE' && (!fechaProgramada || kilometrajeObjetivo === null)) {
      throw new AppError(
        400,
        'INVALID_PREVENTIVE_CRITERIA',
        'La programacion combinada requiere fecha y kilometraje objetivo',
      )
    }

    return {
      ...(input.activa !== undefined ? { activa: input.activa } : {}),
      actividad,
      busId: schedule.busId,
      criterio,
      fechaProgramada,
      kilometrajeObjetivo,
      tipo,
    }
  }

  private sortSchedules(
    programaciones: PreventiveScheduleDto[],
    query: ListPreventiveSchedulesQuery,
  ) {
    const direction = query.direccion === 'asc' ? 1 : -1
    const sorted = [...programaciones]

    sorted.sort((a, b) => {
      const result = (() => {
        if (query.ordenarPor === 'actividad') {
          return a.actividad.localeCompare(b.actividad)
        }

        if (query.ordenarPor === 'bus') {
          return a.bus.codigoInterno.localeCompare(b.bus.codigoInterno)
        }

        if (query.ordenarPor === 'estado') {
          return a.clasificacion.estado.localeCompare(b.clasificacion.estado)
        }

        if (query.ordenarPor === 'fechaProgramada') {
          return compareNullableString(a.fechaProgramada, b.fechaProgramada)
        }

        if (query.ordenarPor === 'kilometrajeObjetivo') {
          return compareNullableNumber(a.kilometrajeObjetivo, b.kilometrajeObjetivo)
        }

        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      })()

      return result * direction
    })

    return sorted
  }
}
