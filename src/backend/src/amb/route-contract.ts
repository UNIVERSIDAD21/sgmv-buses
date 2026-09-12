import type { Prisma, Ruta } from '@prisma/client'

export const routeSelect = {
  id: true,
  codigo: true,
  nombre: true,
  origen: true,
  destino: true,
  longitudKmOficial: true,
  operador: true,
  origenDato: true,
  semanticaLongitudOficial: true,
  semanticaLongitudDemo: true,
  origenSemanticaDemo: true,
  procedencia: true,
} satisfies Prisma.RutaSelect

type RouteRecord = Pick<Ruta, keyof typeof routeSelect>

export function mapRouteReference(route: RouteRecord) {
  return { ...route, longitudKmOficial: route.longitudKmOficial?.toNumber() ?? null }
}

export type RouteReferenceDto = ReturnType<typeof mapRouteReference>
