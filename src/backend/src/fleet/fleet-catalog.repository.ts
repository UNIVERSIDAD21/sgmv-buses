import { Prisma } from '@prisma/client'

import { prisma } from '../prisma/client.js'

const modeloBusInclude = {
  _count: {
    select: {
      buses: true,
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

export class FleetCatalogRepository {
  createModeloBus(data: Prisma.ModeloBusCreateInput) {
    return prisma.modeloBus.create({ data, include: modeloBusInclude })
  }

  createRuta(data: Prisma.RutaCreateInput) {
    return prisma.ruta.create({ data, include: rutaInclude })
  }

  findModeloBusById(id: string) {
    return prisma.modeloBus.findUnique({ where: { id }, include: modeloBusInclude })
  }

  findRutaById(id: string) {
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

  setModeloBusActive(id: string, activo: boolean) {
    return prisma.modeloBus.update({
      where: { id },
      data: { activo },
      include: modeloBusInclude,
    })
  }

  setRutaActive(id: string, activa: boolean) {
    return prisma.ruta.update({
      where: { id },
      data: { activa },
      include: rutaInclude,
    })
  }

  updateModeloBus(id: string, data: Prisma.ModeloBusUpdateInput) {
    return prisma.modeloBus.update({ where: { id }, data, include: modeloBusInclude })
  }

  updateRuta(id: string, data: Prisma.RutaUpdateInput) {
    return prisma.ruta.update({ where: { id }, data, include: rutaInclude })
  }
}
