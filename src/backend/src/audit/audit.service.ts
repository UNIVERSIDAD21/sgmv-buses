import { createHmac } from 'node:crypto'

import { env } from '../config/env.js'
import { AuditRepository } from './audit.repository.js'

interface RecordHttpMutationInput {
  actorId?: string
  ip?: string
  method: string
  path: string
  requestId: string
  statusCode: number
}

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i

function hashIp(ip?: string) {
  const secret = env.RATE_LIMIT_SECRET ?? env.CSRF_SECRET ?? env.JWT_SECRET

  if (!ip || !secret) {
    return undefined
  }

  return createHmac('sha256', secret).update(`audit-ip:${ip}`).digest('hex')
}

export class AuditService {
  constructor(private readonly repository = new AuditRepository()) {}

  recordHttpMutation(input: RecordHttpMutationInput) {
    const safePath = input.path.slice(0, 255)
    const segments = safePath.split('/').filter(Boolean)
    const recursoTipo = segments[0]?.slice(0, 100)
    const recursoId = safePath.match(UUID_PATTERN)?.[0]

    return this.repository.create({
      accion: `${input.method} ${recursoTipo ?? 'recurso'}`.slice(0, 180),
      actorId: input.actorId,
      detalles: {
        schemaVersion: 1,
      },
      ipHash: hashIp(input.ip),
      metodo: input.method,
      recursoId,
      recursoTipo,
      requestId: input.requestId,
      resultado: input.statusCode < 400 ? 'EXITO' : 'RECHAZADO',
      ruta: safePath,
      statusHttp: input.statusCode,
    })
  }
}
