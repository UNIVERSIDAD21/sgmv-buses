export interface CompatibilityRuleDto {
  bus: { codigoInterno: string; id: number } | null
  busId: number | null
  condicionUso: string | null
  definidaPor: { id: number; nombre: string }
  especificacionesValidadas: Record<string, unknown>
  fechaDefinicion: string
  id: number
  modeloBus: { id: number; marca: string; nombreModelo: string } | null
  modeloBusId: number | null
  permitido: boolean
  version: number
  vigente: boolean
}
