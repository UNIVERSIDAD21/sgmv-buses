import { mapRouteReference } from '../amb/route-contract.js'
import { buildProjectionSnapshot, mapJourneyProjection } from './journey-projection.js'
import { Prisma, type EstadoJornada } from '@prisma/client'

import {
  createJourneyChangeAlert,
  createJourneyClosureProblemAlert,
  evaluatePreventiveAlertsForBus,
} from '../alerts/alert.service.js'
import { evaluateJourneyProjectionAlerts } from '../alerts/journey-projection-alerts.js'
import { buildAvailability } from '../availability/availability.policy.js'
import type { AuthenticatedUser } from '../auth/auth.types.js'
import { AppError } from '../shared/http.js'
import { buildJourneyPeriodSlots } from './journey-period.js'
import {
  JourneyRepository,
  type JourneyRecord,
  type JourneyTransaction,
} from './journey.repository.js'
import type {
  CancelJourneyInput,
  CreateJourneyInput,
  JourneyPeriodInput,
  InterruptJourneyInput,
  JourneyReadingInput,
  ListJourneysQuery,
  MarkReadingUnrecoverableInput,
  ReconcileFinalReadingInput,
  ReassignJourneyInput,
} from './journey.schemas.js'
import type {
  AvailabilityDto,
  JourneyActionsDto,
  JourneyDto,
  JourneyReadingDto,
  JourneyUserRefDto,
} from './journey.types.js'

const TERMINAL_STATES = new Set<EstadoJornada>([
  'FINALIZADA',
  'CANCELADA',
  'REASIGNADA',
  'INTERRUMPIDA',
])

function ensureDispatcherOrAdmin(actor: AuthenticatedUser) {
  if (actor.rol.codigo !== 'ADMINISTRADOR' && actor.rol.codigo !== 'DESPACHADOR') {
    throw new AppError(403, 'FORBIDDEN', 'No tiene permisos para realizar esta operacion')
  }
}

function ensureJourneyReader(journey: JourneyRecord, actor: AuthenticatedUser) {
  if (actor.rol.codigo === 'ADMINISTRADOR' || actor.rol.codigo === 'DESPACHADOR') return
  if (actor.rol.codigo === 'CONDUCTOR' && journey.conductorId === actor.id) return
  throw new AppError(404, 'JOURNEY_NOT_FOUND', 'Jornada no encontrada')
}

function ensureOwnJourneyAction(journey: JourneyRecord, actor: AuthenticatedUser) {
  if (actor.rol.codigo === 'ADMINISTRADOR' || actor.rol.codigo === 'DESPACHADOR') return
  if (actor.rol.codigo === 'CONDUCTOR' && journey.conductorId === actor.id) return
  throw new AppError(403, 'FORBIDDEN', 'Solo puede operar su propia jornada')
}

function ensureEventDate(eventDate: Date) {
  if (eventDate.getTime() > Date.now()) {
    throw new AppError(400, 'FUTURE_EVENT_DATE', 'La fecha del evento no puede estar en el futuro')
  }
}

function resolveJourneyObserver(
  input: { observadoPorId?: number; motivoRespaldo?: string },
  journey: JourneyRecord,
  actor: AuthenticatedUser,
) {
  if (actor.rol.codigo === 'CONDUCTOR') {
    if (input.observadoPorId !== undefined && input.observadoPorId !== actor.id) {
      throw new AppError(
        400,
        'INVALID_MILEAGE_OBSERVER',
        'El Conductor solo puede declarar su propia observación',
      )
    }
    return { observerId: actor.id, backupReason: null }
  }
  if (input.observadoPorId === undefined) {
    if (input.motivoRespaldo)
      throw new AppError(
        400,
        'INVALID_MILEAGE_OBSERVER',
        'Identifique a la persona que observó la lectura',
      )
    return { observerId: null, backupReason: null }
  }
  if (input.observadoPorId !== actor.id && input.observadoPorId !== journey.conductorId) {
    throw new AppError(
      400,
      'INVALID_MILEAGE_OBSERVER',
      'El observador debe ser quien registra o el Conductor de la jornada',
    )
  }
  if (input.observadoPorId !== actor.id && !input.motivoRespaldo) {
    throw new AppError(
      400,
      'BACKUP_REASON_REQUIRED',
      'Indique por qué transcribe la lectura del Conductor',
    )
  }
  return {
    observerId: input.observadoPorId,
    backupReason: input.observadoPorId === actor.id ? null : input.motivoRespaldo!.trim(),
  }
}

function mapUser(user: JourneyRecord['conductor']): JourneyUserRefDto {
  return {
    id: user.id,
    nombre: user.nombre,
    rol: user.rol.codigo,
  }
}

function mapReading(reading: JourneyRecord['lecturasKilometraje'][number]): JourneyReadingDto {
  return {
    fechaLectura: (reading.fechaLectura ?? reading.fechaRegistro).toISOString(),
    fechaRegistro: reading.fechaRegistro.toISOString(),
    id: reading.id,
    kilometraje: reading.kilometrajeNuevo,
    kilometrajeAnterior: reading.kilometrajeAnterior,
    registradoPor: mapUser(reading.registradoPor),
    observadoPor: reading.observadoPor ? mapUser(reading.observadoPor) : null,
    motivoRespaldo: reading.motivoRespaldo,
    tipo: reading.tipo!,
  }
}

