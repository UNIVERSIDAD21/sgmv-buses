import { Prisma, type TipoMovimientoInventario } from '@prisma/client'

import { prisma } from '../prisma/client.js'
import type {
  CreateSparePartInput,
  ListInventoryMovementsQuery,
  ListSparePartsQuery,
  StockAdjustmentInput,
  StockEntryInput,
  UpdateSparePartInput,
} from './spare-part.schemas.js'

type SparePartDbClient = Prisma.TransactionClient | typeof prisma

const userSelect = {
  email: true,
  id: true,
  nombre: true,
  telefono: true,
} as const

const orderSelect = {
  codigo: true,
  estado: true,
  id: true,
  origen: true,
  tipo: true,
} as const

const sparePartSelect = {
  categoria: true,
  codigo: true,
  costoUnitario: true,
  createdAt: true,
  estado: true,
  id: true,
  nombre: true,
  stockActual: true,
  stockMinimo: true,
  unidadMedida: true,
  updatedAt: true,
} as const

const movementInclude = {
  consumoRepuesto: {
    select: {
      id: true,
      ordenTrabajo: {
        select: orderSelect,
      },
    },
  },
  repuesto: {
    select: sparePartSelect,
  },
  responsable: {
    select: userSelect,
  },
} as const

export type SparePartRecord = Prisma.RepuestoGetPayload<{
  select: typeof sparePartSelect
}>

export type SparePartMovementRecord = Prisma.MovimientoInventarioGetPayload<{
  include: typeof movementInclude
}>

interface StockOperationData {
  cantidad: Prisma.Decimal
  claveIdempotencia: string
  costoUnitario?: Prisma.Decimal
  direccion?: StockAdjustmentInput['direccion']
  motivo: string
}

interface OperationResult {
  movimiento: SparePartMovementRecord | null
  repuesto: SparePartRecord | null
  status:
    | 'ALREADY_APPLIED'
    | 'CREATED'
    | 'IDEMPOTENCY_CONFLICT'
    | 'INSUFFICIENT_STOCK'
    | 'SPARE_PART_INACTIVE'
    | 'SPARE_PART_NOT_FOUND'
  stockAnterior: Prisma.Decimal | null
}

function pagination(query: { limite: number; pagina: number }) {
  return {
    skip: (query.pagina - 1) * query.limite,
    take: query.limite,
  }
}

function movementWhere(
  query: ListInventoryMovementsQuery,
  repuestoId?: string,
): Prisma.MovimientoInventarioWhereInput {
  const where: Prisma.MovimientoInventarioWhereInput = {}

  if (repuestoId) {
    where.repuestoId = repuestoId
  }

  if (query.tipo) {
    where.tipo = query.tipo
  }

  if (query.responsableId) {
    where.responsableId = query.responsableId
  }

  if (query.fechaDesde || query.fechaHasta) {
    where.fechaMovimiento = {
      ...(query.fechaDesde ? { gte: new Date(`${query.fechaDesde}T00:00:00.000Z`) } : {}),
      ...(query.fechaHasta ? { lt: new Date(`${query.fechaHasta}T23:59:59.999Z`) } : {}),
    }
  }

  if (query.busqueda) {
    where.OR = [
      {
        motivo: {
          contains: query.busqueda,
          mode: 'insensitive',
        },
      },
      {
        repuesto: {
          codigo: {
            contains: query.busqueda,
            mode: 'insensitive',
          },
        },
      },
      {
        repuesto: {
          nombre: {
            contains: query.busqueda,
            mode: 'insensitive',
          },
        },
      },
      {
        repuesto: {
          categoria: {
            contains: query.busqueda,
            mode: 'insensitive',
          },
        },
      },
    ]
  }

  return where
}

function sparePartWhere(query: ListSparePartsQuery): Prisma.RepuestoWhereInput {
  const filters: Prisma.RepuestoWhereInput[] = []

  if (query.busqueda) {
    filters.push({
      OR: [
        {
          codigo: {
            contains: query.busqueda,
            mode: 'insensitive',
          },
        },
        {
          nombre: {
            contains: query.busqueda,
            mode: 'insensitive',
          },
        },
        {
          categoria: {
            contains: query.busqueda,
            mode: 'insensitive',
          },
        },
      ],
    })
  }

  if (query.categoria) {
    filters.push({
      categoria: {
        contains: query.categoria,
        mode: 'insensitive',
      },
    })
  }

  if (query.estado) {
    filters.push({ estado: query.estado })
  }

  if (query.disponibilidad === 'INACTIVO') {
    filters.push({ estado: 'INACTIVO' })
  }

  if (query.disponibilidad === 'AGOTADO') {
    filters.push({ estado: 'ACTIVO', stockActual: new Prisma.Decimal(0) })
  }

  if (query.disponibilidad === 'BAJO') {
    filters.push({
      estado: 'ACTIVO',
      stockActual: {
        gt: new Prisma.Decimal(0),
        lte: prisma.repuesto.fields.stockMinimo,
      },
    })
  }

  if (query.disponibilidad === 'DISPONIBLE') {
    filters.push({
      estado: 'ACTIVO',
      stockActual: {
        gt: prisma.repuesto.fields.stockMinimo,
      },
    })
  }

  return filters.length > 0 ? { AND: filters } : {}
}

