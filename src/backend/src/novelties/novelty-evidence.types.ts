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
