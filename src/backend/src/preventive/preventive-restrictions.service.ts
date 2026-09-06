import { buildAvailability } from '../availability/availability.policy.js'
import { getAvailabilityRecords } from '../availability/availability.repository.js'
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

    const restrictions = await prisma.$transaction(async (tx) => {
      const mapped = []
      for (const schedule of schedules) {
        if (!schedule.planMantenimientoPreventivo) continue
        const classification = classifyPreventiveCycle(
          {
            fechaProgramada: schedule.fechaProgramada,
            kilometrajeActual: schedule.bus.kilometrajeActual,
            kilometrajeObjetivo: schedule.kilometrajeObjetivo,
            planMantenimientoPreventivo: schedule.planMantenimientoPreventivo,
          },
          evaluatedAt,
        )
        if (classification.estado === 'VIGENTE') continue
        const availability = buildAvailability(
          await getAvailabilityRecords({ busId: schedule.busId, eventDate: evaluatedAt }, tx),
          evaluatedAt,
        )
        const operational = {
          bloqueaDespacho:
            classification.estado === 'VENCIDO' &&
            schedule.planMantenimientoPreventivo.bloqueaAlVencer,
          bus: { codigoInterno: schedule.bus.codigoInterno, id: schedule.bus.id },
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
                disponibilidad: {
                  causaPrincipal: availability.causaPrincipal,
                  disponible: availability.disponible,
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
    })

    return { evaluadoAt: evaluatedAt.toISOString(), restricciones: restrictions }
  }
}
