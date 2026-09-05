import { Prisma, type EstadoJornada } from '@prisma/client'

import type { AuthenticatedUser } from '../auth/auth.types.js'
import { AppError } from '../shared/http.js'
import {
  JourneyRepository,
  type AvailabilityRecords,
  type JourneyRecord,
  type JourneyTransaction,
} from './journey.repository.js'
import type {
  CancelJourneyInput,
  CreateJourneyInput,
  JourneyReadingInput,
  ListJourneysQuery,
  ReassignJourneyInput,
} from './journey.schemas.js'
import type {
  AvailabilityCauseDto,
  AvailabilityDto,
  JourneyActionsDto,
  JourneyDto,
  JourneyReadingDto,
  JourneyUserRefDto,
} from './journey.types.js'

const TERMINAL_STATES = new Set<EstadoJornada>(['FINALIZADA', 'CANCELADA', 'REASIGNADA'])

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
    id: reading.id,
    kilometraje: reading.kilometrajeNuevo,
    kilometrajeAnterior: reading.kilometrajeAnterior,
    registradoPor: mapUser(reading.registradoPor),
    tipo: reading.tipo!,
  }
}

function buildAvailability(records: AvailabilityRecords): AvailabilityDto {
  const causas: AvailabilityCauseDto[] = []

  if (records.bus?.estadoOperativo === 'INACTIVO') {
    causas.push({
      bloquea: true,
      codigo: 'BUS_INACTIVO',
      mensaje: 'El bus esta inactivo',
      origenId: records.bus.id,
      origenTipo: 'BUS',
      prioridad: 500,
    })
  } else if (records.bus?.estadoOperativo === 'FUERA_DE_SERVICIO') {
    causas.push({
      bloquea: true,
      codigo: 'BUS_FUERA_DE_SERVICIO',
      mensaje: 'El bus esta fuera de servicio',
      origenId: records.bus.id,
      origenTipo: 'BUS',
      prioridad: 450,
    })
  } else if (records.bus?.estadoOperativo === 'EN_MANTENIMIENTO') {
    causas.push({
      bloquea: true,
      codigo: 'BUS_EN_MANTENIMIENTO',
      mensaje: 'El bus esta en mantenimiento',
      origenId: records.bus.id,
      origenTipo: 'BUS',
      prioridad: 400,
    })
  }

  if (records.order) {
    causas.push({
      bloquea: true,
      codigo: 'ORDEN_TECNICA_ACTIVA',
      mensaje: 'El bus tiene una orden tecnica activa',
      origenId: records.order.id,
      origenTipo: 'ORDEN',
      prioridad: 350,
    })
  }
  if (records.novelty) {
    causas.push({
      bloquea: true,
      codigo: 'NOVEDAD_BLOQUEANTE',
      mensaje: 'El bus tiene una novedad operativa bloqueante',
      origenId: records.novelty.id,
      origenTipo: 'NOVEDAD',
      prioridad: 300,
    })
  }
  if (records.preventive) {
    causas.push({
      bloquea: true,
      codigo: 'PREVENTIVO_VENCIDO_BLOQUEANTE',
      mensaje: 'El bus tiene mantenimiento preventivo vencido que bloquea la operacion',
      origenId: records.preventive.id,
      origenTipo: 'PREVENTIVO',
      prioridad: 250,
    })
  }
  if (records.conflictingJourney) {
    causas.push({
      bloquea: true,
      codigo: 'CONFLICTO_JORNADA',
      mensaje: 'El bus o el conductor tiene otra jornada en el intervalo',
      origenId: records.conflictingJourney.id,
      origenTipo: 'JORNADA',
      prioridad: 200,
    })
  }

  causas.sort((left, right) => right.prioridad - left.prioridad)
  return {
    causaPrincipal: causas[0]?.codigo ?? null,
    causas,
    disponible: causas.length === 0,
    evaluadoAt: new Date().toISOString(),
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
      (dispatcher || ownDriver) && journey.estado === 'PROGRAMADA' && availability.disponible,
    puedeReasignar:
      dispatcher && (journey.estado === 'PROGRAMADA' || journey.estado === 'EN_CURSO'),
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
    acciones: buildActions(journey, actor, availability),
    bus: journey.bus,
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
    programadaPor: mapUser(journey.programadaPor),
    ruta: journey.ruta,
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

  private async lockResources(busIds: string[], driverIds: string[], tx: JourneyTransaction) {
    for (const busId of [...new Set(busIds)].sort()) {
      if (!(await this.repository.lockBus(busId, tx))) {
        throw new AppError(404, 'BUS_NOT_FOUND', 'Bus no encontrado')
      }
    }
    for (const driverId of [...new Set(driverIds)].sort()) {
      if (!(await this.repository.lockDriver(driverId, tx))) {
        throw new AppError(404, 'DRIVER_NOT_FOUND', 'Conductor no encontrado')
      }
    }
  }

  private async ensureContext(
    busId: string,
    conductorId: string,
    rutaId: string | null,
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
  }

  private async availability(journey: JourneyRecord, eventDate: Date, tx: JourneyTransaction) {
    if (TERMINAL_STATES.has(journey.estado)) {
      return buildAvailability({
        bus: null,
        conflictingJourney: null,
        novelty: null,
        order: null,
        preventive: null,
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

  async cancel(id: string, input: CancelJourneyInput, actor: AuthenticatedUser) {
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
        return { jornada: await this.toDto(updated!, actor, eventDate, tx) }
      })
    } catch (error) {
      translateJourneyError(error)
    }
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

        return { jornada: await this.toDto(journey, actor, new Date(), tx) }
      })
    } catch (error) {
      translateJourneyError(error)
    }
  }

  async finish(id: string, input: JourneyReadingInput, actor: AuthenticatedUser) {
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
            busId: journey.busId,
            eventDate,
            journeyId: journey.id,
            mileage: input.kilometraje,
            type: 'FIN_JORNADA',
          },
          tx,
        )

        const updated = await this.repository.findById(id, tx)
        return { jornada: await this.toDto(updated!, actor, eventDate, tx) }
      })
    } catch (error) {
      translateJourneyError(error)
    }
  }

  async getById(id: string, actor: AuthenticatedUser) {
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
    const [current, next] = await this.repository.findCurrentAndNextByDriver(actor.id, now)

    return this.repository.transaction(async (tx) => ({
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

    const orderBy = {
      [query.orden]: query.direccion,
    } as Prisma.JornadaOperativaOrderByWithRelationInput
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

  async listReadings(id: string, actor: AuthenticatedUser) {
    const journey = await this.repository.findById(id)
    if (!journey) throw new AppError(404, 'JOURNEY_NOT_FOUND', 'Jornada no encontrada')
    ensureJourneyReader(journey, actor)
    const readings = await this.repository.listReadings(id)
    return { lecturas: readings.map(mapReading) }
  }

  async reassign(id: string, input: ReassignJourneyInput, actor: AuthenticatedUser) {
    ensureDispatcherOrAdmin(actor)
    const eventDate = new Date(input.fechaEvento)
    ensureEventDate(eventDate)

    try {
      return await this.repository.transaction(async (tx) => {
        const snapshot = await this.repository.findById(id, tx)
        if (!snapshot) throw new AppError(404, 'JOURNEY_NOT_FOUND', 'Jornada no encontrada')
        if (snapshot.estado !== 'PROGRAMADA' && snapshot.estado !== 'EN_CURSO') {
          throw new AppError(
            409,
            'INVALID_JOURNEY_TRANSITION',
            'La jornada ya esta en estado terminal',
          )
        }

        const busId = input.busId ?? snapshot.busId
        const conductorId = input.conductorId ?? snapshot.conductorId
        const rutaId = input.rutaId === undefined ? snapshot.rutaId : input.rutaId
        const inicioProgramado = input.inicioProgramado
          ? new Date(input.inicioProgramado)
          : snapshot.estado === 'EN_CURSO'
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
        if (snapshot.estado === 'EN_CURSO' && inicioProgramado < eventDate) {
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
        if (journey.inicioReal && eventDate < journey.inicioReal) {
          throw new AppError(
            409,
            'INVALID_EVENT_SEQUENCE',
            'El cambio no puede preceder al inicio real',
          )
        }

        await this.ensureContext(busId, conductorId, rutaId, tx)
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
        if (journey.estado === 'EN_CURSO') {
          await this.repository.registerJourneyReading(
            {
              actorId: actor.id,
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
            busId,
            conductorId,
            estado: 'PROGRAMADA',
            finProgramado,
            inicioProgramado,
            jornadaAnteriorId: journey.id,
            programadaPorId: actor.id,
            rutaId,
          },
          tx,
        )
        const previous = await this.repository.findById(id, tx)

        return {
          jornadaAnterior: await this.toDto(previous!, actor, eventDate, tx),
          jornadaSucesora: await this.toDto(successor, actor, eventDate, tx),
        }
      })
    } catch (error) {
      translateJourneyError(error)
    }
  }

  async start(id: string, input: JourneyReadingInput, actor: AuthenticatedUser) {
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
            busId: journey.busId,
            eventDate,
            journeyId: journey.id,
            mileage: input.kilometraje,
            type: 'INICIO_JORNADA',
          },
          tx,
        )

        const updated = await this.repository.findById(id, tx)
        return { jornada: await this.toDto(updated!, actor, eventDate, tx) }
      })
    } catch (error) {
      translateJourneyError(error)
    }
  }
}