function buildActions(
  journey: JourneyRecord,
  actor: AuthenticatedUser,
  availability: AvailabilityDto,
): JourneyActionsDto {
  const dispatcher = actor.rol.codigo === 'ADMINISTRADOR' || actor.rol.codigo === 'DESPACHADOR'
  const ownDriver = actor.rol.codigo === 'CONDUCTOR' && journey.conductorId === actor.id

  return {
    puedeCancelar: dispatcher && (journey.estado === 'PROGRAMADA' || journey.estado === 'EN_CURSO'),
    puedeFinalizar: (dispatcher || ownDriver) && journey.estado === 'EN_CURSO',
    puedeIniciar:
      (dispatcher || ownDriver) &&
      journey.estado === 'PROGRAMADA' &&
      journey.inicioProgramado <= new Date() &&
      availability.disponible,
    puedeReasignar:
      dispatcher &&
      (journey.estado === 'PROGRAMADA' ||
        journey.estado === 'EN_CURSO' ||
        (journey.estado === 'INTERRUMPIDA' && !journey.jornadaSucesora)),
    puedeInterrumpir: dispatcher && journey.estado === 'EN_CURSO',
    puedeConciliarLectura:
      dispatcher &&
      journey.estado === 'INTERRUMPIDA' &&
      journey.estadoConciliacionLectura === 'PENDIENTE',
    puedeMarcarNoRecuperable:
      actor.rol.codigo === 'ADMINISTRADOR' &&
      journey.estado === 'INTERRUMPIDA' &&
      journey.estadoConciliacionLectura === 'PENDIENTE',
  }
}

function mapJourney(
  journey: JourneyRecord,
  actor: AuthenticatedUser,
  availability: AvailabilityDto,
): JourneyDto {
  const lecturaInicial = journey.lecturasKilometraje.find(
    (reading) => reading.tipo === 'INICIO_JORNADA',
  )
  const lecturaFinal = journey.lecturasKilometraje.find((reading) => reading.tipo === 'FIN_JORNADA')

  return {
    interrupcion:
      journey.estado === 'INTERRUMPIDA' && journey.estadoConciliacionLectura
        ? {
            interrumpidaPor: journey.cambioPor ? mapUser(journey.cambioPor) : null,
            estadoConciliacion: journey.estadoConciliacionLectura,
            motivoAusenciaLectura: journey.motivoAusenciaLectura,
            motivoNoRecuperable: journey.motivoNoRecuperable,
            conciliadaAt: journey.conciliadaAt?.toISOString() ?? null,
            conciliadaPor: journey.conciliadaPor ? mapUser(journey.conciliadaPor) : null,
            detalleConciliacion: journey.detalleConciliacion,
          }
        : null,
    acciones: buildActions(journey, actor, availability),
    cierrePendiente:
      journey.cierreReportadoAt && journey.motivoCierrePendiente
        ? {
            reportadoAt: journey.cierreReportadoAt.toISOString(),
            motivo: journey.motivoCierrePendiente,
            reportadoPor: mapUser(journey.conductor),
          }
        : null,
    proyeccionDemo: mapJourneyProjection(
      journey,
      lecturaInicial?.kilometrajeNuevo,
      lecturaFinal?.kilometrajeNuevo,
    ),
    bus: {
      id: journey.bus.id,
      codigoInterno: journey.bus.codigoInterno,
      placa: journey.bus.placa,
      estadoOperativo: journey.bus.estadoOperativo,
    },
    lecturaReferencia: journey.bus.lecturasKilometraje[0]
      ? {
          kilometraje: journey.bus.lecturasKilometraje[0].kilometrajeNuevo,
          fechaLectura: (
            journey.bus.lecturasKilometraje[0].fechaLectura ??
            journey.bus.lecturasKilometraje[0].fechaRegistro
          ).toISOString(),
        }
      : null,
    cambioPor: journey.cambioPor ? mapUser(journey.cambioPor) : null,
    causasDisponibilidad: availability.causas,
    conductor: mapUser(journey.conductor),
    estado: journey.estado,
    fechaCambio: journey.fechaCambio?.toISOString() ?? null,
    finProgramado: journey.finProgramado.toISOString(),
    finReal: journey.finReal?.toISOString() ?? null,
    finalizadaPor: journey.finalizadaPor ? mapUser(journey.finalizadaPor) : null,
    id: journey.id,
    iniciadaPor: journey.iniciadaPor ? mapUser(journey.iniciadaPor) : null,
    inicioProgramado: journey.inicioProgramado.toISOString(),
    inicioReal: journey.inicioReal?.toISOString() ?? null,
    jornadaAnteriorId: journey.jornadaAnteriorId,
    jornadaSucesoraId: journey.jornadaSucesora?.id ?? null,
    lecturaFinal: lecturaFinal ? mapReading(lecturaFinal) : null,
    lecturaInicial: lecturaInicial ? mapReading(lecturaInicial) : null,
    motivoCambio: journey.motivoCambio,
    motivoSucesion: journey.motivoSucesion,
    programadaPor: mapUser(journey.programadaPor),
    ruta: journey.ruta ? mapRouteReference(journey.ruta) : null,
    updatedAt: journey.updatedAt.toISOString(),
  }
}

function isJourneyConstraint(error: unknown) {
  const serialized = String(
    error instanceof Prisma.PrismaClientKnownRequestError
      ? `${error.code} ${JSON.stringify(error.meta)}`
      : error,
  ).toLowerCase()
  return (
    serialized.includes('ex_obj_jornada') ||
    serialized.includes('jornadas_operativas') ||
    serialized.includes('jornada')
  )
}

function translateJourneyError(error: unknown): never {
  if (error instanceof AppError) throw error

  if (isJourneyConstraint(error)) {
    throw new AppError(
      409,
      'JOURNEY_CONFLICT',
      'La jornada entra en conflicto con la agenda o el estado operativo vigente',
    )
  }

  throw error
}

export class JourneyService {
  constructor(private readonly repository = new JourneyRepository()) {}

