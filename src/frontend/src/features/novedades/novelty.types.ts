export type NoveltyStatus =
  'CONVERTIDA_A_ORDEN' | 'DESCARTADA' | 'PENDIENTE_REVISION' | 'RESUELTA_SIN_ORDEN'

export type OrderPriority = 'ALTA' | 'BAJA' | 'MEDIA'
export type NoveltyCriticality = 'ALTA' | 'BAJA' | 'CRITICA' | 'MEDIA'

export interface NoveltyUserDto {
  email?: string
  id: number
  nombre: string
}

export interface NoveltyBusDto {
  codigoInterno: string
  estadoOperativo: string
  id: number
  placa: string
}

export interface NoveltyEvidenceDto {
  alto: number
  ancho: number
  bytes: number
  cargadaPor: {
    id: number
    nombre: string
  }
  contenidoUrl: string
  createdAt: string
  id: number
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  nombreOriginal: string
  puedeEliminar: boolean
}

export interface WorkOrderSummaryDto {
  codigo: string
  descripcion?: string
  estado: string
  fechaCreacion: string
  id: number
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
  evidencias?: NoveltyEvidenceDto[]
  estado: NoveltyStatus
  fechaOcurrencia: string | null
  fechaReporte: string
  fechaRevision: string | null
  id: number
  jornada: {
    estado: 'PROGRAMADA' | 'EN_CURSO' | 'FINALIZADA' | 'CANCELADA' | 'REASIGNADA'
    finReal: string | null
    id: number
    inicioReal: string | null
    ruta: {
      codigo: string
      destino: string
      id: number
      nombre: string
      origen: string
    } | null
  } | null
  lecturaKilometraje: {
    fechaLectura: string
    id: number
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
