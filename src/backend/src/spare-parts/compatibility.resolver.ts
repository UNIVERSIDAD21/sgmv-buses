import { Prisma, type CompatibilidadRepuesto, type Repuesto } from '@prisma/client'

type Client = Prisma.TransactionClient
type TechnicalPart = Pick<
  Repuesto,
  'id' | 'dimensiones' | 'especificaciones' | 'fabricante' | 'numeroParte'
>

export interface CompatibilityEvaluation {
  evidencia: Prisma.InputJsonObject
  regla: {
    condicionUso: string | null
    id: number
    modeloBusId: number | null
    permitido: boolean
    version: number
    busId: number | null
  } | null
  resultado: 'COMPATIBLE' | 'INCOMPATIBLE' | 'SIN_EVIDENCIA'
}

export async function resolveCompatibility(
  tx: Client,
  busId: number,
  repuestoId: number,
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

  return buildEvaluation(busId, repuestoId, bus?.modeloBusId ?? null, sparePart, rule, evaluatedAt)
}

function buildEvaluation(
  busId: number,
  repuestoId: number,
  modeloBusId: number | null,
  sparePart: Omit<TechnicalPart, 'id'> | null,
  rule: CompatibilidadRepuesto | null,
  evaluatedAt: Date,
): CompatibilityEvaluation {
  if (!rule) {
    return {
      evidencia: {
        busId,
        condicionUso: null,
        dimensionesRepuesto: sparePart?.dimensiones ?? null,
        evaluadoAt: evaluatedAt.toISOString(),
        especificacionesRepuesto: sparePart?.especificaciones ?? null,
        fabricanteRepuesto: sparePart?.fabricante ?? null,
        modeloBusId,
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
      modeloBusId,
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

// Solo para consultas. El consumo confirmado sigue usando resolveCompatibility
// con candados transaccionales y validación de la regla vigente al escribir.
export async function resolveCompatibilityBatch<T extends TechnicalPart>(
  tx: Client,
  busId: number,
  parts: T[],
) {
  const bus = await tx.bus.findUnique({ where: { id: busId }, select: { modeloBusId: true } })
  const rules =
    parts.length === 0
      ? []
      : await tx.compatibilidadRepuesto.findMany({
          where: {
            repuestoId: { in: parts.map((part) => part.id) },
            vigente: true,
            OR: [{ busId }, ...(bus?.modeloBusId ? [{ modeloBusId: bus.modeloBusId }] : [])],
          },
          orderBy: [{ version: 'desc' }, { id: 'desc' }],
        })
  const byBus = new Map<number, CompatibilidadRepuesto>()
  const byModel = new Map<number, CompatibilidadRepuesto>()
  for (const rule of rules) {
    const map = rule.busId === busId ? byBus : byModel
    if (!map.has(rule.repuestoId)) map.set(rule.repuestoId, rule)
  }
  const evaluatedAt = new Date()
  return parts.map((part) => ({
    ...part,
    evaluacion: buildEvaluation(
      busId,
      part.id,
      bus?.modeloBusId ?? null,
      part,
      byBus.get(part.id) ?? byModel.get(part.id) ?? null,
      evaluatedAt,
    ),
  }))
}