  private async evaluatePeriod(
    input: JourneyPeriodInput,
    tx: JourneyTransaction,
    actor: AuthenticatedUser,
  ) {
    const slots = buildJourneyPeriodSlots(input)
    if (!slots.length) {
      throw new AppError(400, 'EMPTY_JOURNEY_PERIOD', 'Ningún día seleccionado cae en el período')
    }
    const context = await this.repository.findContext(
      input.busId,
      input.conductorId,
      input.rutaId ?? null,
      tx,
    )
    if (!context.bus) throw new AppError(404, 'BUS_NOT_FOUND', 'Bus no encontrado')
    if (
      !context.conductor ||
      context.conductor.estado !== 'ACTIVO' ||
      context.conductor.rol.codigo !== 'CONDUCTOR'
    ) {
      throw new AppError(409, 'DRIVER_NOT_AVAILABLE', 'El Conductor no existe o no está activo')
    }
    if (input.rutaId && (!context.ruta || !context.ruta.activa)) {
      throw new AppError(409, 'ROUTE_INACTIVE', 'La ruta no existe o no está activa')
    }

    const existing = await tx.jornadaOperativa.findMany({
      where: {
        estado: { in: ['PROGRAMADA', 'EN_CURSO'] },
        inicioProgramado: { lt: slots[slots.length - 1]!.finProgramado },
        finProgramado: { gt: slots[0]!.inicioProgramado },
        OR: [{ busId: input.busId }, { conductorId: input.conductorId }],
      },
      select: {
        id: true,
        busId: true,
        conductorId: true,
        rutaId: true,
        inicioProgramado: true,
        finProgramado: true,
      },
    })
    const now = new Date()
    const jornadas = [] as Array<{
      fecha: string
      inicioProgramado: string
      finProgramado: string
      conflictos: Array<{ codigo: string; mensaje: string }>
    }>
    for (const slot of slots) {
      const conflicts: Array<{ codigo: string; mensaje: string }> = []
      if (slot.inicioProgramado <= now) {
        conflicts.push({ codigo: 'FECHA_PASADA', mensaje: 'La salida ya ocurrió' })
      }
      if (context.bus.estadoOperativo !== 'OPERATIVO') {
        conflicts.push({ codigo: 'BUS_NO_OPERATIVO', mensaje: 'El bus no está operativo' })
      }
      for (const reservation of existing) {
        if (
          reservation.inicioProgramado >= slot.finProgramado ||
          reservation.finProgramado <= slot.inicioProgramado
        )
          continue
        if (
          reservation.busId === input.busId &&
          reservation.conductorId === input.conductorId &&
          reservation.rutaId === (input.rutaId ?? null) &&
          reservation.inicioProgramado.getTime() === slot.inicioProgramado.getTime() &&
          reservation.finProgramado.getTime() === slot.finProgramado.getTime()
        ) {
          conflicts.push({
            codigo: 'JORNADA_DUPLICADA',
            mensaje: `Ya existe el tramo #${reservation.id}`,
          })
          continue
        }
        if (reservation.busId === input.busId) {
          conflicts.push({
            codigo: 'BUS_OCUPADO',
            mensaje: `Bus reservado en jornada #${reservation.id}`,
          })
        }
        if (reservation.conductorId === input.conductorId) {
          conflicts.push({
            codigo: 'CONDUCTOR_OCUPADO',
            mensaje: `Conductor reservado en jornada #${reservation.id}`,
          })
        }
      }
      const availability = buildAvailability(
        await this.repository.getAvailabilityRecords(
          input.busId,
          input.conductorId,
          null,
          slot.inicioProgramado,
          tx,
        ),
        slot.inicioProgramado,
      )
      for (const cause of availability.causas) {
        if (cause.codigo === 'CONFLICTO_JORNADA' || cause.codigo.startsWith('BUS_')) continue
        if (actor.rol.codigo === 'DESPACHADOR' && cause.codigo !== 'NOVEDAD_BLOQUEANTE') {
          if (!conflicts.some((conflict) => conflict.codigo === 'RESTRICCION_TECNICA')) {
            conflicts.push({
              codigo: 'RESTRICCION_TECNICA',
              mensaje: 'El bus requiere revisión administrativa antes de programarse',
            })
          }
        } else {
          conflicts.push({ codigo: cause.codigo, mensaje: cause.mensaje })
        }
      }
      jornadas.push({
        fecha: slot.fecha,
        inicioProgramado: slot.inicioProgramado.toISOString(),
        finProgramado: slot.finProgramado.toISOString(),
        conflictos: conflicts,
      })
    }
    return {
      jornadas,
      total: jornadas.length,
      aptas: jornadas.filter((journey) => journey.conflictos.length === 0).length,
      puedeConfirmar: jornadas.every((journey) => journey.conflictos.length === 0),
    }
  }

  async previewPeriod(input: JourneyPeriodInput, actor: AuthenticatedUser) {
    ensureDispatcherOrAdmin(actor)
    return this.repository.transaction((tx) => this.evaluatePeriod(input, tx, actor))
  }

  async confirmPeriod(input: JourneyPeriodInput, actor: AuthenticatedUser) {
    ensureDispatcherOrAdmin(actor)
    try {
      return await this.repository.transaction(async (tx) => {
        await this.lockResources([input.busId], [input.conductorId], tx)
        const preview = await this.evaluatePeriod(input, tx, actor)
        if (!preview.puedeConfirmar) {
          throw new AppError(
            409,
            'JOURNEY_PERIOD_CONFLICT',
            'El período cambió o contiene conflictos; revise la vista previa',
            {
              jornadas: preview.jornadas.filter((journey) => journey.conflictos.length > 0),
            },
          )
        }
        const jornadas = [] as Array<{ id: number; fecha: string }>
        for (const row of preview.jornadas) {
          const created = await this.repository.create(
            {
              busId: input.busId,
              conductorId: input.conductorId,
              estado: 'PROGRAMADA',
              finProgramado: new Date(row.finProgramado),
              inicioProgramado: new Date(row.inicioProgramado),
              programadaPorId: actor.id,
              rutaId: input.rutaId ?? null,
            },
            tx,
          )
          jornadas.push({ id: created.id, fecha: row.fecha })
          await createJourneyChangeAlert(
            {
              affectedDriverIds: [created.conductorId],
              eventAt: created.createdAt,
              journeyId: created.id,
              occurrence: 'ALTA',
            },
            tx,
          )
        }
        await evaluatePreventiveAlertsForBus(input.busId, tx)
        return { creadas: jornadas.length, jornadas }
      })
    } catch (error) {
      translateJourneyError(error)
    }
  }

