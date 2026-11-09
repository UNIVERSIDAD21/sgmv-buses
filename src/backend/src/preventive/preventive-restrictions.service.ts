import { buildAvailability } from '../availability/availability.policy.js'
import { getAvailabilityRecordsBatch } from '../availability/availability.repository.js'
import type { AuthenticatedUser } from '../auth/auth.types.js'
import { prisma } from '../prisma/client.js'
import { AppError } from '../shared/http.js'
import { classifyPreventiveCycle } from './preventive-cycle.js'

function ensureAuthorized(actor: AuthenticatedUser) {
  if (actor.rol.codigo !== 'ADMINISTRADOR' && actor.rol.codigo !== 'DESPACHADOR') {
    throw new AppError(
      403,
      'FORBIDDEN',
      'No tiene permisos para consultar restricciones preventivas',
    )
  }
}

export class PreventiveRestrictionsService {
  async list(actor: AuthenticatedUser, evaluatedAt = new Date()) {
    ensureAuthorized(actor)
    const schedules = await prisma.programacionMantenimiento.findMany({
      where: { activa: true, planMantenimientoPreventivoId: { not: null } },
      include: {
        bus: { select: { codigoInterno: true, id: true, kilometrajeActual: true } },
        planMantenimientoPreventivo: {
          select: {
            anticipacionDias: true,
            anticipacionKm: true,
            bloqueaAlVencer: true,
            claveTarea: true,
            id: true,
            version: true,
          },
        },
      },
      orderBy: [{ bus: { codigoInterno: 'asc' } }, { id: 'asc' }],
    })

    const classified = schedules.flatMap((schedule) => {
      if (!schedule.planMantenimientoPreventivo) return []
      const classification = classifyPreventiveCycle(
        {
          fechaProgramada: schedule.fechaProgramada,
          kilometrajeActual: schedule.bus.kilometrajeActual,
          kilometrajeObjetivo: schedule.kilometrajeObjetivo,
          planMantenimientoPreventivo: schedule.planMantenimientoPreventivo,
        },
        evaluatedAt,
      )
      return classification.estado === 'VIGENTE' ? [] : [{ schedule, classification }]
    })

    // Dispatch projects only operational targets. Administrator availability is
    // resolved once per distinct bus, not through five queries per schedule.
    const busIds = [...new Set(classified.map(({ schedule }) => schedule.busId))]
    const records =
      actor.rol.codigo === 'ADMINISTRADOR' && busIds.length > 0
        ? await prisma.$transaction((tx) =>
            getAvailabilityRecordsBatch(
              busIds.map((busId) => ({ busId, eventDate: evaluatedAt })),
              tx,
            ),
          )
        : []
    const availabilityByBus = new Map(busIds.map((id, index) => [id, records[index]]))

    const restrictions = (() => {
      const mapped = []
      for (const { schedule, classification } of classified) {
        if (!schedule.planMantenimientoPreventivo) continue
        const record = availabilityByBus.get(schedule.busId)
        const availability = record ? buildAvailability(record, evaluatedAt) : null
        const operational = {
          bloqueaDespacho:
            classification.estado === 'VENCIDO' &&
            schedule.planMantenimientoPreventivo.bloqueaAlVencer,
          bus: { codigoInterno: schedule.bus.codigoInterno, id: schedule.bus.id },
          causa:
            classification.estado === 'VENCIDO' &&
            schedule.planMantenimientoPreventivo.bloqueaAlVencer
              ? 'El mantenimiento vencido impide nuevas jornadas.'
              : 'El mantenimiento requiere seguimiento antes de su vencimiento.',
          estado: classification.estado,
          objetivos: {
            fecha: schedule.fechaProgramada?.toISOString().slice(0, 10) ?? null,
            kilometraje: schedule.kilometrajeObjetivo,
          },
          programacionId: schedule.id,
          restantes: {
            dias: classification.diasRestantes,
            kilometros: classification.kilometrosRestantes,
          },
          restriccion:
            classification.estado === 'VENCIDO' &&
            schedule.planMantenimientoPreventivo.bloqueaAlVencer
              ? 'PREVENTIVO_VENCIDO_BLOQUEANTE'
              : null,
        }
        mapped.push(
          actor.rol.codigo === 'ADMINISTRADOR'
            ? {
                ...operational,
                actividad: schedule.actividad,
                disponibilidad: {
                  causaPrincipal: availability!.causaPrincipal,
                  disponible: availability!.disponible,
                },
                plan: {
                  bloqueaAlVencer: schedule.planMantenimientoPreventivo.bloqueaAlVencer,
                  claveTarea: schedule.planMantenimientoPreventivo.claveTarea,
                  id: schedule.planMantenimientoPreventivo.id,
                  version: schedule.planMantenimientoPreventivo.version,
                },
              }
            : operational,
        )
      }
      return mapped
    })()

    return { evaluadoAt: evaluatedAt.toISOString(), restricciones: restrictions }
  }
}
