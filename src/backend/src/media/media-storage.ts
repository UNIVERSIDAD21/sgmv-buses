export interface MediaUploadInput {
  buffer: Buffer
  evidenceId: number
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  noveltyId: number
}

export interface StoredMedia {
  assetId: string
  height: number
  publicId: string
  version: string
  width: number
}

export interface MediaStorage {
  delete(publicId: string): Promise<void>
  download(publicId: string, version: string): Promise<Buffer>
  upload(input: MediaUploadInput): Promise<StoredMedia>
}
