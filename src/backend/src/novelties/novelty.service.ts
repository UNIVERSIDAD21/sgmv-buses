import { Prisma, type EstadoNovedad, type PrioridadOrden } from '@prisma/client'

import type { AuthenticatedUser } from '../auth/auth.types.js'
import { AppError } from '../shared/http.js'
import {
  NoveltyRepository,
  type NoveltyRecord,
  type WorkOrderRecord,
} from './novelty.repository.js'
import type {
  ConvertNoveltyInput,
  CreateNoveltyInput,
  ListNoveltiesQuery,
  ReviewNoveltyInput,
} from './novelty.schemas.js'
import type {
  NoveltyDto,
  NoveltyListDto,
  NoveltySummaryDto,
  NoveltyUserDto,
  WorkOrderSummaryDto,
} from './novelty.types.js'

const noveltyStatusDefaults: Record<EstadoNovedad, number> = {
  CONVERTIDA_A_ORDEN: 0,
  DESCARTADA: 0,
  PENDIENTE_REVISION: 0,
  RESUELTA_SIN_ORDEN: 0,
}

interface UserRecord {
  email: string
  id: string
  nombre: string
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function mapUser(user: UserRecord, includeEmail: boolean): NoveltyUserDto {
  return {
    ...(includeEmail ? { email: user.email } : {}),
    id: user.id,
    nombre: user.nombre,
  }
}

function mapWorkOrder(order: WorkOrderRecord | null | undefined): WorkOrderSummaryDto | null {
  if (!order) {
    return null
  }

  return {
    codigo: order.codigo,
    descripcion: order.descripcion,
    estado: order.estado,
    fechaCreacion: order.fechaCreacion.toISOString(),
    id: order.id,
    origen: 'NOVEDAD',
    prioridad: order.prioridad,
    tipo: 'CORRECTIVA',
  }
}

function mapNovelty(novelty: NoveltyRecord, includeAdministrativeData: boolean): NoveltyDto {
  return {
    bus: {
      codigoInterno: novelty.bus.codigoInterno,
      estadoOperativo: novelty.bus.estadoOperativo,
      id: novelty.bus.id,
      placa: novelty.bus.placa,
    },
    clasificacion: novelty.clasificacion,
    conductor: mapUser(novelty.conductor, includeAdministrativeData),
    descripcion: novelty.descripcion,
    estado: novelty.estado,
    fechaReporte: novelty.fechaReporte.toISOString(),
    fechaRevision: novelty.fechaRevision?.toISOString() ?? null,
    id: novelty.id,
    observacionRevision: novelty.observacionRevision,
    ordenTrabajo: mapWorkOrder(novelty.ordenTrabajo),
    revisadaPor: novelty.revisadaPor
      ? mapUser(novelty.revisadaPor, includeAdministrativeData)
      : null,
    tipo: novelty.tipo,
    updatedAt: novelty.updatedAt.toISOString(),
  }
}

function ensureAdmin(actor: AuthenticatedUser) {
  if (actor.rol.codigo !== 'ADMIN_SUPERVISOR') {
    throw new AppError(403, 'FORBIDDEN', 'No tiene permisos para realizar esta operacion')
  }
}

function ensureDriver(actor: AuthenticatedUser) {
  if (actor.rol.codigo !== 'CONDUCTOR_OPERADOR') {
    throw new AppError(403, 'FORBIDDEN', 'No tiene permisos para realizar esta operacion')
  }
}

function translatePrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new AppError(409, 'DUPLICATE_ORDER', 'La novedad ya tiene una orden asociada')
    }

    if (error.code === 'P2025') {
      throw new AppError(404, 'NOVELTY_NOT_FOUND', 'Novedad no encontrada')
    }
  }

  throw error
}

export class NoveltyService {
  constructor(private readonly noveltyRepository = new NoveltyRepository()) {}