  async reportClosureProblem(id: number, motivo: string, actor: AuthenticatedUser) {
    if (actor.rol.codigo !== 'CONDUCTOR')
      throw new AppError(
        403,
        'FORBIDDEN',
        'Solo el Conductor puede informar sobre su propio cierre.',
      )
    return this.repository.transaction(async (tx) => {
      await this.repository.lockJourney(id, tx)
      const journey = await this.repository.findById(id, tx)
      if (!journey || journey.conductorId !== actor.id)
        throw new AppError(404, 'JOURNEY_NOT_FOUND', 'Jornada no encontrada')
      if (journey.estado !== 'EN_CURSO' || journey.finProgramado > new Date())
        throw new AppError(
          409,
          'JOURNEY_NOT_OVERDUE',
          'Solo se puede informar un cierre atrasado de una jornada en curso.',
        )
      if (!journey.cierreReportadoAt) {
        await this.repository.update(
          id,
          { cierreReportadoAt: new Date(), motivoCierrePendiente: motivo.trim() },
          tx,
        )
        await createJourneyClosureProblemAlert(id, tx)
      }
      return {
        jornada: await this.toDto((await this.repository.findById(id, tx))!, actor, new Date(), tx),
      }
    })
  }

  private async lockResources(busIds: number[], driverIds: number[], tx: JourneyTransaction) {
    for (const busId of [...new Set(busIds)].sort((a, b) => a - b)) {
      if (!(await this.repository.lockBus(busId, tx))) {
        throw new AppError(404, 'BUS_NOT_FOUND', 'Bus no encontrado')
      }
    }
    for (const driverId of [...new Set(driverIds)].sort((a, b) => a - b)) {
      if (!(await this.repository.lockDriver(driverId, tx))) {
        throw new AppError(404, 'DRIVER_NOT_FOUND', 'Conductor no encontrado')
      }
    }
  }

  private async ensureContext(
    busId: number,
    conductorId: number,
    rutaId: number | null,
    tx: JourneyTransaction,
  ) {
    const context = await this.repository.findContext(busId, conductorId, rutaId, tx)

    if (!context.bus) throw new AppError(404, 'BUS_NOT_FOUND', 'Bus no encontrado')
    if (context.bus.estadoOperativo === 'INACTIVO') {
      throw new AppError(
        409,
        'BUS_INACTIVE',
        'No se puede programar una jornada con un bus inactivo',
      )
    }
    if (
      !context.conductor ||
      context.conductor.estado !== 'ACTIVO' ||
      context.conductor.rol.codigo !== 'CONDUCTOR'
    ) {
      throw new AppError(409, 'DRIVER_NOT_AVAILABLE', 'El conductor no existe o no esta activo')
    }
    if (rutaId && (!context.ruta || !context.ruta.activa)) {
      throw new AppError(409, 'ROUTE_INACTIVE', 'La ruta no existe o no esta activa')
    }
    const availability = buildAvailability(
      await this.repository.getAvailabilityRecords(busId, conductorId, null, new Date(), tx),
    )
    const technicalCauses = availability.causas.filter(
      (cause) => cause.codigo !== 'CONFLICTO_JORNADA',
    )
    if (technicalCauses.length) {
      throw new AppError(
        409,
        'BUS_NOT_AVAILABLE',
        'El bus tiene un bloqueo vigente y no puede asignarse a una jornada',
        { causas: technicalCauses.map((cause) => cause.codigo) },
      )
    }
  }

  private async availability(journey: JourneyRecord, eventDate: Date, tx: JourneyTransaction) {
    if (TERMINAL_STATES.has(journey.estado)) {
      return buildAvailability({
        bus: null,
        conflictingJourney: null,
        novelty: null,
        order: null,
        preventive: [],
      })
    }

    return buildAvailability(
      await this.repository.getAvailabilityRecords(
        journey.busId,
        journey.conductorId,
        journey.id,
        eventDate,
        tx,
      ),
      eventDate,
    )
  }

  private async toDto(
    journey: JourneyRecord,
    actor: AuthenticatedUser,
    eventDate: Date,
    tx: JourneyTransaction,
  ) {
    return mapJourney(journey, actor, await this.availability(journey, eventDate, tx))
  }

  async cancel(id: number, input: CancelJourneyInput, actor: AuthenticatedUser) {
    ensureDispatcherOrAdmin(actor)
    const eventDate = new Date(input.fechaEvento)
    ensureEventDate(eventDate)

    try {
      return await this.repository.transaction(async (tx) => {
        const snapshot = await this.repository.findById(id, tx)
        if (!snapshot) throw new AppError(404, 'JOURNEY_NOT_FOUND', 'Jornada no encontrada')
        await this.lockResources([snapshot.busId], [snapshot.conductorId], tx)
        await this.repository.lockJourney(id, tx)
        const journey = await this.repository.findById(id, tx)
        if (!journey) throw new AppError(404, 'JOURNEY_NOT_FOUND', 'Jornada no encontrada')
        if (journey.estado !== 'PROGRAMADA' && journey.estado !== 'EN_CURSO') {
          throw new AppError(
            409,
            'INVALID_JOURNEY_TRANSITION',
            'La jornada ya esta en estado terminal',
          )
        }

        if (journey.estado === 'PROGRAMADA' && input.kilometrajeFinal !== undefined) {
          throw new AppError(
            400,
            'UNEXPECTED_FINAL_MILEAGE',
            'Una jornada no iniciada no admite kilometraje final',
          )
        }
        if (journey.estado === 'EN_CURSO' && input.kilometrajeFinal === undefined) {
          throw new AppError(
            400,
            'FINAL_MILEAGE_REQUIRED',
            'Debe registrar el kilometraje final de la jornada en curso',
          )
        }
        if (journey.inicioReal && eventDate < journey.inicioReal) {
          throw new AppError(
            409,
            'INVALID_EVENT_SEQUENCE',
            'El fin no puede preceder al inicio real',
          )
        }
        await this.repository.update(
          id,
          {
            cambioPorId: actor.id,
            estado: 'CANCELADA',
            fechaCambio: eventDate,
            ...(journey.estado === 'EN_CURSO'
              ? { finReal: eventDate, finalizadaPorId: actor.id }
              : {}),
            motivoCambio: input.motivo.trim(),
          },
          tx,
        )

        if (journey.estado === 'EN_CURSO') {
          await this.repository.registerJourneyReading(
            {
              actorId: actor.id,
              ...resolveJourneyObserver(input, journey, actor),
              busId: journey.busId,
              eventDate,
              journeyId: journey.id,
              mileage: input.kilometrajeFinal!,
              type: 'FIN_JORNADA',
            },
            tx,
          )
        }

        const updated = await this.repository.findById(id, tx)
        await createJourneyChangeAlert(
          {
            affectedDriverIds: [journey.conductorId],
            eventAt: eventDate,
            journeyId: journey.id,
            occurrence: 'CANCELACION',
          },
          tx,
        )
        await evaluateJourneyProjectionAlerts(id, tx)
        return { jornada: await this.toDto(updated!, actor, eventDate, tx) }
      })
    } catch (error) {
      translateJourneyError(error)
    }
  }

