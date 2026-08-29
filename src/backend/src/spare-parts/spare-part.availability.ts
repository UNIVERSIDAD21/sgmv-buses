import { Prisma, type EstadoRepuesto } from '@prisma/client'

import type { SparePartAvailability } from './spare-part.types.js'

export function classifySparePartAvailability(input: {
  estado: EstadoRepuesto
  stockActual: Prisma.Decimal.Value
  stockMinimo: Prisma.Decimal.Value
}): SparePartAvailability {
  if (input.estado === 'INACTIVO') {
    return 'INACTIVO'
  }

  const stockActual = new Prisma.Decimal(input.stockActual)
  const stockMinimo = new Prisma.Decimal(input.stockMinimo)

  if (stockActual.equals(0)) {
    return 'AGOTADO'
  }

  if (stockActual.lessThanOrEqualTo(stockMinimo)) {
    return 'BAJO'
  }

  return 'DISPONIBLE'
}
