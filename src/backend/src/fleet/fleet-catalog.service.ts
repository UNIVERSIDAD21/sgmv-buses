import { Prisma } from '@prisma/client'

import type { AuthenticatedUser } from '../auth/auth.types.js'
import { AppError } from '../shared/http.js'
import {
  FleetCatalogRepository,
  type ModeloBusRecord,
  type RutaRecord,
} from './fleet-catalog.repository.js'
import type {
  CatalogListQuery,
  CreateModeloBusInput,
  CreateRutaInput,
  UpdateModeloBusInput,
  UpdateRutaInput,
} from './fleet-catalog.schemas.js'
import type { ModeloBusDetailDto, ModeloBusSummaryDto, RutaDto } from './fleet-catalog.types.js'

function ensureAdmin(actor: AuthenticatedUser) {
  if (actor.rol.codigo !== 'ADMINISTRADOR') {
    throw new AppError(403, 'FORBIDDEN', 'No tiene permisos para realizar esta operacion')
  }
}

function ensureAdminOrDispatcher(actor: AuthenticatedUser) {
  if (actor.rol.codigo !== 'ADMINISTRADOR' && actor.rol.codigo !== 'DESPACHADOR') {
    throw new AppError(403, 'FORBIDDEN', 'No tiene permisos para realizar esta operacion')
  }
}

function normalizeIdentifier(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeOptionalText(value: string | null | undefined) {
  if (value === null || value === undefined) return null
  return normalizeText(value)
}

function mapModeloBusSummary(modelo: ModeloBusRecord): ModeloBusSummaryDto {
  return {
    activo: modelo.activo,
    busesAsociados: modelo._count.buses,
    id: modelo.id,
    marca: modelo.marca,
    nombreModelo: modelo.nombreModelo,
    updatedAt: modelo.updatedAt.toISOString(),
    versionTecnica: modelo.versionTecnica,
  }
}

function mapModeloBusDetail(
  modelo: ModeloBusRecord,
  includeSpecifications: boolean,
): ModeloBusDetailDto {
  const detail: ModeloBusDetailDto = {
    ...mapModeloBusSummary(modelo),
    createdAt: modelo.createdAt.toISOString(),
  }

  if (includeSpecifications) {
    detail.especificaciones = modelo.especificaciones as Record<string, unknown>
  }

  return detail
}

function mapRuta(ruta: RutaRecord): RutaDto {
  return {
    activa: ruta.activa,
    codigo: ruta.codigo,
    createdAt: ruta.createdAt.toISOString(),
    destino: ruta.destino,
    id: ruta.id,
    jornadasAsociadas: ruta._count.jornadasOperativas,
    nombre: ruta.nombre,
    origen: ruta.origen,
    updatedAt: ruta.updatedAt.toISOString(),
  }
}

function translateCatalogError(error: unknown, resource: 'MODEL' | 'ROUTE'): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      if (resource === 'MODEL') {
        throw new AppError(
          409,
          'DUPLICATE_BUS_MODEL',
          'Ya existe un modelo de bus con la misma marca, nombre y version tecnica',
        )
      }

      throw new AppError(409, 'DUPLICATE_ROUTE_CODE', 'El codigo de ruta ya esta registrado')
    }

    if (error.code === 'P2025') {
      throw new AppError(
        404,
        resource === 'MODEL' ? 'BUS_MODEL_NOT_FOUND' : 'ROUTE_NOT_FOUND',
        resource === 'MODEL' ? 'Modelo de bus no encontrado' : 'Ruta no encontrada',
      )
    }
  }

  throw error
}

export class FleetCatalogService {
  constructor(private readonly repository = new FleetCatalogRepository()) {}

  async createModeloBus(input: CreateModeloBusInput, actor: AuthenticatedUser) {
    ensureAdmin(actor)

    try {
      const modelo = await this.repository.createModeloBus({
        activo: true,
        especificaciones: input.especificaciones as Prisma.InputJsonObject,
        marca: normalizeText(input.marca),
        nombreModelo: normalizeText(input.nombreModelo),
        versionTecnica: normalizeOptionalText(input.versionTecnica),
      })

      return { modeloBus: mapModeloBusDetail(modelo, true) }
    } catch (error) {
      translateCatalogError(error, 'MODEL')
    }
  }

  async createRuta(input: CreateRutaInput, actor: AuthenticatedUser) {
    ensureAdmin(actor)

    try {
      const ruta = await this.repository.createRuta({
        activa: true,
        codigo: normalizeIdentifier(input.codigo),
        destino: normalizeText(input.destino),
        nombre: normalizeText(input.nombre),
        origen: normalizeText(input.origen),
      })

      return { ruta: mapRuta(ruta) }
    } catch (error) {
      translateCatalogError(error, 'ROUTE')
    }
  }

