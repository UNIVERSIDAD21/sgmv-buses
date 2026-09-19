import { randomUUID } from 'node:crypto'

import { Prisma } from '@prisma/client'

import { prisma } from '../prisma/client.js'

const modeloBusInclude = {
  _count: {
    select: {
      buses: true,
      compatibilidadesRepuesto: true,
      planesPreventivos: true,
    },
  },
} as const

const rutaInclude = {
  _count: {
    select: {
      jornadasOperativas: true,
    },
  },
} as const

export type ModeloBusRecord = Prisma.ModeloBusGetPayload<{ include: typeof modeloBusInclude }>
export type RutaRecord = Prisma.RutaGetPayload<{ include: typeof rutaInclude }>

function generatedRouteCode(routeId: number) {
  return `RUTA-${String(routeId).padStart(6, '0')}`
}

export class FleetCatalogRepository {
  createModeloBus(data: Prisma.ModeloBusCreateInput) {
    return prisma.modeloBus.create({ data, include: modeloBusInclude })
  }

  createRuta(data: Omit<Prisma.RutaCreateInput, 'codigo'>) {
    return prisma.$transaction(async (tx) => {
      const ruta = await tx.ruta.create({
        data: {
          ...data,
          codigo: `PENDIENTE-${randomUUID().toUpperCase()}`,
        },
      })
      const preferredCode = generatedRouteCode(ruta.id)
      const existingRoute = await tx.ruta.findUnique({
        select: { id: true },
        where: { codigo: preferredCode },
      })
      const codigo = existingRoute
        ? `${preferredCode}-${randomUUID().slice(0, 6).toUpperCase()}`
        : preferredCode

      return tx.ruta.update({
        data: { codigo },
        include: rutaInclude,
        where: { id: ruta.id },
      })
    })
  }

  findModeloBusById(id: number) {
    return prisma.modeloBus.findUnique({ where: { id }, include: modeloBusInclude })
  }

  findRutaById(id: number) {
    return prisma.ruta.findUnique({ where: { id }, include: rutaInclude })
  }

  listModelosBus(where: Prisma.ModeloBusWhereInput) {
    return prisma.modeloBus.findMany({
      where,
      include: modeloBusInclude,
      orderBy: [{ marca: 'asc' }, { nombreModelo: 'asc' }, { versionTecnica: 'asc' }],
    })
  }

  listRutas(where: Prisma.RutaWhereInput) {
    return prisma.ruta.findMany({
      where,
      include: rutaInclude,
      orderBy: [{ codigo: 'asc' }, { nombre: 'asc' }],
    })
  }

  setModeloBusActive(id: number, activo: boolean) {
    return prisma.modeloBus.update({
      where: { id },
      data: { activo },
      include: modeloBusInclude,
    })
  }

  setRutaActive(id: number, activa: boolean) {
    return prisma.ruta.update({
      where: { id },
      data: { activa },
      include: rutaInclude,
    })
  }

  updateModeloBus(id: number, data: Prisma.ModeloBusUpdateInput) {
    return prisma.modeloBus.update({ where: { id }, data, include: modeloBusInclude })
  }

  updateRuta(id: number, data: Prisma.RutaUpdateInput) {
    return prisma.ruta.update({ where: { id }, data, include: rutaInclude })
  }
}