function movementOrderBy(
  query: ListInventoryMovementsQuery,
): Prisma.MovimientoInventarioOrderByWithRelationInput[] {
  const direction = query.direccion

  if (query.ordenarPor === 'codigo') {
    return [{ repuesto: { codigo: direction } }, { fechaMovimiento: 'desc' }, { id: 'desc' }]
  }

  if (query.ordenarPor === 'tipo') {
    return [{ tipo: direction }, { fechaMovimiento: 'desc' }, { id: 'desc' }]
  }

  if (query.ordenarPor === 'cantidad') {
    return [{ cantidad: direction }, { fechaMovimiento: 'desc' }, { id: 'desc' }]
  }

  return [{ fechaMovimiento: direction }, { id: direction }]
}

function sparePartOrderBy(query: ListSparePartsQuery): Prisma.RepuestoOrderByWithRelationInput[] {
  const direction = query.direccion
  const primary: Prisma.RepuestoOrderByWithRelationInput =
    query.ordenarPor === 'categoria'
      ? { categoria: direction }
      : query.ordenarPor === 'codigo'
        ? { codigo: direction }
        : query.ordenarPor === 'costoUnitario'
          ? { costoUnitario: direction }
          : query.ordenarPor === 'createdAt'
            ? { createdAt: direction }
            : query.ordenarPor === 'nombre'
              ? { nombre: direction }
              : query.ordenarPor === 'stockActual'
                ? { stockActual: direction }
                : query.ordenarPor === 'stockMinimo'
                  ? { stockMinimo: direction }
                  : { updatedAt: direction }

  if (query.ordenarPor === 'codigo') {
    return [primary, { id: 'asc' }]
  }

  return [primary, { codigo: 'asc' }, { id: 'asc' }]
}

export class SparePartRepository {
  async summarize() {
    const [repuestos, recentMovements] = await Promise.all([
      prisma.repuesto.findMany({
        select: {
          costoUnitario: true,
          estado: true,
          stockActual: true,
          stockMinimo: true,
        },
      }),
      prisma.movimientoInventario.findMany({
        include: movementInclude,
        orderBy: [{ fechaMovimiento: 'desc' }, { id: 'desc' }],
        take: 5,
      }),
    ])

    const empty = new Prisma.Decimal(0)
    const summary = repuestos.reduce(
      (acc, repuesto) => {
        acc.totalRepuestos += 1

        if (repuesto.estado === 'INACTIVO') {
          acc.inactivos += 1
        } else {
          acc.totalActivos += 1

          if (repuesto.stockActual.equals(0)) {
            acc.agotados += 1
          } else if (repuesto.stockActual.lessThanOrEqualTo(repuesto.stockMinimo)) {
            acc.bajoStock += 1
          } else {
            acc.disponibles += 1
          }
        }

        acc.valorInventario = acc.valorInventario.plus(
          repuesto.stockActual.mul(repuesto.costoUnitario),
        )

        return acc
      },
      {
        agotados: 0,
        bajoStock: 0,
        disponibles: 0,
        inactivos: 0,
        totalActivos: 0,
        totalRepuestos: 0,
        valorInventario: empty,
      },
    )

    return {
      agotados: summary.agotados,
      bajoStock: summary.bajoStock,
      disponibles: summary.disponibles,
      inactivos: summary.inactivos,
      movimientosRecientes: recentMovements,
      totalActivos: summary.totalActivos,
      totalRepuestos: summary.totalRepuestos,
      valorInventario: summary.valorInventario.toDecimalPlaces(2),
    }
  }

  async listSpareParts(query: ListSparePartsQuery) {
    const { skip, take } = pagination(query)
    const where = sparePartWhere(query)

    const [repuestos, total] = await Promise.all([
      prisma.repuesto.findMany({
        orderBy: sparePartOrderBy(query),
        select: sparePartSelect,
        skip,
        take,
        where,
      }),
      prisma.repuesto.count({ where }),
    ])

    return {
      repuestos,
      total,
    }
  }

  findSparePartById(repuestoId: string, client: SparePartDbClient = prisma) {
    return client.repuesto.findUnique({
      select: sparePartSelect,
      where: { id: repuestoId },
    })
  }

  findMovementByIdempotencyKey(claveIdempotencia: string, client: SparePartDbClient = prisma) {
    return client.movimientoInventario.findFirst({
      include: movementInclude,
      where: {
        claveIdempotencia,
      },
    })
  }

