import type { AuthenticatedUser } from '../auth/auth.types.js'
import { env } from '../config/env.js'
import { getMediaStorage } from '../media/cloudinary-media-storage.js'
import type { ValidatedImageUpload } from '../media/image-upload.middleware.js'
import { logger } from '../observability/logger.js'
import { AppError } from '../shared/http.js'
import {
  NoveltyEvidenceRepository,
  type NoveltyEvidenceRecord,
} from './novelty-evidence.repository.js'
import type { NoveltyEvidenceDto } from './novelty-evidence.types.js'

export function mapNoveltyEvidence(
  evidence: NoveltyEvidenceRecord,
  actor: AuthenticatedUser,
): NoveltyEvidenceDto {
  return {
    alto: evidence.alto!,
    ancho: evidence.ancho!,
    bytes: evidence.bytes,
    cargadaPor: evidence.cargadaPor,
    contenidoUrl: `/novedades/${evidence.novedadId}/evidencias/${evidence.id}/contenido`,
    createdAt: evidence.createdAt.toISOString(),
    id: evidence.id,
    mimeType: evidence.mimeType as NoveltyEvidenceDto['mimeType'],
    nombreOriginal: evidence.nombreOriginal,
    puedeEliminar: actor.rol.codigo === 'ADMINISTRADOR',
  }
}

export class NoveltyEvidenceService {
  constructor(private readonly repository = new NoveltyEvidenceRepository()) {}

  private async ensureAccess(noveltyId: number, actor: AuthenticatedUser) {
    const context = await this.repository.findAccessContext(noveltyId)
    if (!context) {
      throw new AppError(404, 'NOVELTY_NOT_FOUND', 'Novedad no encontrada')
    }

    const allowed =
      actor.rol.codigo === 'ADMINISTRADOR' ||
      (actor.rol.codigo === 'CONDUCTOR' && context.conductorId === actor.id) ||
      (actor.rol.codigo === 'MECANICO' && context.ordenTrabajo?.tecnicoAsignadoId === actor.id)

    if (!allowed) {
      throw new AppError(404, 'NOVELTY_NOT_FOUND', 'Novedad no encontrada')
    }
    return context
  }

  async upload(
    noveltyId: number,
    cargaId: string,
    files: ValidatedImageUpload[],
    actor: AuthenticatedUser,
  ) {
    if (actor.rol.codigo !== 'CONDUCTOR') {
      throw new AppError(403, 'FORBIDDEN', 'Solo el conductor puede cargar evidencias')
    }
    await this.ensureAccess(noveltyId, actor)

    const reservation = await this.repository.reserveUpload(noveltyId, actor.id, cargaId, files)
    if (reservation.kind === 'NOT_FOUND') {
      throw new AppError(404, 'NOVELTY_NOT_FOUND', 'Novedad no encontrada')
    }
    if (reservation.kind === 'LIMIT_EXCEEDED') {
      throw new AppError(
        409,
        'EVIDENCE_LIMIT_EXCEEDED',
        `La novedad admite maximo ${env.MEDIA_MAX_FILES_PER_NOVELTY} imagenes`,
      )
    }
    if (reservation.kind === 'IN_PROGRESS') {
      throw new AppError(409, 'EVIDENCE_UPLOAD_IN_PROGRESS', 'Esta carga sigue en proceso')
    }
    if (reservation.kind === 'REPLAY') {
      return {
        evidencias: reservation.evidences.map((item) => mapNoveltyEvidence(item, actor)),
        yaExistia: true,
      }
    }

    const storage = getMediaStorage()
    const uploaded: Array<{ evidenceId: number; publicId: string }> = []
    try {
      for (const [index, evidence] of reservation.evidences.entries()) {
        const file = files[index]!
        const stored = await storage.upload({
          buffer: file.buffer,
          evidenceId: evidence.id,
          mimeType: file.mimeType,
          noveltyId,
        })
        uploaded.push({ evidenceId: evidence.id, publicId: stored.publicId })
        await this.repository.activateEvidence(evidence.id, stored)
      }
    } catch (error) {
      await Promise.allSettled(uploaded.map((item) => storage.delete(item.publicId)))
      await this.repository.markFailed(reservation.evidences.map((item) => item.id))
      logger.error({ err: error, noveltyId }, 'No se pudo almacenar evidencia de novedad')
      if (error instanceof AppError) throw error
      throw new AppError(502, 'MEDIA_UPLOAD_FAILED', 'No se pudieron guardar las imagenes')
    }

    const evidences = await this.repository.findActiveByNovelty(noveltyId)
    return {
      evidencias: evidences.map((item) => mapNoveltyEvidence(item, actor)),
      yaExistia: false,
    }
  }

  async download(noveltyId: number, evidenceId: number, actor: AuthenticatedUser) {
    await this.ensureAccess(noveltyId, actor)
    const evidence = await this.repository.findActiveById(noveltyId, evidenceId)
    if (!evidence?.storagePublicId || !evidence.storageVersion) {
      throw new AppError(404, 'EVIDENCE_NOT_FOUND', 'Evidencia no encontrada')
    }

    try {
      const buffer = await getMediaStorage().download(
        evidence.storagePublicId,
        evidence.storageVersion,
      )
      return { buffer, evidence }
    } catch (error) {
      logger.error({ err: error, evidenceId, noveltyId }, 'No se pudo recuperar evidencia')
      throw new AppError(502, 'MEDIA_DOWNLOAD_FAILED', 'No se pudo consultar la imagen')
    }
  }

  async delete(noveltyId: number, evidenceId: number, reason: string, actor: AuthenticatedUser) {
    if (actor.rol.codigo !== 'ADMINISTRADOR') {
      throw new AppError(403, 'FORBIDDEN', 'Solo el Administrador puede eliminar evidencias')
    }
    await this.ensureAccess(noveltyId, actor)

    const evidence = await this.repository.markDeleted(noveltyId, evidenceId, actor.id, reason)
    if (!evidence?.storagePublicId) {
      throw new AppError(404, 'EVIDENCE_NOT_FOUND', 'Evidencia no encontrada')
    }

    try {
      await getMediaStorage().delete(evidence.storagePublicId)
    } catch (error) {
      await this.repository.restoreActive(evidence.id)
      logger.error({ err: error, evidenceId, noveltyId }, 'No se pudo eliminar evidencia')
      throw new AppError(502, 'MEDIA_DELETE_FAILED', 'No se pudo eliminar la imagen')
    }

    return { evidenciaId: evidence.id, eliminada: true }
  }
}