  async interrupt(id: number, input: InterruptJourneyInput, actor: AuthenticatedUser) {
    ensureDispatcherOrAdmin(actor)
    const eventDate = new Date(input.fechaEvento)
    ensureEventDate(eventDate)
    if (input.kilometrajeFinal === undefined && (input.observadoPorId || input.motivoRespaldo)) {
      throw new AppError(
        400,
        'UNEXPECTED_MILEAGE_PROVENANCE',
        'Sin lectura no se declara observador ni respaldo',
      )
    }

    try {
      return await this.repository.transaction(async (tx) => {
        const snapshot = await this.repository.findById(id, tx)
        if (!snapshot) throw new AppError(404, 'JOURNEY_NOT_FOUND', 'Jornada no encontrada')
        await this.lockResources([snapshot.busId], [snapshot.conductorId], tx)
        await this.repository.lockJourney(id, tx)
        const journey = await this.repository.findById(id, tx)
        if (!journey || journey.estado !== 'EN_CURSO') {
          throw new AppError(
            409,
            'INVALID_JOURNEY_TRANSITION',
            'Solo se interrumpe una jornada en curso',
          )
        }
        if (!journey.inicioReal || eventDate < journey.inicioReal) {
          throw new AppError(
            409,
            'INVALID_EVENT_SEQUENCE',
            'La interrupción no puede preceder al inicio real',
          )
        }

        const hasReading = input.kilometrajeFinal !== undefined
        const observer = hasReading ? resolveJourneyObserver(input, journey, actor) : null
        if (hasReading && !observer?.observerId) {
          throw new AppError(
            400,
            'MILEAGE_OBSERVER_REQUIRED',
            'Identifique quién observó físicamente el odómetro al interrumpir',
          )
        }
        await this.repository.update(
          id,
          {
            estado: 'INTERRUMPIDA',
            finReal: eventDate,
            finalizadaPorId: actor.id,
            cambioPorId: actor.id,
            fechaCambio: eventDate,
            motivoCambio: input.motivo.trim(),
            estadoConciliacionLectura: hasReading ? 'LECTURA_FINAL_REGISTRADA' : 'PENDIENTE',
            motivoAusenciaLectura: hasReading ? null : input.motivoSinLectura!.trim(),
            ...(hasReading ? { conciliadaPorId: actor.id, conciliadaAt: new Date() } : {}),
          },
          tx,
        )
        if (hasReading) {
          await this.repository.registerJourneyReading(
            {
              actorId: actor.id,
              ...observer!,
              busId: journey.busId,
              eventDate,
              journeyId: journey.id,
              mileage: input.kilometrajeFinal!,
              type: 'FIN_JORNADA',
            },
            tx,
          )
        }

        if (journey.bus.estadoOperativo === 'OPERATIVO') {
          await tx.bus.update({
            where: { id: journey.busId },
            data: { estadoOperativo: 'FUERA_DE_SERVICIO' },
          })
          await tx.busEstadoHistorial.create({
            data: {
              busId: journey.busId,
              cambiadoPorId: actor.id,
              estadoAnterior: 'OPERATIVO',
              estadoNuevo: 'FUERA_DE_SERVICIO',
              motivo: `Interrupción operativa de jornada #${journey.id}: ${input.motivo.trim()}`,
            },
          })
        }

        const updated = await this.repository.findById(id, tx)
        await evaluateJourneyProjectionAlerts(id, tx)
        return { jornada: await this.toDto(updated!, actor, eventDate, tx) }
      })
    } catch (error) {
      translateJourneyError(error)
    }
  }

  async reconcileFinalReading(
    id: number,
    input: ReconcileFinalReadingInput,
    actor: AuthenticatedUser,
  ) {
    ensureDispatcherOrAdmin(actor)
    try {
      return await this.repository.transaction(async (tx) => {
        const snapshot = await this.repository.findById(id, tx)
        if (!snapshot) throw new AppError(404, 'JOURNEY_NOT_FOUND', 'Jornada no encontrada')
        await this.lockResources([snapshot.busId], [snapshot.conductorId], tx)
        await this.repository.lockJourney(id, tx)
        const journey = await this.repository.findById(id, tx)
        if (
          !journey ||
          journey.estado !== 'INTERRUMPIDA' ||
          journey.estadoConciliacionLectura !== 'PENDIENTE' ||
          !journey.finReal
        ) {
          throw new AppError(
            409,
            'INVALID_RECONCILIATION',
            'Solo se concilia una interrupción con lectura pendiente',
          )
        }
        const observer = resolveJourneyObserver(input, journey, actor)
        if (!observer.observerId) {
          throw new AppError(
            400,
            'MILEAGE_OBSERVER_REQUIRED',
            'Identifique quién observó físicamente el odómetro al interrumpir',
          )
        }
        await this.repository.update(
          id,
          {
            estadoConciliacionLectura: 'LECTURA_FINAL_REGISTRADA',
            conciliadaPorId: actor.id,
            conciliadaAt: new Date(),
            detalleConciliacion: input.declaracionObservacion.trim(),
          },
          tx,
        )
        await this.repository.registerJourneyReading(
          {
            actorId: actor.id,
            ...observer,
            busId: journey.busId,
            eventDate: journey.finReal,
            journeyId: journey.id,
            mileage: input.kilometraje,
            type: 'FIN_JORNADA',
          },
          tx,
        )
        const updated = await this.repository.findById(id, tx)
        await evaluateJourneyProjectionAlerts(id, tx)
        return { jornada: await this.toDto(updated!, actor, new Date(), tx) }
      })
    } catch (error) {
      translateJourneyError(error)
    }
  }