  findMovementById(movementId: string, client: SparePartDbClient = prisma) {
    return client.movimientoInventario.findUnique({
      include: movementInclude,
      where: { id: movementId },
    })
  }

  async listMovements(query: ListInventoryMovementsQuery, repuestoId?: string) {
    const { skip, take } = pagination(query)
    const where = movementWhere(query, repuestoId)
    const [movimientos, total] = await Promise.all([
      prisma.movimientoInventario.findMany({
        include: movementInclude,
        orderBy: movementOrderBy(query),
        skip,
        take,
        where,
      }),
      prisma.movimientoInventario.count({ where }),
    ])

    return {
      movimientos,
      total,
    }
  }

  async createSparePart(actorId: string, input: CreateSparePartInput) {
    return prisma.$transaction(
      async (tx) => {
        if (input.claveIdempotencia) {
          const existing = await this.findMovementByIdempotencyKey(input.claveIdempotencia, tx)

          if (existing) {
            if (
              existing.tipo !== 'ENTRADA' ||
              existing.responsableId !== actorId ||
              existing.repuesto.codigo !== input.codigo
            ) {
              return {
                movimiento: existing,
                repuesto: existing.repuesto,
                status: 'IDEMPOTENCY_CONFLICT' as const,
                stockAnterior: null,
              }
            }

            return {
              movimiento: existing,
              repuesto: existing.repuesto,
              status: 'ALREADY_APPLIED' as const,
              stockAnterior: null,
            }
          }
        }

        const initialStock = new Prisma.Decimal(input.stockInicial)
        const currentCost = new Prisma.Decimal(input.costoUnitario)
        const repuesto = await tx.repuesto.create({
          data: {
            categoria: input.categoria ?? null,
            codigo: input.codigo,
            costoUnitario: currentCost,
            nombre: input.nombre,
            stockActual: initialStock,
            stockMinimo: new Prisma.Decimal(input.stockMinimo),
            unidadMedida: input.unidadMedida,
          },
          select: sparePartSelect,
        })

        let movimiento: SparePartMovementRecord | null = null

        if (initialStock.greaterThan(0)) {
          const created = await tx.movimientoInventario.create({
            data: {
              cantidad: initialStock,
              claveIdempotencia: input.claveIdempotencia,
              costoUnitario: currentCost,
              motivo: input.motivoStockInicial ?? 'Existencia inicial autorizada',
              repuestoId: repuesto.id,
              responsableId: actorId,
              tipo: 'ENTRADA',
            },
          })

          movimiento = await this.findMovementById(created.id, tx)
        }

        return {
          movimiento,
          repuesto,
          status: 'CREATED' as const,
          stockAnterior: new Prisma.Decimal(0),
        }
      },
      {
        maxWait: 15000,
        timeout: 60000,
      },
    )
  }

  async updateSparePart(repuestoId: string, input: UpdateSparePartInput) {
    return prisma.$transaction(
      async (tx) => {
        const current = await this.findSparePartById(repuestoId, tx)

        if (!current) {
          return {
            repuesto: null,
            status: 'SPARE_PART_NOT_FOUND' as const,
          }
        }

        if (input.codigo && input.codigo !== current.codigo) {
          const [movements, consumptions] = await Promise.all([
            tx.movimientoInventario.count({ where: { repuestoId } }),
            tx.consumoRepuesto.count({ where: { repuestoId } }),
          ])

          if (movements > 0 || consumptions > 0) {
            return {
              repuesto: current,
              status: 'CODE_LOCKED' as const,
            }
          }
        }

        const repuesto = await tx.repuesto.update({
          data: {
            ...(input.categoria !== undefined ? { categoria: input.categoria ?? null } : {}),
            ...(input.codigo ? { codigo: input.codigo } : {}),
            ...(input.costoUnitario !== undefined
              ? { costoUnitario: new Prisma.Decimal(input.costoUnitario) }
              : {}),
            ...(input.nombre ? { nombre: input.nombre } : {}),
            ...(input.stockMinimo !== undefined
              ? { stockMinimo: new Prisma.Decimal(input.stockMinimo) }
              : {}),
            ...(input.unidadMedida ? { unidadMedida: input.unidadMedida } : {}),
          },
          select: sparePartSelect,
          where: { id: repuestoId },
        })

        return {
          repuesto,
          status: 'UPDATED' as const,
        }
      },
      {
        maxWait: 15000,
        timeout: 60000,
      },
    )
  }

