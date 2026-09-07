import { Prisma } from '@prisma/client'

import type { AuthenticatedUser } from '../auth/auth.types.js'
import { AppError } from '../shared/http.js'
import type { CreateCompatibilityInput } from './compatibility.schemas.js'
import { CompatibilityRepository, type CompatibilityRecord } from './compatibility.repository.js'
import type { CompatibilityRuleDto } from './compatibility.types.js'

function ensureAdmin(actor: AuthenticatedUser) {
  if (actor.rol.codigo !== 'ADMINISTRADOR') {
    throw new AppError(403, 'FORBIDDEN', 'No tiene permisos para administrar compatibilidades')
  }
}

function mapRule(rule: CompatibilityRecord): CompatibilityRuleDto {
  return {
    bus: rule.bus,
    busId: rule.busId,
    condicionUso: rule.condicionUso,
    definidaPor: rule.definidaPor,
    especificacionesValidadas: rule.especificacionesValidadas as Record<string, unknown>,
    fechaDefinicion: rule.fechaDefinicion.toISOString(),
    id: rule.id,
    modeloBus: rule.modeloBus,
    modeloBusId: rule.modeloBusId,
    permitido: rule.permitido,
    version: rule.version,
    vigente: rule.vigente,
  }
}

export class CompatibilityService {
  constructor(private readonly repository = new CompatibilityRepository()) {}

  async list(repuestoId: string, actor: AuthenticatedUser) {
    ensureAdmin(actor)
    return { compatibilidades: (await this.repository.list(repuestoId)).map(mapRule) }
  }

  async create(repuestoId: string, input: CreateCompatibilityInput, actor: AuthenticatedUser) {
    ensureAdmin(actor)
    try {
      const rule = await this.repository.createVersion(repuestoId, actor.id, input)
      return { compatibilidad: mapRule(rule) }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new AppError(404, 'COMPATIBILITY_TARGET_NOT_FOUND', 'El repuesto o destino no existe')
      }
      throw error
    }
  }

  async deactivate(repuestoId: string, compatibilidadId: string, actor: AuthenticatedUser) {
    ensureAdmin(actor)
    const rule = await this.repository.find(repuestoId, compatibilidadId)
    if (!rule) throw new AppError(404, 'COMPATIBILITY_NOT_FOUND', 'Regla no encontrada')
    await this.repository.deactivate(repuestoId, compatibilidadId)
    const updated = (await this.repository.list(repuestoId)).find(
      (item) => item.id === compatibilidadId,
    )
    return {
      compatibilidad: mapRule(updated ?? ({ ...rule, vigente: false } as CompatibilityRecord)),
    }
  }
}
