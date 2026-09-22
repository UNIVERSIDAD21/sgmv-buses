import { useState, type ChangeEvent, type FormEvent } from 'react'

import Button from '../../components/ui/Button'
import { ApiError, apiResourceUrl } from '../../lib/api'
import { deleteNoveltyEvidence, uploadNoveltyEvidence } from './novelty.api'
import { MAX_EVIDENCE_FILES, validateEvidenceFiles } from './novelty-evidence.validation'
import type { NoveltyEvidenceDto } from './novelty.types'

function formatFileSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toLocaleString('es-CO', { maximumFractionDigits: 1 })} MB`
}

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : 'No se pudo completar la operación.'
}

export function NoveltyEvidencePicker({
  disabled = false,
  files,
  onChange,
  remaining = MAX_EVIDENCE_FILES,
}: {
  disabled?: boolean
  files: File[]
  onChange: (files: File[], error: string | null) => void
  remaining?: number
}) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? [])
    const error = validateEvidenceFiles(selected, remaining)
    onChange(error ? [] : selected, error)
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <label className="block text-sm font-medium text-slate-700">
        Evidencia fotográfica opcional
        <input
          accept="image/jpeg,image/png,image/webp"
          className="mt-2 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-700 file:px-3 file:py-2 file:font-semibold file:text-white"
          disabled={disabled || remaining === 0}
          multiple
          onChange={handleChange}
          type="file"
        />
      </label>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        Solo fotos JPG, PNG o WebP; los videos no están habilitados. Máximo 5 MB por imagen y{' '}
        {MAX_EVIDENCE_FILES} por novedad. El sistema elimina metadatos EXIF al almacenar.
      </p>
      <p className="mt-1 text-xs font-medium leading-5 text-amber-700">
        Tome o seleccione la evidencia solo cuando el vehículo esté detenido y sea seguro hacerlo.
      </p>
      {files.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-slate-600" aria-label="Imágenes seleccionadas">
          {files.map((file) => (
            <li
              className="flex items-center justify-between gap-3"
              key={`${file.name}-${file.lastModified}`}
            >
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="shrink-0">{formatFileSize(file.size)}</span>
              <button
                className="shrink-0 font-semibold text-red-700 underline-offset-2 hover:underline"
                disabled={disabled}
                onClick={() =>
                  onChange(
                    files.filter((candidate) => candidate !== file),
                    null,
                  )
                }
                type="button"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function NoveltyEvidenceGallery({
  canUpload = false,
  evidences,
  noveltyId,
  onChange,
}: {
  canUpload?: boolean
  evidences: NoveltyEvidenceDto[]
  noveltyId: number
  onChange?: (evidences: NoveltyEvidenceDto[]) => void
}) {
  const [deleteTarget, setDeleteTarget] = useState<NoveltyEvidenceDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [inputVersion, setInputVersion] = useState(0)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const remaining = Math.max(0, MAX_EVIDENCE_FILES - evidences.length)

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (files.length === 0 || submitting) return

    setError(null)
    setFeedback(null)
    setSubmitting(true)
    try {
      const result = await uploadNoveltyEvidence(noveltyId, files, crypto.randomUUID())
      setFiles([])
      setInputVersion((current) => current + 1)
      onChange?.(result.evidencias)
      setFeedback('Las imágenes quedaron asociadas a la novedad.')
    } catch (uploadError) {
      setError(errorMessage(uploadError))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!deleteTarget || submitting) return

    const normalizedReason = reason.trim().replace(/\s+/g, ' ')
    if (normalizedReason.length < 10) {
      setError('Explique el motivo de eliminación con al menos 10 caracteres.')
      return
    }

    setError(null)
    setFeedback(null)
    setSubmitting(true)
    try {
      await deleteNoveltyEvidence(noveltyId, deleteTarget.id, normalizedReason)
      onChange?.(evidences.filter((item) => item.id !== deleteTarget.id))
      setDeleteTarget(null)
      setReason('')
      setFeedback('La imagen fue eliminada con su justificación registrada.')
    } catch (deleteError) {
      setError(errorMessage(deleteError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="surface p-4" aria-labelledby={`evidence-title-${noveltyId}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3
            className="text-xs font-semibold uppercase text-slate-500"
            id={`evidence-title-${noveltyId}`}
          >
            Evidencia fotográfica
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            {evidences.length} de {MAX_EVIDENCE_FILES} imágenes asociadas.
          </p>
        </div>
      </div>

      {evidences.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
          Esta novedad no tiene imágenes.
        </p>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {evidences.map((evidence) => (
            <article
              className="overflow-hidden rounded-lg border border-slate-200 bg-white"
              key={evidence.id}
            >
              <a href={apiResourceUrl(evidence.contenidoUrl)} target="_blank" rel="noreferrer">
                <img
                  alt={`Evidencia ${evidence.nombreOriginal}`}
                  className="aspect-video w-full bg-slate-100 object-cover"
                  loading="lazy"
                  src={apiResourceUrl(evidence.contenidoUrl)}
                />
              </a>
              <div className="space-y-1 p-3 text-xs text-slate-500">
                <p className="truncate font-semibold text-slate-700">{evidence.nombreOriginal}</p>
                <p>
                  {formatFileSize(evidence.bytes)} · {evidence.ancho} × {evidence.alto} px
                </p>
                <p>Cargada por {evidence.cargadaPor.nombre}</p>
                {evidence.puedeEliminar && (
                  <Button
                    className="mt-2 w-full"
                    disabled={submitting}
                    onClick={() => {
                      setDeleteTarget(evidence)
                      setReason('')
                      setError(null)
                    }}
                    size="sm"
                    variant="danger"
                  >
                    Eliminar con justificación
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {canUpload && remaining > 0 && (
        <form className="mt-4 space-y-3" onSubmit={handleUpload}>
          <NoveltyEvidencePicker
            disabled={submitting}
            files={files}
            key={inputVersion}
            onChange={(selected, pickerError) => {
              setFiles(selected)
              setError(pickerError)
            }}
            remaining={remaining}
          />
          <Button disabled={files.length === 0} loading={submitting} type="submit">
            Cargar imágenes
          </Button>
        </form>
      )}

      {deleteTarget && (
        <form
          className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3"
          onSubmit={handleDelete}
        >
          <label className="block text-sm font-medium text-red-900">
            Motivo para eliminar {deleteTarget.nombreOriginal}
            <textarea
              className="mt-2 min-h-24 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-200"
              onChange={(event) => setReason(event.target.value)}
              required
              value={reason}
            />
          </label>
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button
              disabled={submitting}
              onClick={() => setDeleteTarget(null)}
              size="sm"
              variant="outline"
            >
              Cancelar
            </Button>
            <Button loading={submitting} size="sm" type="submit" variant="danger">
              Confirmar eliminación
            </Button>
          </div>
        </form>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {feedback && (
        <p className="mt-3 text-sm text-emerald-700" role="status">
          {feedback}
        </p>
      )}
    </section>
  )
}
