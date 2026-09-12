import { Prisma } from '@prisma/client'

import { effectivePreventiveThresholds } from '../preventive/preventive-cycle.js'
import { materializeAlert } from './alert.service.js'

/** Projection is advisory only: this producer never changes mileage, schedules or availability. */
export async function evaluateJourneyProjectionAlerts(
  journeyId: number,
  tx: Prisma.TransactionClient,
  evaluatedAt = new Date(),
) {
  // Serializes scheduled reevaluation with start/finish/cancel, preventing stale alerts after closure.
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM jornadas_operativas WHERE id = ${journeyId} FOR UPDATE`,
  )
  const journey = await tx.jornadaOperativa.findUnique({
    where: { id: journeyId },
    include: {
      bus: true,
      lecturasKilometraje: { where: { tipo: { in: ['INICIO_JORNADA', 'FIN_JORNADA'] } } },
    },
  })
  if (!journey?.kmProyectadosDemo) return
  const initial = journey.lecturasKilometraje.find(
    (r) => r.tipo === 'INICIO_JORNADA',
  )?.kilometrajeNuevo
  const final = journey.lecturasKilometraje.find((r) => r.tipo === 'FIN_JORNADA')?.kilometrajeNuevo
  const prefix = `proyeccion-jornada:${journey.id}:`
  if (!['PROGRAMADA', 'EN_CURSO'].includes(journey.estado)) {
    const real = initial !== undefined && final !== undefined ? final - initial : null
    const alerts = await tx.alertaInterna.findMany({
      where: { claveDeduplicacion: { startsWith: prefix } },
    })
    for (const alert of alerts) {
      await tx.alertaInterna.update({
        where: { id: alert.id },
        data: {
          contextoEvento: {
            ...(alert.contextoEvento as Prisma.InputJsonObject),
            estadoProyeccion: real === null ? 'ANULADA' : 'CONCILIADA',
            kmReal: real,
            diferenciaKm:
              real === null
                ? null
                : new Prisma.Decimal(real).sub(journey.kmProyectadosDemo).toNumber(),
          },
          titulo:
            real === null
              ? 'Proyección simulada anulada'
              : 'Proyección simulada conciliada con odómetro',
          mensaje:
            real === null
              ? `La jornada ${journey.id} terminó sin recorrido registrado. La proyección ya no está vigente.`
              : `Jornada ${journey.id}: proyección demo ${journey.kmProyectadosDemo} km; recorrido por odómetro ${real} km. El kilometraje real prevalece.`,
        },
      })
    }
    return
  }
  const estimated = journey.kmProyectadosDemo
    .add(initial ?? journey.bus.kilometrajeActual)
    .toNumber()
  const [schedules, staff] = await Promise.all([
    tx.programacionMantenimiento.findMany({
      where: { busId: journey.busId, activa: true, kilometrajeObjetivo: { not: null } },
      include: { planMantenimientoPreventivo: true },
      orderBy: { id: 'asc' },
    }),
    tx.usuario.findMany({
      where: { estado: 'ACTIVO', rol: { codigo: { in: ['ADMINISTRADOR', 'DESPACHADOR'] } } },
      select: { id: true },
    }),
  ])
  for (const schedule of schedules) {
    const remaining = schedule.kilometrajeObjetivo! - estimated
    if (
      remaining >
      effectivePreventiveThresholds(schedule.planMantenimientoPreventivo ?? undefined).soonKm
    )
      continue
    const state = remaining <= 0 ? 'UMBRAL_ESTIMADO' : 'PROXIMO_ESTIMADO'
    await materializeAlert(
      {
        tipo: 'MANTENIMIENTO_PROXIMO',
        titulo: 'Mantenimiento anticipado — proyección simulada',
        mensaje: `Bus ${journey.bus.codigoInterno}, jornada ${journey.id}: cierre estimado ${estimated} km frente al objetivo ${schedule.kilometrajeObjetivo} km. Simulación SGMV; no sustituye el odómetro ni bloquea el bus.`,
        claveDeduplicacion: `${prefix}${schedule.id}:v${schedule.planMantenimientoPreventivo?.version ?? 0}:${schedule.kilometrajeObjetivo}:${state}`,
        origen: { programacionMantenimientoId: schedule.id },
        destinatarios: { kind: 'USERS', userIds: [...staff.map((u) => u.id), journey.conductorId] },
        contextoEvento: {
          busCodigo: journey.bus.codigoInterno,
          eventAt: evaluatedAt.toISOString(),
          estado: state,
          origenProyeccion: 'SIMULADO_SGMV',
          estadoProyeccion: 'PROYECCION_SIMULADA',
          jornadaId: journey.id,
          kmProyectadosDemo: journey.kmProyectadosDemo.toNumber(),
          kmEstimadoCierre: estimated,
          objetivos: { kilometraje: schedule.kilometrajeObjetivo },
          restantes: { kilometros: remaining },
        },
      },
      tx,
    )
  }
}
