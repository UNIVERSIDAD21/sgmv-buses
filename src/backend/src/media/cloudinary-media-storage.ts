import { randomUUID } from 'node:crypto'

import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary'

import { env } from '../config/env.js'
import { AppError } from '../shared/http.js'
import type { MediaStorage, MediaUploadInput, StoredMedia } from './media-storage.js'

let configured = false

function configureCloudinary() {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new AppError(
      503,
      'MEDIA_STORAGE_UNAVAILABLE',
      'La carga de fotos no esta habilitada en este servidor. Reinicie el backend con la configuracion de evidencias.',
    )
  }

  if (!configured) {
    cloudinary.config({
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      secure: true,
    })
    configured = true
  }
}

function uploadBuffer(input: MediaUploadInput): Promise<UploadApiResponse> {
  configureCloudinary()

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        folder: `${env.CLOUDINARY_FOLDER}/${input.noveltyId}`,
        overwrite: false,
        public_id: `${input.evidenceId}-${randomUUID()}`,
        resource_type: 'image',
        transformation: [{ flags: 'strip_profile' }],
        type: 'authenticated',
        unique_filename: false,
        use_filename: false,
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error('Cloudinary no devolvio el recurso cargado'))
          return
        }

        resolve(result)
      },
    )

    stream.end(input.buffer)
  })
}

export class CloudinaryMediaStorage implements MediaStorage {
  async delete(publicId: string) {
    configureCloudinary()
    const result = await cloudinary.uploader.destroy(publicId, {
      invalidate: true,
      resource_type: 'image',
      type: 'authenticated',
    })

    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new Error(`Cloudinary no elimino el recurso: ${result.result}`)
    }
  }

  async download(publicId: string, version: string) {
    configureCloudinary()
    const url = cloudinary.url(publicId, {
      resource_type: 'image',
      secure: true,
      sign_url: true,
      type: 'authenticated',
      version: Number(version),
    })
    const response = await fetch(url, {
      headers: { Accept: 'image/jpeg,image/png,image/webp' },
      signal: AbortSignal.timeout(env.MEDIA_FETCH_TIMEOUT_MS),
    })

    if (!response.ok) {
      throw new Error(`Cloudinary respondio ${response.status}`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length === 0 || buffer.length > env.MEDIA_MAX_FILE_BYTES) {
      throw new Error('Cloudinary devolvio un archivo fuera del limite permitido')
    }

    return buffer
  }

  async upload(input: MediaUploadInput): Promise<StoredMedia> {
    const result = await uploadBuffer(input)
    if (
      !result.asset_id ||
      !result.public_id ||
      !result.version ||
      !result.width ||
      !result.height
    ) {
      throw new Error('Cloudinary devolvio metadatos incompletos')
    }

    return {
      assetId: result.asset_id,
      height: result.height,
      publicId: result.public_id,
      version: String(result.version),
      width: result.width,
    }
  }
}

const defaultStorage = new CloudinaryMediaStorage()
let testStorage: MediaStorage | null = null

export function getMediaStorage() {
  return testStorage ?? defaultStorage
}

export function setMediaStorageForTests(storage: MediaStorage | null) {
  if (env.NODE_ENV !== 'test') {
    throw new Error('El almacenamiento sustituible solo esta disponible en pruebas')
  }
  testStorage = storage
}
