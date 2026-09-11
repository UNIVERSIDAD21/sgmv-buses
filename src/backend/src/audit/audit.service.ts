import { createHmac } from 'node:crypto'

import { env } from '../config/env.js'
import { AuditRepository } from './audit.repository.js'

interface RecordHttpMutationInput {
  actorId?: number
  ip?: string
  method: string
  path: string
  requestId: string
  statusCode: number
}

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
    const recursoId = segments.find(
      (segment) => /^[1-9]\d*$/.test(segment) && Number(segment) <= 2_147_483_647,
    )

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