  async setSparePartStatus(repuestoId: string, estado: 'ACTIVO' | 'INACTIVO') {
    return prisma.$transaction(
      async (tx) => {
        const current = await this.findSparePartById(repuestoId, tx)

        if (!current) {
          return {
            repuesto: null,
            status: 'SPARE_PART_NOT_FOUND' as const,
          }
        }

        if (current.estado === estado) {
          return {
            repuesto: current,
            status: 'ALREADY_SET' as const,
          }
        }

        const repuesto = await tx.repuesto.update({
          data: { estado },
          select: sparePartSelect,
          where: { id: repuestoId },
        })

        return {
          repuesto,
          status: 'UPDATED' as const,
        }
      },
      {
        maxWait: 15000,
        timeout: 60000,
      },
    )
  }

  registerEntry(repuestoId: string, actorId: string, input: StockEntryInput) {
    return this.applyStockOperation(repuestoId, actorId, 'ENTRADA', {
      cantidad: new Prisma.Decimal(input.cantidad),
      claveIdempotencia: input.claveIdempotencia,
      costoUnitario:
        input.costoUnitario === undefined ? undefined : new Prisma.Decimal(input.costoUnitario),
      motivo: input.motivo,
    })
  }

  registerAdjustment(repuestoId: string, actorId: string, input: StockAdjustmentInput) {
    return this.applyStockOperation(
      repuestoId,
      actorId,
      input.direccion === 'INCREMENTO' ? 'AJUSTE_ENTRADA' : 'AJUSTE_SALIDA',
      {
        cantidad: new Prisma.Decimal(input.cantidad),
        claveIdempotencia: input.claveIdempotencia,
        direccion: input.direccion,
        motivo: input.motivo,
      },
    )
  }

  private async applyStockOperation(
    repuestoId: string,
    actorId: string,
    tipo: Exclude<TipoMovimientoInventario, 'CONSUMO'>,
    input: StockOperationData,
  ): Promise<OperationResult> {
    return prisma.$transaction(
      async (tx) => {
        const existing = await this.findMovementByIdempotencyKey(input.claveIdempotencia, tx)

        if (existing) {
          if (
            existing.repuestoId !== repuestoId ||
            existing.responsableId !== actorId ||
            existing.tipo !== tipo
          ) {
            return {
              movimiento: existing,
              repuesto: existing.repuesto,
              status: 'IDEMPOTENCY_CONFLICT' as const,
              stockAnterior: null,
            }
          }

          return {
            movimiento: existing,
            repuesto: existing.repuesto,
            status: 'ALREADY_APPLIED' as const,
            stockAnterior: null,
          }
        }

        const current = await this.lockSparePart(tx, repuestoId)

        if (!current) {
          return {
            movimiento: null,
            repuesto: null,
            status: 'SPARE_PART_NOT_FOUND' as const,
            stockAnterior: null,
          }
        }

        if (current.estado !== 'ACTIVO') {
          return {
            movimiento: null,
            repuesto: current,
            status: 'SPARE_PART_INACTIVE' as const,
            stockAnterior: null,
          }
        }

        const stockAnterior = current.stockActual
        const updateData: Prisma.RepuestoUpdateManyMutationInput = {
          stockActual:
            tipo === 'AJUSTE_SALIDA'
              ? {
                  decrement: input.cantidad,
                }
              : {
                  increment: input.cantidad,
                },
          ...(tipo === 'ENTRADA' && input.costoUnitario !== undefined
            ? { costoUnitario: input.costoUnitario }
            : {}),
        }

        const stockUpdate = await tx.repuesto.updateMany({
          data: updateData,
          where: {
            estado: 'ACTIVO',
            id: repuestoId,
            ...(tipo === 'AJUSTE_SALIDA'
              ? {
                  stockActual: {
                    gte: input.cantidad,
                  },
                }
              : {}),
          },
        })

        if (stockUpdate.count !== 1) {
          return {
            movimiento: null,
            repuesto: current,
            status: 'INSUFFICIENT_STOCK' as const,
            stockAnterior,
          }
        }

        const movimientoCreated = await tx.movimientoInventario.create({
          data: {
            cantidad: input.cantidad,
            claveIdempotencia: input.claveIdempotencia,
            costoUnitario:
              tipo === 'ENTRADA'
                ? (input.costoUnitario ?? current.costoUnitario)
                : current.costoUnitario,
            motivo: input.motivo,
            repuestoId,
            responsableId: actorId,
            tipo,
          },
        })

        const [repuesto, movimiento] = await Promise.all([
          this.findSparePartById(repuestoId, tx),
          this.findMovementById(movimientoCreated.id, tx),
        ])

        return {
          movimiento,
          repuesto,
          status: 'CREATED' as const,
          stockAnterior,
        }
      },
      {
        maxWait: 15000,
        timeout: 60000,
      },
    )
  }

  private async lockSparePart(client: Prisma.TransactionClient, repuestoId: string) {
    await client.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(CAST(${repuestoId} AS text))::bigint)`,
    )

    return this.findSparePartById(repuestoId, client)
  }
}
