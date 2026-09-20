export const MAX_EVIDENCE_FILES = 5
export const MAX_EVIDENCE_FILE_BYTES = 5 * 1024 * 1024

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function validateEvidenceFiles(files: File[], available = MAX_EVIDENCE_FILES) {
  if (files.length > available) {
    return `Puede seleccionar hasta ${available} imagen${available === 1 ? '' : 'es'} más.`
  }

  const invalidType = files.find((file) => !ALLOWED_TYPES.has(file.type))
  if (invalidType) {
    return `${invalidType.name} no es JPG, PNG ni WebP.`
  }

  const oversized = files.find((file) => file.size > MAX_EVIDENCE_FILE_BYTES)
  if (oversized) {
    return `${oversized.name} supera el máximo de 5 MB.`
  }

  return null
}
