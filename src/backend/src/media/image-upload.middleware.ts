import { basename } from 'node:path'

import type { RequestHandler } from 'express'
import multer, { MulterError } from 'multer'

import { env } from '../config/env.js'
import { AppError } from '../shared/http.js'

export type AcceptedImageMime = 'image/jpeg' | 'image/png' | 'image/webp'

export interface ValidatedImageUpload {
  buffer: Buffer
  mimeType: AcceptedImageMime
  originalName: string
  size: number
}

const allowedMimeTypes = new Set<AcceptedImageMime>(['image/jpeg', 'image/png', 'image/webp'])

const upload = multer({
  fileFilter(_request, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype as AcceptedImageMime)) {
      callback(new AppError(400, 'UNSUPPORTED_IMAGE_TYPE', 'Solo se permiten JPG, PNG o WebP'))
      return
    }
    callback(null, true)
  },
  limits: {
    fieldNameSize: 50,
    fieldSize: 100,
    fields: 1,
    fileSize: env.MEDIA_MAX_FILE_BYTES,
    files: env.MEDIA_MAX_FILES_PER_NOVELTY,
    parts: env.MEDIA_MAX_FILES_PER_NOVELTY + 1,
  },
  storage: multer.memoryStorage(),
})

function detectMimeType(buffer: Buffer): AcceptedImageMime | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png'
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp'
  }
  return null
}

function safeOriginalName(value: string) {
  const sanitized = Array.from(basename(value))
    .filter((character) => {
      const code = character.charCodeAt(0)
      return code >= 32 && code !== 127
    })
    .join('')

  return sanitized.trim().slice(0, 255) || 'evidencia'
}

export const parseNoveltyEvidenceUpload: RequestHandler = (request, response, next) => {
  upload.array('imagenes', env.MEDIA_MAX_FILES_PER_NOVELTY)(request, response, (error) => {
    if (error instanceof MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        next(new AppError(413, 'IMAGE_TOO_LARGE', 'Cada imagen debe pesar maximo 5 MB'))
        return
      }
      next(new AppError(400, 'INVALID_IMAGE_UPLOAD', 'La carga de imagenes no es valida'))
      return
    }
    next(error)
  })
}

export function validateUploadedImages(request: Express.Request): ValidatedImageUpload[] {
  const files = Array.isArray(request.files) ? request.files : []
  if (files.length === 0) {
    throw new AppError(400, 'IMAGES_REQUIRED', 'Seleccione al menos una imagen')
  }

  return files.map((file) => {
    const detectedMime = detectMimeType(file.buffer)
    if (!detectedMime || detectedMime !== file.mimetype) {
      throw new AppError(
        400,
        'INVALID_IMAGE_CONTENT',
        'El contenido de una imagen no coincide con su formato declarado',
      )
    }

    return {
      buffer: file.buffer,
      mimeType: detectedMime,
      originalName: safeOriginalName(file.originalname),
      size: file.size,
    }
  })
}
