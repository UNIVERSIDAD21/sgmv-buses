import { Prisma } from '@prisma/client'
import { AppError } from '../shared/http.js'

export interface SimulationInput {
  ciclosCompletosSimulados: number
  kmNoComercialesSimulados: number
}

export async function buildProjectionSnapshot(
  rutaId: number | null,
  simulation: SimulationInput | undefined,
  tx: Prisma.TransactionClient,
) {
  if (!simulation) return {}
  const route = rutaId ? await tx.ruta.findUnique({ where: { id: rutaId } }) : null
  if (!route?.longitudKmOficial || route.origenDato !== 'OFICIAL') {
    throw new AppError(
      400,
      'OFFICIAL_ROUTE_REQUIRED',
      'La proyección demo requiere una ruta con longitud oficial documentada',
    )
  }
  const kmNoComercialesSimulados = new Prisma.Decimal(simulation.kmNoComercialesSimulados)
  return {
    ciclosCompletosSimulados: simulation.ciclosCompletosSimulados,
    kmNoComercialesSimulados,
    longitudKmOficialSnapshot: route.longitudKmOficial,
    kmProyectadosDemo: route.longitudKmOficial
      .mul(simulation.ciclosCompletosSimulados)
      .add(kmNoComercialesSimulados),
  }
}

export function mapJourneyProjection(
  journey: {
    ciclosCompletosSimulados: number | null
    kmNoComercialesSimulados: Prisma.Decimal | null
    longitudKmOficialSnapshot: Prisma.Decimal | null
    kmProyectadosDemo: Prisma.Decimal | null
    bus: { kilometrajeActual: number }
  },
  initial: number | undefined,
  final: number | undefined,
) {
  if (journey.kmProyectadosDemo === null) return null
  const real = initial !== undefined && final !== undefined ? final - initial : null
  return {
    origen: 'PROYECCION_SIMULADA' as const,
    origenSemanticaDemo: 'SIMULADO_SGMV' as const,
    semanticaLongitudDemo: 'CIRCUITO_COMPLETO' as const,
    ciclosCompletosSimulados: journey.ciclosCompletosSimulados!,
    kmNoComercialesSimulados: journey.kmNoComercialesSimulados!.toNumber(),
    longitudKmOficialSnapshot: journey.longitudKmOficialSnapshot!.toNumber(),
    kmComercialesProyectadosDemo: journey
      .longitudKmOficialSnapshot!.mul(journey.ciclosCompletosSimulados!)
      .toNumber(),
    kmJornadaProyectadosDemo: journey.kmProyectadosDemo.toNumber(),
    kmEstimadoCierre: journey.kmProyectadosDemo
      .add(initial ?? journey.bus.kilometrajeActual)
      .toNumber(),
    kmReal: real,
    diferenciaKm:
      real === null ? null : new Prisma.Decimal(real).sub(journey.kmProyectadosDemo).toNumber(),
    conciliada: real !== null,
  }
}

export type JourneyProjectionDto = ReturnType<typeof mapJourneyProjection>