  async markReadingUnrecoverable(
    id: number,
    input: MarkReadingUnrecoverableInput,
    actor: AuthenticatedUser,
  ) {
    if (actor.rol.codigo !== 'ADMINISTRADOR') {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Solo Administración puede cerrar la conciliación sin lectura',
      )
    }
    return this.repository.transaction(async (tx) => {
      await this.repository.lockJourney(id, tx)
      const journey = await this.repository.findById(id, tx)
      if (!journey) throw new AppError(404, 'JOURNEY_NOT_FOUND', 'Jornada no encontrada')
      if (journey.estado !== 'INTERRUMPIDA' || journey.estadoConciliacionLectura !== 'PENDIENTE') {
        throw new AppError(
          409,
          'INVALID_RECONCILIATION',
          'La conciliación ya se cerró o no corresponde a una interrupción',
        )
      }
      await this.repository.update(
        id,
        {
          estadoConciliacionLectura: 'NO_RECUPERABLE',
          conciliadaPorId: actor.id,
          conciliadaAt: new Date(),
          motivoNoRecuperable: input.motivo.trim(),
          detalleConciliacion: input.motivo.trim(),
        },
        tx,
      )
      const updated = await this.repository.findById(id, tx)
      return { jornada: await this.toDto(updated!, actor, new Date(), tx) }
    })
  }

  async create(input: CreateJourneyInput, actor: AuthenticatedUser) {
    ensureDispatcherOrAdmin(actor)
    const inicioProgramado = new Date(input.inicioProgramado)
    const finProgramado = new Date(input.finProgramado)

    try {
      return await this.repository.transaction(async (tx) => {
        await this.lockResources([input.busId], [input.conductorId], tx)
        await this.ensureContext(input.busId, input.conductorId, input.rutaId ?? null, tx)
        const journey = await this.repository.create(
          {
            ...(await buildProjectionSnapshot(input.rutaId ?? null, input.simulacion, tx)),
            busId: input.busId,
            conductorId: input.conductorId,
            estado: 'PROGRAMADA',
            finProgramado,
            inicioProgramado,
            programadaPorId: actor.id,
            rutaId: input.rutaId ?? null,
          },
          tx,
        )

        await createJourneyChangeAlert(
          {
            affectedDriverIds: [journey.conductorId],
            eventAt: journey.createdAt,
            journeyId: journey.id,
            occurrence: 'ALTA',
          },
          tx,
        )

        await evaluatePreventiveAlertsForBus(journey.busId, tx)
        await evaluateJourneyProjectionAlerts(journey.id, tx)
        return { jornada: await this.toDto(journey, actor, new Date(), tx) }
      })
    } catch (error) {
      translateJourneyError(error)
    }
  }

  async finish(id: number, input: JourneyReadingInput, actor: AuthenticatedUser) {
    const eventDate = new Date(input.fechaEvento)
    ensureEventDate(eventDate)

    try {
      return await this.repository.transaction(async (tx) => {
        const snapshot = await this.repository.findById(id, tx)
        if (!snapshot) throw new AppError(404, 'JOURNEY_NOT_FOUND', 'Jornada no encontrada')
        ensureOwnJourneyAction(snapshot, actor)
        await this.lockResources([snapshot.busId], [snapshot.conductorId], tx)
        await this.repository.lockJourney(id, tx)
        const journey = await this.repository.findById(id, tx)
        if (!journey) throw new AppError(404, 'JOURNEY_NOT_FOUND', 'Jornada no encontrada')
        ensureOwnJourneyAction(journey, actor)
        if (journey.estado !== 'EN_CURSO') {
          throw new AppError(
            409,
            'INVALID_JOURNEY_TRANSITION',
            'Solo una jornada en curso puede finalizarse',
          )
        }
        if (!journey.inicioReal || eventDate < journey.inicioReal) {
          throw new AppError(
            409,
            'INVALID_EVENT_SEQUENCE',
            'El fin no puede preceder al inicio real',
          )
        }

        await this.repository.update(
          id,
          {
            estado: 'FINALIZADA',
            finReal: eventDate,
            finalizadaPorId: actor.id,
          },
          tx,
        )
        await this.repository.registerJourneyReading(
          {
            actorId: actor.id,
            ...resolveJourneyObserver(input, journey, actor),
            busId: journey.busId,
            eventDate,
            journeyId: journey.id,
            mileage: input.kilometraje,
            type: 'FIN_JORNADA',
          },
          tx,
        )

        const updated = await this.repository.findById(id, tx)
        await evaluateJourneyProjectionAlerts(id, tx)
        await evaluatePreventiveAlertsForBus(journey.busId, tx)
        return { jornada: await this.toDto(updated!, actor, eventDate, tx) }
      })
    } catch (error) {
      translateJourneyError(error)
    }
  }

  async getById(id: number, actor: AuthenticatedUser) {
    return this.repository.transaction(async (tx) => {
      const journey = await this.repository.findById(id, tx)
      if (!journey) throw new AppError(404, 'JOURNEY_NOT_FOUND', 'Jornada no encontrada')
      ensureJourneyReader(journey, actor)
      return { jornada: await this.toDto(journey, actor, new Date(), tx) }
    })
  }

  async getMyJourney(actor: AuthenticatedUser) {
    if (actor.rol.codigo !== 'CONDUCTOR') {
      throw new AppError(403, 'FORBIDDEN', 'La consulta corresponde al Conductor')
    }

    const now = new Date()
    const [current, pending, next] = await this.repository.findCurrentAndNextByDriver(actor.id, now)

    return this.repository.transaction(async (tx) => ({
      jornadaPendiente: pending ? await this.toDto(pending, actor, now, tx) : null,
      jornadaActual: current ? await this.toDto(current, actor, now, tx) : null,
      proximaJornada: next ? await this.toDto(next, actor, now, tx) : null,
    }))
  }

  async getOptions(actor: AuthenticatedUser) {
    ensureDispatcherOrAdmin(actor)
    return this.repository.listOptions()
  }

  async list(query: ListJourneysQuery, actor: AuthenticatedUser) {
    if (
      actor.rol.codigo !== 'ADMINISTRADOR' &&
      actor.rol.codigo !== 'DESPACHADOR' &&
      actor.rol.codigo !== 'CONDUCTOR'
    ) {
      throw new AppError(403, 'FORBIDDEN', 'No tiene permisos para consultar jornadas')
    }

    const where: Prisma.JornadaOperativaWhereInput = {}
    if (actor.rol.codigo === 'CONDUCTOR') where.conductorId = actor.id
    else if (query.conductorId) where.conductorId = query.conductorId
    if (query.busId) where.busId = query.busId
    if (query.rutaId) where.rutaId = query.rutaId
    if (query.estado) where.estado = { in: query.estado }
    if (query.cierreAtrasado === 'true') {
      where.estado = 'EN_CURSO'
      where.finReal = null
      where.finProgramado = { lt: new Date() }
    }
    if (query.requiereReasignacion === 'true') {
      if (actor.rol.codigo === 'CONDUCTOR') {
        throw new AppError(403, 'FORBIDDEN', 'No puede consultar la cola de reasignación')
      }
      where.estado = { in: ['PROGRAMADA', 'EN_CURSO'] }
      where.NOT = { conductor: { is: { estado: 'ACTIVO', rol: { is: { codigo: 'CONDUCTOR' } } } } }
    }
    if (query.desde || query.hasta) {
      where.AND = {
        inicioProgramado: query.hasta ? { lte: new Date(query.hasta) } : undefined,
        finProgramado: query.desde ? { gte: new Date(query.desde) } : undefined,
      }
    }
    if (query.buscar) {
      const buscar = query.buscar
      where.OR = [
        { bus: { codigoInterno: { contains: buscar, mode: 'insensitive' } } },
        { bus: { placa: { contains: buscar, mode: 'insensitive' } } },
        { conductor: { nombre: { contains: buscar, mode: 'insensitive' } } },
        { ruta: { codigo: { contains: buscar, mode: 'insensitive' } } },
        { ruta: { nombre: { contains: buscar, mode: 'insensitive' } } },
      ]
    }

    const orderBy =
      query.cierreAtrasado === 'true'
        ? { finProgramado: 'asc' as const }
        : ({
            [query.orden]: query.direccion,
          } as Prisma.JornadaOperativaOrderByWithRelationInput)
    const skip = (query.pagina - 1) * query.limite
    const [total, journeys] = await Promise.all([
      this.repository.count(where),
      this.repository.list(where, orderBy, skip, query.limite),
    ])
    const now = new Date()
    const mapped = await this.repository.transaction((tx) =>
      Promise.all(journeys.map((journey) => this.toDto(journey, actor, now, tx))),
    )

    return {
      jornadas: mapped,
      paginacion: {
        limite: query.limite,
        pagina: query.pagina,
        paginas: Math.max(1, Math.ceil(total / query.limite)),
        total,
      },
    }
  }

  async listReadings(id: number, actor: AuthenticatedUser) {
    const journey = await this.repository.findById(id)
    if (!journey) throw new AppError(404, 'JOURNEY_NOT_FOUND', 'Jornada no encontrada')
    ensureJourneyReader(journey, actor)
    const readings = await this.repository.listReadings(id)
    return { lecturas: readings.map(mapReading) }
  }

  async reassign(id: number, input: ReassignJourneyInput, actor: AuthenticatedUser) {
    ensureDispatcherOrAdmin(actor)
    const eventDate = new Date(input.fechaEvento)
    ensureEventDate(eventDate)

    try {
      return await this.repository.transaction(async (tx) => {
        const snapshot = await this.repository.findById(id, tx)
        if (!snapshot) throw new AppError(404, 'JOURNEY_NOT_FOUND', 'Jornada no encontrada')
        if (
          snapshot.estado !== 'PROGRAMADA' &&
          snapshot.estado !== 'EN_CURSO' &&
          snapshot.estado !== 'INTERRUMPIDA'
        ) {
          throw new AppError(
            409,
            'INVALID_JOURNEY_TRANSITION',
            'La jornada ya esta en estado terminal',
          )
        }

        const busId = input.busId ?? snapshot.busId
        if (snapshot.estado === 'INTERRUMPIDA' && busId === snapshot.busId) {
          throw new AppError(
            400,
            'REPLACEMENT_BUS_REQUIRED',
            'La sucesora necesita un bus sustituto',
          )
        }
        const conductorId = input.conductorId ?? snapshot.conductorId
        const rutaId = input.rutaId === undefined ? snapshot.rutaId : input.rutaId
        const inicioProgramado = input.inicioProgramado
          ? new Date(input.inicioProgramado)
          : snapshot.estado === 'EN_CURSO' || snapshot.estado === 'INTERRUMPIDA'
            ? eventDate
            : snapshot.inicioProgramado
        const finProgramado = input.finProgramado
          ? new Date(input.finProgramado)
          : snapshot.finProgramado

        if (inicioProgramado >= finProgramado) {
          throw new AppError(
            400,
            'INVALID_SCHEDULE',
            'El inicio programado debe ser anterior al fin programado',
          )
        }
        if (
          (snapshot.estado === 'EN_CURSO' && inicioProgramado < eventDate) ||
          (snapshot.estado === 'INTERRUMPIDA' &&
            (!snapshot.finReal || inicioProgramado < snapshot.finReal))
        ) {
          throw new AppError(
            400,
            'INVALID_SUCCESSOR_START',
            'La sucesora no puede programarse antes del cierre del tramo anterior',
          )
        }
        if (snapshot.estado === 'PROGRAMADA' && input.kilometrajeFinal !== undefined) {
          throw new AppError(
            400,
            'UNEXPECTED_FINAL_MILEAGE',
            'Una jornada no iniciada no admite kilometraje final',
          )
        }
        if (snapshot.estado === 'EN_CURSO' && input.kilometrajeFinal === undefined) {
          throw new AppError(
            400,
            'FINAL_MILEAGE_REQUIRED',
            'Debe cerrar el tramo en curso con kilometraje final',
          )
        }
        if (snapshot.estado === 'INTERRUMPIDA' && input.kilometrajeFinal !== undefined) {
          throw new AppError(
            400,
            'UNEXPECTED_FINAL_MILEAGE',
            'La sucesora no declara la lectura del tramo interrumpido',
          )
        }

        await this.lockResources([snapshot.busId, busId], [snapshot.conductorId, conductorId], tx)
        await this.repository.lockJourney(id, tx)
        const journey = await this.repository.findById(id, tx)
        if (!journey || journey.estado !== snapshot.estado) {
          throw new AppError(
            409,
            'INVALID_JOURNEY_TRANSITION',
            'La jornada cambio mientras se procesaba la solicitud',
          )
        }
        if (journey.estado === 'INTERRUMPIDA' && journey.jornadaSucesora) {
          throw new AppError(
            409,
            'SUCCESSOR_ALREADY_EXISTS',
            'La jornada interrumpida ya tiene sucesora',
          )
        }
        if (journey.inicioReal && eventDate < journey.inicioReal) {
          throw new AppError(
            409,
            'INVALID_EVENT_SEQUENCE',
            'El cambio no puede preceder al inicio real',
          )
        }
        if (journey.estado === 'INTERRUMPIDA' && journey.finReal && eventDate < journey.finReal) {
          throw new AppError(
            409,
            'INVALID_EVENT_SEQUENCE',
            'El reemplazo no puede preceder a la interrupción',
          )
        }

        await this.ensureContext(busId, conductorId, rutaId, tx)
        if (journey.estado !== 'INTERRUMPIDA') {
          await this.repository.update(
            id,
            {
              cambioPorId: actor.id,
              estado: 'REASIGNADA',
              fechaCambio: eventDate,
              ...(journey.estado === 'EN_CURSO'
                ? { finReal: eventDate, finalizadaPorId: actor.id }
                : {}),
              motivoCambio: input.motivo.trim(),
            },
            tx,
          )
        }
        if (journey.estado === 'EN_CURSO') {
          await this.repository.registerJourneyReading(
            {
              actorId: actor.id,
              ...resolveJourneyObserver(input, journey, actor),
              busId: journey.busId,
              eventDate,
              journeyId: journey.id,
              mileage: input.kilometrajeFinal!,
              type: 'FIN_JORNADA',
            },
            tx,
          )
        }

        const successor = await this.repository.create(
          {
            ...(await buildProjectionSnapshot(rutaId, input.simulacion, tx)),
            busId,
            conductorId,
            estado: 'PROGRAMADA',
            finProgramado,
            inicioProgramado,
            jornadaAnteriorId: journey.id,
            ...(journey.estado === 'INTERRUMPIDA' ? { motivoSucesion: input.motivo.trim() } : {}),
            programadaPorId: actor.id,
            rutaId,
          },
          tx,
        )
        const previous = await this.repository.findById(id, tx)

        await createJourneyChangeAlert(
          {
            affectedDriverIds: [journey.conductorId, successor.conductorId],
            eventAt: eventDate,
            journeyId: successor.id,
            occurrence: 'REASIGNACION',
          },
          tx,
        )

        await evaluateJourneyProjectionAlerts(journey.id, tx)
        await evaluateJourneyProjectionAlerts(successor.id, tx)
        await evaluatePreventiveAlertsForBus(successor.busId, tx)
        return {
          jornadaAnterior: await this.toDto(previous!, actor, eventDate, tx),
          jornadaSucesora: await this.toDto(successor, actor, eventDate, tx),
        }
      })
    } catch (error) {
      translateJourneyError(error)
    }
  }

  async start(id: number, input: JourneyReadingInput, actor: AuthenticatedUser) {
    const eventDate = new Date(input.fechaEvento)
    ensureEventDate(eventDate)

    try {
      return await this.repository.transaction(async (tx) => {
        const snapshot = await this.repository.findById(id, tx)
        if (!snapshot) throw new AppError(404, 'JOURNEY_NOT_FOUND', 'Jornada no encontrada')
        ensureOwnJourneyAction(snapshot, actor)
        await this.lockResources([snapshot.busId], [snapshot.conductorId], tx)
        await this.repository.lockJourney(id, tx)
        const journey = await this.repository.findById(id, tx)
        if (!journey) throw new AppError(404, 'JOURNEY_NOT_FOUND', 'Jornada no encontrada')
        ensureOwnJourneyAction(journey, actor)
        if (journey.estado !== 'PROGRAMADA') {
          throw new AppError(
            409,
            'INVALID_JOURNEY_TRANSITION',
            'Solo una jornada programada puede iniciarse',
          )
        }

        if (eventDate < journey.inicioProgramado) {
          throw new AppError(
            409,
            'JOURNEY_NOT_DUE',
            'La salida no puede preceder al inicio programado; solicite a Despacho ajustar la jornada',
          )
        }
        const availability = await this.availability(journey, eventDate, tx)
        if (!availability.disponible) {
          throw new AppError(409, 'BUS_NOT_AVAILABLE', 'El bus no esta disponible para iniciar', {
            causaPrincipal: availability.causaPrincipal,
            causas: availability.causas.map((cause) => cause.codigo),
          })
        }

        await this.repository.update(
          id,
          {
            estado: 'EN_CURSO',
            iniciadaPorId: actor.id,
            inicioReal: eventDate,
          },
          tx,
        )
        await this.repository.registerJourneyReading(
          {
            actorId: actor.id,
            ...resolveJourneyObserver(input, journey, actor),
            busId: journey.busId,
            eventDate,
            journeyId: journey.id,
            mileage: input.kilometraje,
            type: 'INICIO_JORNADA',
          },
          tx,
        )

        const updated = await this.repository.findById(id, tx)
        await evaluateJourneyProjectionAlerts(id, tx)
        await evaluatePreventiveAlertsForBus(journey.busId, tx)
        return { jornada: await this.toDto(updated!, actor, eventDate, tx) }
      })
    } catch (error) {
      translateJourneyError(error)
    }
  }
}
