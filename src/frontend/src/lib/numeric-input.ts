// La entrada admite el formato es-CO de la interfaz y el decimal sin agrupar
// de la API. Se rechazan agrupaciones ambiguas o incompletas, no se adivinan.
export function normalizeDecimalInput(value: string): string | null {
  const text = value.trim().replace(/^\$\s*/, '')
  const grouped = /^[1-9]\d{0,2}(?:\.\d{3})+(?:,\d{1,2})?$/.test(text)
  const normalized = grouped ? text.replaceAll('.', '').replace(',', '.') : text.replace(',', '.')
  return /^\d{1,10}(?:\.\d{1,2})?$/.test(normalized) ? normalized : null
}

export function parseMileageInput(value: string): number | null {
  const text = value.trim()
  if (!/^(?:\d+|[1-9]\d{0,2}(?:\.\d{3})+)$/.test(text)) return null
  const mileage = Number(text.replaceAll('.', ''))
  return Number.isSafeInteger(mileage) && mileage > 0 && mileage <= 2_147_483_647 ? mileage : null
}
