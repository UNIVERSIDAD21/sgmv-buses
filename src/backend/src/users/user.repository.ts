import type { Prisma } from '@prisma/client'

import { prisma } from '../prisma/client.js'
import type { ListUsersQuery } from './user.schemas.js'

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
  findById(id: number) {
    return prisma.usuario.findUnique({ select: safeUserSelect, where: { id } })
  }

  async list(query: ListUsersQuery) {
    const where: Prisma.UsuarioWhereInput = {
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
