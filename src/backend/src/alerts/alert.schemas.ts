import { z } from 'zod'
import type { TipoAlerta } from '@prisma/client'

import {
  estadoAlertaDestinatarioValues,
  prioridadAlertaValues,
  tipoAlertaValues,
} from './alert.catalog.js'

const optionalDate = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim() === '') return undefined
  return value
}, z.iso.date().optional())

export const alertRecipientIdParamSchema = z.object({ destinatarioId: z.uuid() })

export const listAlertsQuerySchema = z
  .object({
    estado: z.enum(estadoAlertaDestinatarioValues).optional(),
    fechaDesde: optionalDate,
    fechaHasta: optionalDate,
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    prioridad: z.enum(prioridadAlertaValues).optional(),
    tipo: z.enum(tipoAlertaValues as unknown as [TipoAlerta, ...TipoAlerta[]]).optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.fechaDesde && input.fechaHasta && input.fechaDesde > input.fechaHasta) {
      context.addIssue({
        code: 'custom',
        message: 'La fecha inicial no puede ser posterior a la fecha final',
        path: ['fechaHasta'],
      })
    }
  })

export type ListAlertsQuery = z.infer<typeof listAlertsQuerySchema>
