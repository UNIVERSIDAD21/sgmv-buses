import type { Prisma } from '@prisma/client'

export const blockingNoveltyWhere = {
  bloqueaDisponibilidad: true,
  estado: 'PENDIENTE_REVISION',
} satisfies Prisma.NovedadWhereInput

export const blockingOrderWhere = {
  OR: [
    { estado: { in: ['EN_EJECUCION', 'COMPLETADA_TECNICO', 'DEVUELTA_CORRECCION'] } },
    { estado: { notIn: ['CERRADA', 'ANULADA'] }, novedad: { bloqueaDisponibilidad: true } },
  ],
} satisfies Prisma.OrdenTrabajoWhereInput
