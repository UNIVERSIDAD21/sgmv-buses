import type { Prisma } from '@prisma/client'

import { env } from '../config/env.js'
import { prisma } from '../prisma/client.js'
import type { ListUsersQuery } from './user.schemas.js'

export const RESERVED_TEST_ACCOUNT_DOMAIN = '@test.sgmv.local'

function productionUserVisibilityWhere(): Prisma.UsuarioWhereInput {
  return env.NODE_ENV === 'production'
    ? {
        NOT: {
          email: { endsWith: RESERVED_TEST_ACCOUNT_DOMAIN, mode: 'insensitive' },
        },
      }
    : {}
}

export const safeUserSelect = {
  bloqueadoHasta: true,
  createdAt: true,
  email: true,
  estado: true,
  id: true,
  nombre: true,
  rol: {
    select: {
      codigo: true,
      id: true,
      nombre: true,
    },
  },
  telefono: true,
  ultimoAccesoAt: true,
  updatedAt: true,
} satisfies Prisma.UsuarioSelect

export class UserRepository {
  async impact(usuarioId: number) {
    const journeysWhere = {
      conductorId: usuarioId,
      estado: { in: ['EN_CURSO' as const, 'PROGRAMADA' as const] },
    }
    const ordersWhere: Prisma.OrdenTrabajoWhereInput = {
      tecnicoAsignadoId: usuarioId,
      estado: { in: ['ASIGNADA', 'EN_EJECUCION', 'DEVUELTA_CORRECCION'] },
    }
    const [jornadas, ordenes] = await Promise.all([
      prisma.jornadaOperativa.findMany({
        where: journeysWhere,
        select: {
          id: true,
          estado: true,
          inicioProgramado: true,
          bus: { select: { codigoInterno: true } },
        },
        orderBy: { inicioProgramado: 'asc' },
      }),
      prisma.ordenTrabajo.findMany({
        where: ordersWhere,
        select: { id: true, codigo: true, estado: true, bus: { select: { codigoInterno: true } } },
        orderBy: { fechaCreacion: 'asc' },
      }),
    ])
    return { jornadas, ordenes }
  }

  findById(id: number) {
    return prisma.usuario.findFirst({
      select: safeUserSelect,
      where: { id, ...productionUserVisibilityWhere() },
    })
  }

  async list(query: ListUsersQuery) {
    const where: Prisma.UsuarioWhereInput = {
      ...productionUserVisibilityWhere(),
      ...(query.busqueda
        ? {
            OR: [
              { email: { contains: query.busqueda, mode: 'insensitive' } },
              { nombre: { contains: query.busqueda, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.estado ? { estado: query.estado } : {}),
      ...(query.rol ? { rol: { codigo: query.rol } } : {}),
    }

    const [items, total] = await prisma.$transaction([
      prisma.usuario.findMany({
        orderBy: [{ nombre: 'asc' }, { id: 'asc' }],
        select: safeUserSelect,
        skip: (query.pagina - 1) * query.limite,
        take: query.limite,
        where,
      }),
      prisma.usuario.count({ where }),
    ])

    return {
      items,
      limite: query.limite,
      pagina: query.pagina,
      paginas: Math.max(1, Math.ceil(total / query.limite)),
      total,
    }
  }
}
