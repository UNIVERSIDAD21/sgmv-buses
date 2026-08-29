import { Prisma, type TipoMovimientoInventario } from '@prisma/client'

import type { AuthenticatedUser } from '../auth/auth.types.js'
import { AppError } from '../shared/http.js'
import { classifySparePartAvailability } from './spare-part.availability.js'
import type {
  CreateSparePartInput,
  ListInventoryMovementsQuery,
  ListSparePartsQuery,
  StockAdjustmentInput,
  StockEntryInput,
  UpdateSparePartInput,
} from './spare-part.schemas.js'
import {
  SparePartRepository,
  type SparePartMovementRecord,
  type SparePartRecord,
} from './spare-part.repository.js'
import type {
  SparePartDto,
  SparePartListDto,
  SparePartMovementDto,
  SparePartMovementListDto,
  SparePartOperationDto,
  SparePartSummaryDto,
  SparePartSummaryItemDto,
  SparePartUserDto,
} from './spare-part.types.js'

function ensureAdmin(actor: AuthenticatedUser) {
  if (actor.rol.codigo !== 'ADMINISTRADOR') {
    throw new AppError(403, 'FORBIDDEN', 'No tiene permisos para administrar repuestos')
  }
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeOptionalText(value: string | undefined) {
  return value ? normalizeText(value) : undefined
}

function normalizeCode(value: string) {
  return normalizeText(value).toUpperCase()
}

function decimalToString(value: Prisma.Decimal.Value) {
  return new Prisma.Decimal(value).toFixed(2)
}

function mapUser(user: SparePartUserDto): SparePartUserDto {
  return {
    email: user.email,
    id: user.id,
    nombre: user.nombre,
    telefono: user.telefono,
  }
}

function mapSparePartSummary(part: SparePartRecord): SparePartSummaryItemDto {
  const stockActual = new Prisma.Decimal(part.stockActual)
  const costoUnitario = new Prisma.Decimal(part.costoUnitario)

  return {
    categoria: part.categoria,
    codigo: part.codigo,
    costoUnitario: decimalToString(part.costoUnitario),
    disponibilidad: classifySparePartAvailability(part),
    estado: part.estado,
    id: part.id,
    nombre: part.nombre,
    stockActual: decimalToString(part.stockActual),
    stockMinimo: decimalToString(part.stockMinimo),
    unidadMedida: part.unidadMedida,
    valorActual: stockActual.mul(costoUnitario).toDecimalPlaces(2).toFixed(2),
  }
}

function mapSparePart(part: SparePartRecord): SparePartDto {
  return {
    ...mapSparePartSummary(part),
    createdAt: part.createdAt.toISOString(),
    updatedAt: part.updatedAt.toISOString(),
  }
}

function movementDirection(tipo: TipoMovimientoInventario): 'ENTRADA' | 'SALIDA' {
  return tipo === 'CONSUMO' || tipo === 'AJUSTE_SALIDA' ? 'SALIDA' : 'ENTRADA'
}

function mapMovement(movement: SparePartMovementRecord): SparePartMovementDto {
  return {
    cantidad: decimalToString(movement.cantidad),
    consumo: movement.consumoRepuesto
      ? {
          id: movement.consumoRepuesto.id,
          orden: movement.consumoRepuesto.ordenTrabajo,
        }
      : null,
    costoUnitario: movement.costoUnitario ? decimalToString(movement.costoUnitario) : null,
    direccion: movementDirection(movement.tipo),
    fechaMovimiento: movement.fechaMovimiento.toISOString(),
    id: movement.id,
    motivo: movement.motivo,
    repuesto: mapSparePartSummary(movement.repuesto),
    responsable: mapUser(movement.responsable),
    tipo: movement.tipo,
  }
}

function totalPages(total: number, limit: number) {
  return Math.max(1, Math.ceil(total / limit))
}

function isUniqueError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

function targetText(error: Prisma.PrismaClientKnownRequestError) {
  const target = error.meta?.target

  if (Array.isArray(target)) {
    return target.join(',')
  }

  return String(target ?? '')
}

function isSparePartCodeDuplicate(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    (targetText(error).includes('codigo') ||
      targetText(error).includes('ux_repuestos_codigo_upper'))
  )
}

function isMovementIdempotencyDuplicate(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    targetText(error).includes('clave_idempotencia')
  )
}

export class SparePartService {
  constructor(private readonly sparePartRepository = new SparePartRepository()) {}

  async summarize(actor: AuthenticatedUser): Promise<SparePartSummaryDto> {
    ensureAdmin(actor)

    const summary = await this.sparePartRepository.summarize()

    return {
      agotados: summary.agotados,
      bajoStock: summary.bajoStock,
      disponibles: summary.disponibles,
      inactivos: summary.inactivos,
      movimientosRecientes: summary.movimientosRecientes.map(mapMovement),
      totalActivos: summary.totalActivos,
      totalRepuestos: summary.totalRepuestos,
      valorInventario: decimalToString(summary.valorInventario),
    }
  }