  async getModeloBus(id: string, actor: AuthenticatedUser) {
    ensureAdminOrDispatcher(actor)
    const modelo = await this.repository.findModeloBusById(id)

    if (!modelo || (actor.rol.codigo === 'DESPACHADOR' && !modelo.activo)) {
      throw new AppError(404, 'BUS_MODEL_NOT_FOUND', 'Modelo de bus no encontrado')
    }

    return {
      modeloBus: mapModeloBusDetail(modelo, actor.rol.codigo === 'ADMINISTRADOR'),
    }
  }

  async getRuta(id: string, actor: AuthenticatedUser) {
    ensureAdminOrDispatcher(actor)
    const ruta = await this.repository.findRutaById(id)

    if (!ruta || (actor.rol.codigo === 'DESPACHADOR' && !ruta.activa)) {
      throw new AppError(404, 'ROUTE_NOT_FOUND', 'Ruta no encontrada')
    }

    return { ruta: mapRuta(ruta) }
  }

  async listModelosBus(query: CatalogListQuery, actor: AuthenticatedUser) {
    ensureAdminOrDispatcher(actor)
    const mayIncludeInactive = actor.rol.codigo === 'ADMINISTRADOR' && query.incluirInactivos
    const where: Prisma.ModeloBusWhereInput = mayIncludeInactive ? {} : { activo: true }

    if (query.busqueda) {
      where.OR = [
        { marca: { contains: query.busqueda, mode: 'insensitive' } },
        { nombreModelo: { contains: query.busqueda, mode: 'insensitive' } },
        { versionTecnica: { contains: query.busqueda, mode: 'insensitive' } },
      ]
    }

    const modelos = await this.repository.listModelosBus(where)

    return { modelosBus: modelos.map(mapModeloBusSummary) }
  }

  async listRutas(query: CatalogListQuery, actor: AuthenticatedUser) {
    ensureAdminOrDispatcher(actor)
    const mayIncludeInactive = actor.rol.codigo === 'ADMINISTRADOR' && query.incluirInactivos
    const where: Prisma.RutaWhereInput = mayIncludeInactive ? {} : { activa: true }

    if (query.busqueda) {
      where.OR = [
        { codigo: { contains: query.busqueda, mode: 'insensitive' } },
        { nombre: { contains: query.busqueda, mode: 'insensitive' } },
        { origen: { contains: query.busqueda, mode: 'insensitive' } },
        { destino: { contains: query.busqueda, mode: 'insensitive' } },
      ]
    }

    const rutas = await this.repository.listRutas(where)

    return { rutas: rutas.map(mapRuta) }
  }

  async setModeloBusActive(id: string, activo: boolean, actor: AuthenticatedUser) {
    ensureAdmin(actor)

    try {
      const current = await this.repository.findModeloBusById(id)

      if (!current) {
        throw new AppError(404, 'BUS_MODEL_NOT_FOUND', 'Modelo de bus no encontrado')
      }

      const modelo =
        current.activo === activo ? current : await this.repository.setModeloBusActive(id, activo)

      return { modeloBus: mapModeloBusDetail(modelo, true) }
    } catch (error) {
      translateCatalogError(error, 'MODEL')
    }
  }

  async setRutaActive(id: string, activa: boolean, actor: AuthenticatedUser) {
    ensureAdmin(actor)

    try {
      const current = await this.repository.findRutaById(id)

      if (!current) {
        throw new AppError(404, 'ROUTE_NOT_FOUND', 'Ruta no encontrada')
      }

      const ruta =
        current.activa === activa ? current : await this.repository.setRutaActive(id, activa)

      return { ruta: mapRuta(ruta) }
    } catch (error) {
      translateCatalogError(error, 'ROUTE')
    }
  }

  async updateModeloBus(id: string, input: UpdateModeloBusInput, actor: AuthenticatedUser) {
    ensureAdmin(actor)
    const data: Prisma.ModeloBusUpdateInput = {}

    if (input.especificaciones !== undefined) {
      data.especificaciones = input.especificaciones as Prisma.InputJsonObject
    }
    if (input.marca !== undefined) data.marca = normalizeText(input.marca)
    if (input.nombreModelo !== undefined) data.nombreModelo = normalizeText(input.nombreModelo)
    if (input.versionTecnica !== undefined) {
      data.versionTecnica = normalizeOptionalText(input.versionTecnica)
    }

    try {
      const modelo = await this.repository.updateModeloBus(id, data)
      return { modeloBus: mapModeloBusDetail(modelo, true) }
    } catch (error) {
      translateCatalogError(error, 'MODEL')
    }
  }

  async updateRuta(id: string, input: UpdateRutaInput, actor: AuthenticatedUser) {
    ensureAdmin(actor)
    const data: Prisma.RutaUpdateInput = {}

    if (input.codigo !== undefined) data.codigo = normalizeIdentifier(input.codigo)
    if (input.destino !== undefined) data.destino = normalizeText(input.destino)
    if (input.nombre !== undefined) data.nombre = normalizeText(input.nombre)
    if (input.origen !== undefined) data.origen = normalizeText(input.origen)

    try {
      const ruta = await this.repository.updateRuta(id, data)
      return { ruta: mapRuta(ruta) }
    } catch (error) {
      translateCatalogError(error, 'ROUTE')
    }
  }
}
