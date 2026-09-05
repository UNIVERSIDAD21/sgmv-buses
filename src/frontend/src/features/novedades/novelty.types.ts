export type NoveltyStatus =
  'CONVERTIDA_A_ORDEN' | 'DESCARTADA' | 'PENDIENTE_REVISION' | 'RESUELTA_SIN_ORDEN'

export type OrderPriority = 'ALTA' | 'BAJA' | 'MEDIA'
export type NoveltyCriticality = 'ALTA' | 'BAJA' | 'CRITICA' | 'MEDIA'

export interface NoveltyUserDto {
  email?: string
  id: string
  nombre: string
}

export interface NoveltyBusDto {
  codigoInterno: string
  estadoOperativo: string
  id: string
  placa: string
}

export interface WorkOrderSummaryDto {
  codigo: string
  descripcion?: string
  estado: string
  fechaCreacion: string
  id: string
  origen: 'NOVEDAD'
  prioridad: OrderPriority
  tipo: 'CORRECTIVA'
}

export interface NoveltyDto {
  acciones: {
    puedeConvertir: boolean
    puedeCoordinarJornada: boolean
    puedeRevisar: boolean
  }
  afectaOperacion: boolean | null
  bloqueaDisponibilidad: boolean | null
  bus: NoveltyBusDto
  clasificacion: string | null
  conductor: NoveltyUserDto
  criticidad: NoveltyCriticality | null
  descripcion: string
  estado: NoveltyStatus
  fechaOcurrencia: string | null
  fechaReporte: string
  fechaRevision: string | null
  id: string
  jornada: {
    estado: 'PROGRAMADA' | 'EN_CURSO' | 'FINALIZADA' | 'CANCELADA' | 'REASIGNADA'
    finReal: string | null
    id: string
    inicioReal: string | null
    ruta: {
      codigo: string
      destino: string
      id: string
      nombre: string
      origen: string
    } | null
  } | null
  lecturaKilometraje: {
    fechaLectura: string
    id: string
    kilometraje: number
    kilometrajeAnterior: number
    tipo: 'NOVEDAD'
  } | null
  observacionRevision: string | null
  ordenTrabajo: WorkOrderSummaryDto | null
  revisadaPor: NoveltyUserDto | null
  tipo: string
  updatedAt: string
}

export interface NoveltyListResponse {
  novedades: NoveltyDto[]
  paginacion: {
    limite: number
    pagina: number
    total: number
    totalPaginas: number
  }
}

export interface NoveltySummaryDto {
  afectanOperacion: number
  bloqueantes: number
  criticas: number
  estados: Record<NoveltyStatus, number>
  ordenesGeneradas: number
  pendientes: number
  total: number
}
