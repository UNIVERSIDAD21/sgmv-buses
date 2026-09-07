import { Prisma } from '@prisma/client'

type Client = Prisma.TransactionClient

export interface CompatibilityEvaluation {
  evidencia: Prisma.InputJsonObject
  regla: {
    condicionUso: string | null
    id: string
    modeloBusId: string | null
    permitido: boolean
    version: number
    busId: string | null
  } | null
  resultado: 'COMPATIBLE' | 'INCOMPATIBLE' | 'SIN_EVIDENCIA'
}

export async function resolveCompatibility(
  tx: Client,
  busId: string,
  repuestoId: string,
  evaluatedAt = new Date(),
): Promise<CompatibilityEvaluation> {
  const [bus, sparePart] = await Promise.all([
    tx.bus.findUnique({ where: { id: busId }, select: { modeloBusId: true } }),
    tx.repuesto.findUnique({
      where: { id: repuestoId },
      select: {
        dimensiones: true,
        especificaciones: true,
        fabricante: true,
        numeroParte: true,
      },
    }),
  ])
  await tx.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`sgmv:compatibilidad:${repuestoId}:bus:${busId}`}, 0))`,
  )
  if (bus?.modeloBusId) {
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`sgmv:compatibilidad:${repuestoId}:modelo:${bus.modeloBusId}`}, 0))`,
    )
  }
  const byBus = await tx.compatibilidadRepuesto.findFirst({
    where: { busId, repuestoId, vigente: true },
    orderBy: { version: 'desc' },
  })
  const rule =
    byBus ??
    (bus?.modeloBusId
      ? await tx.compatibilidadRepuesto.findFirst({
          where: { modeloBusId: bus.modeloBusId, repuestoId, vigente: true },
          orderBy: { version: 'desc' },
        })
      : null)

  if (!rule) {
    return {
      evidencia: {
        busId,
        condicionUso: null,
        dimensionesRepuesto: sparePart?.dimensiones ?? null,
        evaluadoAt: evaluatedAt.toISOString(),
        especificacionesRepuesto: sparePart?.especificaciones ?? null,
        fabricanteRepuesto: sparePart?.fabricante ?? null,
        modeloBusId: bus?.modeloBusId ?? null,
        numeroParteRepuesto: sparePart?.numeroParte ?? null,
        precedencia: 'SIN_EVIDENCIA_POSITIVA',
        repuestoId,
        schemaVersion: 1,
      },
      regla: null,
      resultado: 'SIN_EVIDENCIA',
    }
  }

  return {
    evidencia: {
      busId,
      condicionUso: rule.condicionUso,
      destino: rule.busId ? 'BUS' : 'MODELO',
      dimensionesRepuesto: sparePart?.dimensiones ?? null,
      evaluadoAt: evaluatedAt.toISOString(),
      especificacionesRepuesto: sparePart?.especificaciones ?? null,
      especificacionesValidadas: rule.especificacionesValidadas,
      fabricanteRepuesto: sparePart?.fabricante ?? null,
      modeloBusId: bus?.modeloBusId ?? null,
      numeroParteRepuesto: sparePart?.numeroParte ?? null,
      permitido: rule.permitido,
      precedencia: rule.busId ? 'BUS' : 'MODELO',
      repuestoId,
      reglaId: rule.id,
      reglaVersion: rule.version,
      schemaVersion: 1,
    },
    regla: {
      busId: rule.busId,
      condicionUso: rule.condicionUso,
      id: rule.id,
      modeloBusId: rule.modeloBusId,
      permitido: rule.permitido,
      version: rule.version,
    },
    resultado: rule.permitido ? 'COMPATIBLE' : 'INCOMPATIBLE',
  }
}
