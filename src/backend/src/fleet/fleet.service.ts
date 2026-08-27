import { type EstadoBus, Prisma } from '@prisma/client'

import type { AuthenticatedUser } from '../auth/auth.types.js'
import { AppError } from '../shared/http.js'
import { type BusDetailRecord, type BusSummaryRecord, FleetRepository } from './fleet.repository.js'
import type {
  ActiveAssignmentDto,
  BusDetailDto,
  BusSummaryDto,
  DriverOptionDto,
  FleetSummaryDto,
  MileageReadingDto,
  ResponsibleDto,
  StateHistoryDto,
} from './fleet.types.js'
import type {
  AssignDriverInput,
  ChangeBusStateInput,
  CreateBusInput,
  ListBusesQuery,
  RegisterMileageInput,
  UpdateBusInput,
} from './fleet.schemas.js'

const estadoBusDefaults: Record<EstadoBus, number> = {
  EN_MANTENIMIENTO: 0,
  FUERA_DE_SERVICIO: 0,
  INACTIVO: 0,
  OPERATIVO: 0,
}

interface ResponsibleRecord {
  email: string
  id: string
  nombre: string
  telefono: string | null
}

interface AssignmentRecord {
  activa: boolean
  asignadoPor: ResponsibleRecord
  bus?: {
    codigoInterno: string
    id: string
    placa: string
  }
  conductor: ResponsibleRecord
  fechaFin: Date | null
  fechaInicio: Date
  id: string
  motivo: string | null
}

interface MileageReadingRecord {
  fechaRegistro: Date
  id: string
  kilometrajeAnterior: number
  kilometrajeNuevo: number
  motivo: string | null
  registradoPor: ResponsibleRecord
}

interface StateHistoryRecord {
  cambiadoPor: ResponsibleRecord
  estadoAnterior: EstadoBus | null
  estadoNuevo: EstadoBus
  fechaCambio: Date
  id: string
  motivo: string | null
}

function normalizeIdentifier(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function mapResponsible(user: ResponsibleRecord): ResponsibleDto {
  return {
    email: user.email,
    id: user.id,
    nombre: user.nombre,
    telefono: user.telefono,
  }
}

function mapAssignment(assignment: AssignmentRecord): ActiveAssignmentDto {
  return {
    activa: assignment.activa,
    asignadoPor: mapResponsible(assignment.asignadoPor),
    bus: assignment.bus
      ? {
          codigoInterno: assignment.bus.codigoInterno,
          id: assignment.bus.id,
          placa: assignment.bus.placa,
        }
      : undefined,
    conductor: mapResponsible(assignment.conductor),
    fechaFin: assignment.fechaFin?.toISOString() ?? null,
    fechaInicio: assignment.fechaInicio.toISOString(),
    id: assignment.id,
    motivo: assignment.motivo,
  }
}

function mapMileageReading(reading: MileageReadingRecord): MileageReadingDto {
  return {
    fechaRegistro: reading.fechaRegistro.toISOString(),
    id: reading.id,
    kilometrajeAnterior: reading.kilometrajeAnterior,
    kilometrajeNuevo: reading.kilometrajeNuevo,
    motivo: reading.motivo,
    registradoPor: mapResponsible(reading.registradoPor),
  }
}

function mapStateHistory(history: StateHistoryRecord): StateHistoryDto {
  return {
    cambiadoPor: mapResponsible(history.cambiadoPor),
    estadoAnterior: history.estadoAnterior,
    estadoNuevo: history.estadoNuevo,
    fechaCambio: history.fechaCambio.toISOString(),
    id: history.id,
    motivo: history.motivo,
  }
}

function mapBusSummary(bus: BusSummaryRecord | BusDetailRecord): BusSummaryDto {
  const activeAssignment = bus.asignaciones.find((assignment) => assignment.activa)

  return {
    anio: bus.anio,
    codigoInterno: bus.codigoInterno,
    conductorAsignado: activeAssignment ? mapResponsible(activeAssignment.conductor) : null,
    estadoOperativo: bus.estadoOperativo,
    id: bus.id,
    kilometrajeActual: bus.kilometrajeActual,
    marca: bus.marca,
    modelo: bus.modelo,
    placa: bus.placa,
    updatedAt: bus.updatedAt.toISOString(),
  }
}

function mapBusDetail(bus: BusDetailRecord): BusDetailDto {
  return {
    ...mapBusSummary(bus),
    asignacionesHistorial: bus.asignaciones.map(mapAssignment),
    estadosHistorial: bus.estadosHistorial.map(mapStateHistory),
    lecturasKilometraje: bus.lecturasKilometraje.map(mapMileageReading),
  }
}

function duplicateMessageFromTarget(target: unknown) {
  const serializedTarget = Array.isArray(target) ? target.join(',') : String(target ?? '')

  if (serializedTarget.includes('placa')) {
    return 'La placa ya esta registrada'
  }

  if (serializedTarget.includes('codigo')) {
    return 'El codigo interno ya esta registrado'
  }

  return 'Ya existe un registro con esos datos'
}

function translatePrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new AppError(
        409,
        'DUPLICATE_BUS_IDENTIFIER',
        duplicateMessageFromTarget(error.meta?.target),
      )
    }

    if (error.code === 'P2025') {
      throw new AppError(404, 'BUS_NOT_FOUND', 'Bus no encontrado')
    }
  }

  throw error
}