  async convertToCorrectiveOrder(
    noveltyId: string,
    input: ConvertNoveltyInput,
    actor: AuthenticatedUser,
  ) {
    ensureAdmin(actor)

    const descripcionOrden =
      input.descripcionOrden?.trim() ||
      'Orden correctiva generada desde novedad operativa pendiente de revision.'

    try {
      const result = await this.noveltyRepository.convertToCorrectiveOrder(noveltyId, actor.id, {
        descripcionOrden: normalizeText(descripcionOrden),
        observacion: input.observacion ? normalizeText(input.observacion) : null,
        prioridad: input.prioridad as PrioridadOrden,
      })

      if (result.status === 'NOT_FOUND') {
        throw new AppError(404, 'NOVELTY_NOT_FOUND', 'Novedad no encontrada')
      }

      if (result.status === 'TERMINAL_STATE') {
        throw new AppError(
          400,
          'NOVELTY_TERMINAL_STATE',
          'La novedad ya fue cerrada y no puede convertirse',
        )
      }

      return {
        novedad: mapNovelty(result.novedad, true),
        orden: mapWorkOrder(result.orden),
        yaExistia: result.status === 'ALREADY_CONVERTED',
      }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        String(error.meta?.target ?? '').includes('novedad')
      ) {
        const novelty = await this.noveltyRepository.findNoveltyById(noveltyId)
        const order = await this.noveltyRepository.findExistingOrderByNovelty(noveltyId)

        if (novelty && order) {
          return {
            novedad: mapNovelty(novelty, true),
            orden: mapWorkOrder(order),
            yaExistia: true,
          }
        }
      }

      translatePrismaError(error)
    }
  }

  async createNovelty(input: CreateNoveltyInput, actor: AuthenticatedUser) {
    ensureDriver(actor)

    const assignment = await this.noveltyRepository.findActiveAssignmentWithBusByConductor(actor.id)

    if (!assignment) {
      throw new AppError(
        400,
        'DRIVER_WITHOUT_ACTIVE_BUS',
        'No tiene una asignacion activa para registrar novedades',
      )
    }

    const novelty = await this.noveltyRepository.createNovelty({
      busId: assignment.busId,
      conductorId: actor.id,
      descripcion: normalizeText(input.descripcion),
      tipo: normalizeText(input.tipo),
    })

    return {
      novedad: mapNovelty(novelty, false),
    }
  }

  async getAdminNovelty(noveltyId: string, actor: AuthenticatedUser) {
    ensureAdmin(actor)

    const novelty = await this.noveltyRepository.findNoveltyById(noveltyId)

    if (!novelty) {
      throw new AppError(404, 'NOVELTY_NOT_FOUND', 'Novedad no encontrada')
    }

    return {
      novedad: mapNovelty(novelty, true),
    }
  }

  async getOwnNovelty(noveltyId: string, actor: AuthenticatedUser) {
    ensureDriver(actor)

    const novelty = await this.noveltyRepository.findNoveltyById(noveltyId)

    if (!novelty) {
      throw new AppError(404, 'NOVELTY_NOT_FOUND', 'Novedad no encontrada')
    }

    if (novelty.conductorId !== actor.id) {
      throw new AppError(403, 'FORBIDDEN', 'No puede consultar novedades de otro conductor')
    }

    return {
      novedad: mapNovelty(novelty, false),
    }
  }

  async listAdminNovelties(
    query: ListNoveltiesQuery,
    actor: AuthenticatedUser,
  ): Promise<NoveltyListDto> {
    ensureAdmin(actor)

    return this.listNovelties(query, true)
  }

  async listOwnNovelties(
    query: ListNoveltiesQuery,
    actor: AuthenticatedUser,
  ): Promise<NoveltyListDto> {
    ensureDriver(actor)

    return this.listNovelties(query, false, actor.id)
  }

  async reviewNovelty(noveltyId: string, input: ReviewNoveltyInput, actor: AuthenticatedUser) {
    ensureAdmin(actor)

    const stateByAction: Record<ReviewNoveltyInput['accion'], EstadoNovedad | undefined> = {
      CLASIFICAR: undefined,
      DESCARTAR: 'DESCARTADA',
      RESOLVER_SIN_ORDEN: 'RESUELTA_SIN_ORDEN',
    }

    const result = await this.noveltyRepository.reviewPendingNovelty(noveltyId, {
      clasificacion: input.clasificacion ? normalizeText(input.clasificacion) : undefined,
      estado: stateByAction[input.accion],
      observacionRevision: input.observacion ? normalizeText(input.observacion) : undefined,
      revisadaPorId: actor.id,
    })

    if (result.status === 'NOT_FOUND') {
      throw new AppError(404, 'NOVELTY_NOT_FOUND', 'Novedad no encontrada')
    }

    if (result.status === 'TERMINAL_STATE') {
      throw new AppError(400, 'NOVELTY_TERMINAL_STATE', 'La novedad ya esta cerrada')
    }

    return {
      novedad: mapNovelty(result.novedad, true),
    }
  }

  async summarize(actor: AuthenticatedUser): Promise<NoveltySummaryDto> {
    ensureAdmin(actor)

    const [total, grouped, ordenesGeneradas] = await Promise.all([
      this.noveltyRepository.countNovelties(),
      this.noveltyRepository.countNoveltiesByStatus(),
      this.noveltyRepository.countOrdersGenerated(),
    ])
    const estados = { ...noveltyStatusDefaults }

    for (const group of grouped) {
      estados[group.estado] = group._count._all
    }

    return {
      estados,
      ordenesGeneradas,
      pendientes: estados.PENDIENTE_REVISION,
      total,
    }
  }

  private createWhere(query: ListNoveltiesQuery, conductorId?: string): Prisma.NovedadWhereInput {
    const filters: Prisma.NovedadWhereInput[] = []

    if (conductorId) {
      filters.push({ conductorId })
    }

    if (query.estado) {
      filters.push({ estado: query.estado })
    }

    if (query.tipo) {
      filters.push({
        tipo: {
          contains: query.tipo,
          mode: 'insensitive',
        },
      })
    }

    if (query.clasificacion) {
      filters.push({
        clasificacion: {
          contains: query.clasificacion,
          mode: 'insensitive',
        },
      })
    }

    if (query.prioridad) {
      filters.push({
        ordenTrabajo: {
          prioridad: query.prioridad,
        },
      })
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
            descripcion: {
              contains: query.busqueda,
              mode: 'insensitive',
            },
          },
          {
            clasificacion: {
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
          {
            conductor: {
              nombre: {
                contains: query.busqueda,
                mode: 'insensitive',
              },
            },
          },
          {
            ordenTrabajo: {
              codigo: {
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

  private async listNovelties(
    query: ListNoveltiesQuery,
    includeAdministrativeData: boolean,
    conductorId?: string,
  ) {
    const where = this.createWhere(query, conductorId)
    const skip = (query.pagina - 1) * query.limite
    const [total, novedades] = await Promise.all([
      this.noveltyRepository.countNovelties(where),
      this.noveltyRepository.listNovelties(where, skip, query.limite),
    ])

    return {
      novedades: novedades.map((novelty) => mapNovelty(novelty, includeAdministrativeData)),
      paginacion: {
        limite: query.limite,
        pagina: query.pagina,
        total,
        totalPaginas: Math.max(1, Math.ceil(total / query.limite)),
      },
    }
  }
}
