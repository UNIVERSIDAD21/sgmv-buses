import type {
  CriticidadNovedad,
  EstadoJornada,
  EstadoNovedad,
  EstadoOrdenTrabajo,
  PrioridadOrden,
} from '@prisma/client'
import type { NoveltyEvidenceDto } from './novelty-evidence.types.js'

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

export interface WorkOrderSummaryDto {
  codigo: string
  descripcion?: string
  estado: EstadoOrdenTrabajo
  fechaCreacion: string
  id: number
  origen: 'NOVEDAD'
  prioridad: PrioridadOrden
  tipo: 'CORRECTIVA'
}

export interface NoveltyJourneyDto {
  estado: EstadoJornada
  finProgramado: string
  finReal: string | null
  id: number
  inicioProgramado: string
  inicioReal: string | null
  ruta: {
    codigo: string
    destino: string
    id: number
    nombre: string
    origen: string
  } | null
}

export interface NoveltyReadingDto {
  fechaLectura: string
  id: number
  kilometraje: number
  kilometrajeAnterior: number
  tipo: 'NOVEDAD'
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
  criticidad: CriticidadNovedad | null
  descripcion: string
  estado: EstadoNovedad
  evidencias?: NoveltyEvidenceDto[]
  fechaOcurrencia: string | null
  fechaReporte: string
  fechaRevision: string | null
  id: number
  jornada: NoveltyJourneyDto | null
  lecturaKilometraje: NoveltyReadingDto | null
  motivoAusenciaLectura: string | null
  observacionRevision: string | null
  ordenTrabajo: WorkOrderSummaryDto | null
  revisadaPor: NoveltyUserDto | null
  tipo: string
  reportadaAntesSalida: boolean
  updatedAt: string
}

export interface NoveltyListDto {
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
  estados: Record<EstadoNovedad, number>
  ordenesGeneradas: number
  pendientes: number
  total: number
}
