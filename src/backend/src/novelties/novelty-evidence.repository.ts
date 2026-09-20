import { Prisma } from '@prisma/client'

import { prisma } from '../prisma/client.js'
import { env } from '../config/env.js'
import type { ValidatedImageUpload } from '../media/image-upload.middleware.js'
import type { StoredMedia } from '../media/media-storage.js'

const evidenceInclude = {
  cargadaPor: { select: { id: true, nombre: true } },
} as const

export type NoveltyEvidenceRecord = Prisma.EvidenciaNovedadGetPayload<{
  include: typeof evidenceInclude
}>

export class NoveltyEvidenceRepository {
  findAccessContext(noveltyId: number) {
    return prisma.novedad.findUnique({
      where: { id: noveltyId },
      select: {
        conductorId: true,
        id: true,
        ordenTrabajo: { select: { tecnicoAsignadoId: true } },
      },
    })
  }

  findActiveByNovelty(noveltyId: number) {
    return prisma.evidenciaNovedad.findMany({
      where: { novedadId: noveltyId, estado: 'ACTIVA' },
      include: evidenceInclude,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
  }

  findActiveById(noveltyId: number, evidenceId: number) {
    return prisma.evidenciaNovedad.findFirst({
      where: { id: evidenceId, novedadId: noveltyId, estado: 'ACTIVA' },
      include: evidenceInclude,
    })
  }

  reserveUpload(
    noveltyId: number,
    actorId: number,
    cargaId: string,
    files: ValidatedImageUpload[],
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(8058, CAST(${noveltyId} AS integer))`,
      )

      const novelty = await tx.novedad.findUnique({
        where: { id: noveltyId },
        select: { conductorId: true, id: true },
      })
      if (!novelty || novelty.conductorId !== actorId) {
        return { kind: 'NOT_FOUND' as const }
      }

      const previous = await tx.evidenciaNovedad.findMany({
        where: { cargaId },
        include: evidenceInclude,
        orderBy: { ordinal: 'asc' },
      })
      if (previous.length > 0) {
        return {
          evidences: previous,
          kind: previous.every((item) => item.estado === 'ACTIVA')
            ? ('REPLAY' as const)
            : ('IN_PROGRESS' as const),
        }
      }

      const used = await tx.evidenciaNovedad.count({
        where: { novedadId: noveltyId, estado: { in: ['PENDIENTE', 'ACTIVA'] } },
      })
      if (used + files.length > env.MEDIA_MAX_FILES_PER_NOVELTY) {
        return { kind: 'LIMIT_EXCEEDED' as const }
      }

      await tx.evidenciaNovedad.createMany({
        data: files.map((file, ordinal) => ({
          bytes: file.size,
          cargaId,
          cargadaPorId: actorId,
          mimeType: file.mimeType,
          nombreOriginal: file.originalName,
          novedadId: noveltyId,
          ordinal,
        })),
      })

      const evidences = await tx.evidenciaNovedad.findMany({
        where: { cargaId },
        include: evidenceInclude,
        orderBy: { ordinal: 'asc' },
      })
      return { evidences, kind: 'RESERVED' as const }
    })
  }

  activateEvidence(evidenceId: number, stored: StoredMedia) {
    return prisma.evidenciaNovedad.update({
      where: { id: evidenceId },
      data: {
        activadaAt: new Date(),
        alto: stored.height,
        ancho: stored.width,
        estado: 'ACTIVA',
        storageAssetId: stored.assetId,
        storagePublicId: stored.publicId,
        storageVersion: stored.version,
      },
      include: evidenceInclude,
    })
  }

  markFailed(evidenceIds: number[]) {
    return prisma.evidenciaNovedad.updateMany({
      where: { id: { in: evidenceIds }, estado: { in: ['PENDIENTE', 'ACTIVA'] } },
      data: { estado: 'FALLIDA' },
    })
  }

  async markDeleted(noveltyId: number, evidenceId: number, actorId: number, reason: string) {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(8058, CAST(${noveltyId} AS integer))`,
      )
      const evidence = await tx.evidenciaNovedad.findFirst({
        where: { id: evidenceId, novedadId: noveltyId, estado: 'ACTIVA' },
        include: evidenceInclude,
      })
      if (!evidence) return null

      return tx.evidenciaNovedad.update({
        where: { id: evidence.id },
        data: {
          eliminadaAt: new Date(),
          eliminadaPorId: actorId,
          estado: 'ELIMINADA',
          motivoEliminacion: reason,
        },
        include: evidenceInclude,
      })
    })
  }

  restoreActive(evidenceId: number) {
    return prisma.evidenciaNovedad.updateMany({
      where: { id: evidenceId, estado: 'ELIMINADA' },
      data: {
        eliminadaAt: null,
        eliminadaPorId: null,
        estado: 'ACTIVA',
        motivoEliminacion: null,
      },
    })
  }
}
