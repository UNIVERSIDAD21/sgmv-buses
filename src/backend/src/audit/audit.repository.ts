import { Prisma } from '@prisma/client'

import { prisma } from '../prisma/client.js'

export interface CreateAuditEventInput {
  accion: string
  actorId?: string
  detalles: Prisma.InputJsonValue
  ipHash?: string
  metodo: string
  recursoId?: string
  recursoTipo?: string
  requestId: string
  resultado: string
  ruta: string
  statusHttp: number
}

export class AuditRepository {
  create(input: CreateAuditEventInput) {
    return prisma.eventoAuditoria.create({ data: input })
  }
}