function ensureAdmin(actor: AuthenticatedUser) {
  if (actor.rol.codigo !== 'ADMINISTRADOR') {
    throw new AppError(403, 'FORBIDDEN', 'No tiene permisos para realizar esta operacion')
  }
}

export class FleetService {
  constructor(private readonly fleetRepository = new FleetRepository()) {}

  async assignDriver(busId: string, input: AssignDriverInput, actor: AuthenticatedUser) {
    ensureAdmin(actor)

    const [bus, conductor] = await Promise.all([
      this.fleetRepository.findBusSummaryById(busId),
      this.fleetRepository.findDriverById(input.conductorId),
    ])

    if (!bus) {
      throw new AppError(404, 'BUS_NOT_FOUND', 'Bus no encontrado')
    }

    if (bus.estadoOperativo === 'INACTIVO') {
      throw new AppError(400, 'BUS_INACTIVE', 'No se puede asignar un bus inactivo')
    }

    if (!conductor || conductor.estado !== 'ACTIVO' || conductor.rol.codigo !== 'CONDUCTOR') {
      throw new AppError(
        400,
        'INVALID_DRIVER',
        'Solo se pueden asignar usuarios activos con rol Conductor',
      )
    }

    try {
      const result = await this.fleetRepository.reassignDriver(
        busId,
        input.conductorId,
        actor.id,
        input.motivo ?? null,
      )

      if (!result) {
        throw new AppError(404, 'BUS_NOT_FOUND', 'Bus no encontrado')
      }

      if (!result.assignment) {
        throw new AppError(400, 'ASSIGNMENT_NOT_CREATED', 'No fue posible crear la asignacion')
      }

      return {
        asignacion: mapAssignment(result.assignment),
      }
    } catch (error) {
      translatePrismaError(error)
    }
  }

  async changeState(busId: string, input: ChangeBusStateInput, actor: AuthenticatedUser) {
    ensureAdmin(actor)

    try {
      const result = await this.fleetRepository.updateState(
        busId,
        input.estadoNuevo,
        actor.id,
        input.motivo,
      )

      if (result.status === 'NOT_FOUND') {
        throw new AppError(404, 'BUS_NOT_FOUND', 'Bus no encontrado')
      }

      if (result.status === 'SAME_STATE') {
        throw new AppError(400, 'SAME_BUS_STATE', 'El bus ya tiene ese estado operativo')
      }

      return {
        bus: {
          estadoOperativo: result.bus.estadoOperativo,
          id: result.bus.id,
        },
        historial: mapStateHistory(result.historial),
      }
    } catch (error) {
      translatePrismaError(error)
    }
  }