  async list(query: ListSparePartsQuery, actor: AuthenticatedUser): Promise<SparePartListDto> {
    ensureAdmin(actor)

    const result = await this.sparePartRepository.listSpareParts({
      ...query,
      busqueda: normalizeOptionalText(query.busqueda),
      categoria: normalizeOptionalText(query.categoria),
    })

    return {
      paginacion: {
        limite: query.limite,
        pagina: query.pagina,
        total: result.total,
        totalPaginas: totalPages(result.total, query.limite),
      },
      repuestos: result.repuestos.map(mapSparePart),
    }
  }

  async getById(repuestoId: string, actor: AuthenticatedUser) {
    ensureAdmin(actor)

    const repuesto = await this.sparePartRepository.findSparePartById(repuestoId)

    if (!repuesto) {
      throw new AppError(404, 'SPARE_PART_NOT_FOUND', 'Repuesto no encontrado')
    }

    return {
      repuesto: mapSparePart(repuesto),
    }
  }

  async create(input: CreateSparePartInput, actor: AuthenticatedUser) {
    ensureAdmin(actor)

    const normalized: CreateSparePartInput = {
      ...input,
      categoria: normalizeOptionalText(input.categoria),
      codigo: normalizeCode(input.codigo),
      motivoStockInicial: normalizeOptionalText(input.motivoStockInicial),
      nombre: normalizeText(input.nombre),
      unidadMedida: normalizeText(input.unidadMedida),
    }

    try {
      const result = await this.sparePartRepository.createSparePart(actor.id, normalized)

      if (result.status === 'IDEMPOTENCY_CONFLICT') {
        throw new AppError(
          409,
          'IDEMPOTENCY_CONFLICT',
          'La clave de idempotencia ya fue usada en otra operacion',
        )
      }

      if (!result.repuesto) {
        throw new AppError(500, 'SPARE_PART_NOT_CREATED', 'No fue posible crear el repuesto')
      }

      return {
        movimientoInicial: result.movimiento ? mapMovement(result.movimiento) : null,
        repuesto: mapSparePart(result.repuesto),
        yaExistia: result.status === 'ALREADY_APPLIED',
      }
    } catch (error) {
      if (isMovementIdempotencyDuplicate(error) && normalized.claveIdempotencia) {
        const existing = await this.sparePartRepository.findMovementByIdempotencyKey(
          normalized.claveIdempotencia,
        )

        if (
          existing &&
          existing.tipo === 'ENTRADA' &&
          existing.responsableId === actor.id &&
          existing.repuesto.codigo === normalized.codigo
        ) {
          return {
            movimientoInicial: mapMovement(existing),
            repuesto: mapSparePart(existing.repuesto),
            yaExistia: true,
          }
        }
      }

      if (isSparePartCodeDuplicate(error)) {
        throw new AppError(409, 'DUPLICATE_SPARE_PART_CODE', 'Ya existe un repuesto con ese codigo')
      }

      if (isUniqueError(error)) {
        throw new AppError(409, 'DUPLICATE_VALUE', 'Ya existe un registro con esos datos')
      }

      throw error
    }
  }

  async update(repuestoId: string, input: UpdateSparePartInput, actor: AuthenticatedUser) {
    ensureAdmin(actor)

    const normalized: UpdateSparePartInput = {
      ...input,
      categoria: normalizeOptionalText(input.categoria),
      codigo: input.codigo ? normalizeCode(input.codigo) : undefined,
      nombre: input.nombre ? normalizeText(input.nombre) : undefined,
      unidadMedida: input.unidadMedida ? normalizeText(input.unidadMedida) : undefined,
    }

    try {
      const result = await this.sparePartRepository.updateSparePart(repuestoId, normalized)

      if (result.status === 'SPARE_PART_NOT_FOUND') {
        throw new AppError(404, 'SPARE_PART_NOT_FOUND', 'Repuesto no encontrado')
      }

      if (result.status === 'CODE_LOCKED') {
        throw new AppError(
          409,
          'SPARE_PART_CODE_LOCKED',
          'El codigo no puede cambiar porque el repuesto ya tiene movimientos o consumos',
        )
      }

      return {
        repuesto: mapSparePart(result.repuesto!),
      }
    } catch (error) {
      if (isSparePartCodeDuplicate(error)) {
        throw new AppError(409, 'DUPLICATE_SPARE_PART_CODE', 'Ya existe un repuesto con ese codigo')
      }

      throw error
    }
  }

  async activate(repuestoId: string, actor: AuthenticatedUser) {
    ensureAdmin(actor)

    return this.setStatus(repuestoId, 'ACTIVO')
  }

  async deactivate(repuestoId: string, actor: AuthenticatedUser) {
    ensureAdmin(actor)

    return this.setStatus(repuestoId, 'INACTIVO')
  }

  async registerEntry(repuestoId: string, input: StockEntryInput, actor: AuthenticatedUser) {
    ensureAdmin(actor)

    return this.mapStockOperation(
      await this.applyOperationWithIdempotency(
        () =>
          this.sparePartRepository.registerEntry(repuestoId, actor.id, {
            ...input,
            motivo: normalizeText(input.motivo),
          }),
        input.claveIdempotencia,
        actor.id,
        repuestoId,
        'ENTRADA',
      ),
    )
  }

