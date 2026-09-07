export interface CompatibilityRuleDto {
  bus: { codigoInterno: string; id: string } | null
  busId: string | null
  condicionUso: string | null
  definidaPor: { id: string; nombre: string }
  especificacionesValidadas: Record<string, unknown>
  fechaDefinicion: string
  id: string
  modeloBus: { id: string; marca: string; nombreModelo: string } | null
  modeloBusId: string | null
  permitido: boolean
  version: number
  vigente: boolean
}