  async createBus(input: CreateBusInput, actor: AuthenticatedUser) {
    ensureAdmin(actor)

    try {
      const bus = await this.fleetRepository.createBusWithInitialState(
        {
          anio: input.anio,
          codigoInterno: normalizeIdentifier(input.codigoInterno),
          estadoOperativo: input.estadoOperativo,
          kilometrajeActual: input.kilometrajeActual,
          marca: normalizeText(input.marca),
          modelo: normalizeText(input.modelo),
          placa: normalizeIdentifier(input.placa),
        },
        actor.id,
        input.motivoEstado ?? null,
      )

      return {
        bus: mapBusDetail(bus),
      }
    } catch (error) {
      translatePrismaError(error)
    }
  }

  async getAssignments(busId: string, limite: number, actor: AuthenticatedUser) {
    ensureAdmin(actor)
    await this.ensureBusExists(busId)

    const assignments = await this.fleetRepository.getAssignments(busId, limite)

    return {
      asignaciones: assignments.map(mapAssignment),
    }
  }

  async getAssignedBusForDriver(actor: AuthenticatedUser) {
    if (actor.rol.codigo !== 'CONDUCTOR') {
      throw new AppError(403, 'FORBIDDEN', 'No tiene permisos para realizar esta operacion')
    }

    const assignment = await this.fleetRepository.findActiveAssignmentWithBusByConductor(actor.id)

    if (!assignment) {
      return {
        asignacion: null,
        bus: null,
      }
    }

    const bus = mapBusDetail(assignment.bus)

    return {
      asignacion: mapAssignment({
        activa: assignment.activa,
        asignadoPor: assignment.asignadoPor,
        conductor: assignment.conductor,
        fechaFin: assignment.fechaFin,
        fechaInicio: assignment.fechaInicio,
        id: assignment.id,
        motivo: assignment.motivo,
      }),
      bus: {
        ...bus,
        asignacionesHistorial: [],
      },
    }
  }

  async getAvailableDrivers(busId: string | undefined, actor: AuthenticatedUser) {
    ensureAdmin(actor)

    if (busId) {
      await this.ensureBusExists(busId)
    }

    const drivers = await this.fleetRepository.findAvailableDrivers(busId)

    const conductores: DriverOptionDto[] = drivers.map((driver) => {
      const activeAssignment = driver.asignacionesConductor[0]

      return {
        ...mapResponsible(driver),
        asignacionActiva: activeAssignment
          ? {
              bus: {
                codigoInterno: activeAssignment.bus.codigoInterno,
                id: activeAssignment.bus.id,
                placa: activeAssignment.bus.placa,
              },
              id: activeAssignment.id,
            }
          : null,
      }
    })

    return { conductores }
  }

  async getBus(busId: string, actor: AuthenticatedUser) {
    if (actor.rol.codigo === 'MECANICO') {
      throw new AppError(403, 'FORBIDDEN', 'No tiene permisos para realizar esta operacion')
    }

    if (actor.rol.codigo === 'CONDUCTOR') {
      const assignment = await this.fleetRepository.findActiveAssignmentWithBusByConductor(actor.id)

      if (!assignment || assignment.busId !== busId) {
        throw new AppError(403, 'FORBIDDEN', 'No puede consultar buses no asignados')
      }

      const bus = mapBusDetail(assignment.bus)

      return {
        bus: {
          ...bus,
          asignacionesHistorial: [],
        },
      }
    }

    const bus = await this.fleetRepository.findBusDetailById(busId)

    if (!bus) {
      throw new AppError(404, 'BUS_NOT_FOUND', 'Bus no encontrado')
    }

    return {
      bus: mapBusDetail(bus),
    }
  }

  async getMileageReadings(busId: string, limite: number, actor: AuthenticatedUser) {
    ensureAdmin(actor)
    await this.ensureBusExists(busId)

    const lecturas = await this.fleetRepository.getMileageReadings(busId, limite)

    return {
      lecturas: lecturas.map(mapMileageReading),
    }
  }

  async getStateHistory(busId: string, limite: number, actor: AuthenticatedUser) {
    ensureAdmin(actor)
    await this.ensureBusExists(busId)

    const historial = await this.fleetRepository.getStateHistory(busId, limite)

    return {
      historial: historial.map(mapStateHistory),
    }
  }