  async registerAdjustment(
    repuestoId: string,
    input: StockAdjustmentInput,
    actor: AuthenticatedUser,
  ) {
    ensureAdmin(actor)

    const tipo = input.direccion === 'INCREMENTO' ? 'AJUSTE_ENTRADA' : 'AJUSTE_SALIDA'

    return this.mapStockOperation(
      await this.applyOperationWithIdempotency(
        () =>
          this.sparePartRepository.registerAdjustment(repuestoId, actor.id, {
            ...input,
            motivo: normalizeText(input.motivo),
          }),
        input.claveIdempotencia,
        actor.id,
        repuestoId,
        tipo,
      ),
    )
  }

  async listMovements(
    query: ListInventoryMovementsQuery,
    actor: AuthenticatedUser,
    repuestoId?: string,
  ): Promise<SparePartMovementListDto> {
    ensureAdmin(actor)

    if (repuestoId) {
      const repuesto = await this.sparePartRepository.findSparePartById(repuestoId)

      if (!repuesto) {
        throw new AppError(404, 'SPARE_PART_NOT_FOUND', 'Repuesto no encontrado')
      }
    }

    const normalizedQuery = {
      ...query,
      busqueda: normalizeOptionalText(query.busqueda),
    }
    const result = await this.sparePartRepository.listMovements(normalizedQuery, repuestoId)

    return {
      movimientos: result.movimientos.map(mapMovement),
      paginacion: {
        limite: query.limite,
        pagina: query.pagina,
        total: result.total,
        totalPaginas: totalPages(result.total, query.limite),
      },
    }
  }

  private async setStatus(repuestoId: string, estado: 'ACTIVO' | 'INACTIVO') {
    const result = await this.sparePartRepository.setSparePartStatus(repuestoId, estado)

    if (result.status === 'SPARE_PART_NOT_FOUND') {
      throw new AppError(404, 'SPARE_PART_NOT_FOUND', 'Repuesto no encontrado')
    }

    return {
      repuesto: mapSparePart(result.repuesto!),
      yaExistia: result.status === 'ALREADY_SET',
    }
  }

  private async applyOperationWithIdempotency(
    operation: () => Promise<{
      movimiento: SparePartMovementRecord | null
      repuesto: SparePartRecord | null
      status: string
      stockAnterior: Prisma.Decimal | null
    }>,
    claveIdempotencia: string,
    actorId: string,
    repuestoId: string,
    tipo: Exclude<TipoMovimientoInventario, 'CONSUMO'>,
  ) {
    try {
      return await operation()
    } catch (error) {
      if (isMovementIdempotencyDuplicate(error)) {
        const existing =
          await this.sparePartRepository.findMovementByIdempotencyKey(claveIdempotencia)

        if (
          existing &&
          existing.repuestoId === repuestoId &&
          existing.responsableId === actorId &&
          existing.tipo === tipo
        ) {
          return {
            movimiento: existing,
            repuesto: existing.repuesto,
            status: 'ALREADY_APPLIED',
            stockAnterior: null,
          }
        }
      }

      throw error
    }
  }

  private mapStockOperation(result: {
    movimiento: SparePartMovementRecord | null
    repuesto: SparePartRecord | null
    status: string
    stockAnterior: Prisma.Decimal | null
  }): SparePartOperationDto {
    if (result.status === 'SPARE_PART_NOT_FOUND') {
      throw new AppError(404, 'SPARE_PART_NOT_FOUND', 'Repuesto no encontrado')
    }

    if (result.status === 'SPARE_PART_INACTIVE') {
      throw new AppError(
        409,
        'SPARE_PART_INACTIVE',
        'Debe reactivar el repuesto antes de registrar entradas o ajustes',
      )
    }

    if (result.status === 'INSUFFICIENT_STOCK') {
      throw new AppError(409, 'INSUFFICIENT_STOCK', 'El ajuste supera la existencia disponible')
    }

    if (result.status === 'IDEMPOTENCY_CONFLICT') {
      throw new AppError(
        409,
        'IDEMPOTENCY_CONFLICT',
        'La clave de idempotencia ya fue usada en otra operacion',
      )
    }

    if (!result.repuesto) {
      throw new AppError(500, 'SPARE_PART_OPERATION_FAILED', 'No fue posible aplicar la operacion')
    }

    return {
      cantidadAplicada: result.movimiento ? decimalToString(result.movimiento.cantidad) : '0.00',
      movimiento: result.movimiento ? mapMovement(result.movimiento) : null,
      repuesto: mapSparePart(result.repuesto),
      stockAnterior: result.stockAnterior ? decimalToString(result.stockAnterior) : null,
      stockResultante: decimalToString(result.repuesto.stockActual),
      yaExistia: result.status === 'ALREADY_APPLIED',
    }
  }
}