  async listBuses(query: ListBusesQuery, actor: AuthenticatedUser) {
    ensureAdmin(actor)

    const where = this.createBusWhere(query)
    const skip = (query.pagina - 1) * query.limite
    const [total, buses] = await Promise.all([
      this.fleetRepository.countBuses(where),
      this.fleetRepository.listBuses(where, skip, query.limite),
    ])
    const totalPaginas = Math.max(1, Math.ceil(total / query.limite))

    return {
      buses: buses.map(mapBusSummary),
      paginacion: {
        limite: query.limite,
        pagina: query.pagina,
        total,
        totalPaginas,
      },
    }
  }

  async registerMileage(busId: string, input: RegisterMileageInput, actor: AuthenticatedUser) {
    ensureAdmin(actor)

    try {
      const result = await this.fleetRepository.registerMileage(
        busId,
        input.kilometrajeNuevo,
        actor.id,
        input.motivo ?? null,
      )

      if (result.status === 'NOT_FOUND') {
        throw new AppError(404, 'BUS_NOT_FOUND', 'Bus no encontrado')
      }

      if (result.status === 'MILEAGE_DECREASE') {
        throw new AppError(
          400,
          'MILEAGE_DECREASE',
          'La nueva lectura no puede ser inferior al kilometraje actual',
        )
      }

      return {
        bus: {
          id: result.bus.id,
          kilometrajeActual: result.bus.kilometrajeActual,
        },
        lectura: mapMileageReading(result.lectura),
      }
    } catch (error) {
      translatePrismaError(error)
    }
  }

  async summarize(actor: AuthenticatedUser): Promise<FleetSummaryDto> {
    ensureAdmin(actor)

    const [totalBuses, grouped, asignacionesActivas, sinConductor] = await Promise.all([
      this.fleetRepository.countBuses(),
      this.fleetRepository.countBusesByStatus(),
      this.fleetRepository.countActiveAssignments(),
      this.fleetRepository.countBusesWithoutDriver(),
    ])
    const porEstado = { ...estadoBusDefaults }

    for (const group of grouped) {
      porEstado[group.estadoOperativo] = group._count._all
    }

    return {
      asignacionesActivas,
      porEstado,
      sinConductor,
      totalBuses,
    }
  }

  async updateBus(busId: string, input: UpdateBusInput, actor: AuthenticatedUser) {
    ensureAdmin(actor)

    const data: Prisma.BusUpdateInput = {}

    if (input.anio !== undefined) {
      data.anio = input.anio
    }

    if (input.codigoInterno !== undefined) {
      data.codigoInterno = normalizeIdentifier(input.codigoInterno)
    }

    if (input.marca !== undefined) {
      data.marca = normalizeText(input.marca)
    }

    if (input.modelo !== undefined) {
      data.modelo = normalizeText(input.modelo)
    }

    if (input.placa !== undefined) {
      data.placa = normalizeIdentifier(input.placa)
    }

    try {
      const bus = await this.fleetRepository.updateBus(busId, data)

      return {
        bus: mapBusDetail(bus),
      }
    } catch (error) {
      translatePrismaError(error)
    }
  }

  private createBusWhere(query: ListBusesQuery): Prisma.BusWhereInput {
    const filters: Prisma.BusWhereInput[] = []

    if (query.estado) {
      filters.push({
        estadoOperativo: query.estado,
      })
    }

    if (query.busqueda) {
      const search = normalizeIdentifier(query.busqueda)

      filters.push({
        OR: [
          {
            codigoInterno: {
              contains: search,
            },
          },
          {
            placa: {
              contains: search,
            },
          },
        ],
      })
    }

    if (filters.length === 0) {
      return {}
    }

    return {
      AND: filters,
    }
  }

  private async ensureBusExists(busId: string) {
    const bus = await this.fleetRepository.findBusSummaryById(busId)

    if (!bus) {
      throw new AppError(404, 'BUS_NOT_FOUND', 'Bus no encontrado')
    }
  }
}
