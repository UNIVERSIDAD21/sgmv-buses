import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RolCodigo } from '@prisma/client'
import type { AuthenticatedUser } from '../src/auth/auth.types.js'
import type { AvailabilityRecords } from '../src/availability/availability.types.js'

const mocks = vi.hoisted(() => ({
  schedules: vi.fn(),
  availability: vi.fn(),
  transaction: vi.fn(async (operation: (tx: object) => Promise<unknown>) => operation({})),
}))
vi.mock('../src/prisma/client.js', () => ({
  prisma: {
    programacionMantenimiento: { findMany: mocks.schedules },
    $transaction: mocks.transaction,
  },
}))
vi.mock('../src/availability/availability.repository.js', () => ({
  getAvailabilityRecordsBatch: mocks.availability,
}))
import { PreventiveRestrictionsService } from '../src/preventive/preventive-restrictions.service.js'

const evaluatedAt = new Date('2026-11-09T18:00:00.000Z')
const actor = (codigo: RolCodigo): AuthenticatedUser => ({
  id: 1,
  email: 'coordinacion@test.sgmv.local',
  estado: 'ACTIVO',
  nombre: 'Prueba',
  rol: { codigo, nombre: codigo },
})
function schedules(count = 66) {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    busId: (index % 22) + 1,
    actividad: 'Diagnóstico técnico reservado',
    fechaProgramada: new Date('2026-11-08T00:00:00.000Z'),
    kilometrajeObjetivo: null,
    bus: { id: (index % 22) + 1, codigoInterno: `SIM-${index % 22}`, kilometrajeActual: 10000 },
    planMantenimientoPreventivo: {
      anticipacionDias: 2,
      anticipacionKm: 500,
      bloqueaAlVencer: true,
      claveTarea: `TAREA-${index}`,
      id: index + 1,
      version: 1,
    },
  }))
}
function records(busId: number): AvailabilityRecords {
  return {
    bus: { id: busId, estadoOperativo: 'OPERATIVO', kilometrajeActual: 10000 },
    conflictingJourney: null,
    novelty: null,
    order: busId === 1 ? { id: 80 } : null,
    preventive: [],
  }
}
describe('Restricciones preventivas con escenario completo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.schedules.mockResolvedValue(schedules())
    mocks.availability.mockImplementation(async (inputs: Array<{ busId: number }>) =>
      inputs.map((row) => records(row.busId)),
    )
  })
  it('conserva las 66 restricciones operativas de despacho sin consultar disponibilidad técnica ni exponerla', async () => {
    const result = await new PreventiveRestrictionsService().list(actor('DESPACHADOR'), evaluatedAt)
    expect(result.restricciones).toHaveLength(66)
    expect(
      result.restricciones.every((row) => row.bloqueaDespacho && row.estado === 'VENCIDO'),
    ).toBe(true)
    expect(JSON.stringify(result)).not.toMatch(/Diagnóstico técnico|disponibilidad|claveTarea/)
    expect(mocks.transaction).not.toHaveBeenCalled()
    expect(mocks.availability).not.toHaveBeenCalled()
  })
  it('resuelve una vez los 22 buses distintos para Administrador sin recortar programaciones ni perder causas', async () => {
    const result = await new PreventiveRestrictionsService().list(
      actor('ADMINISTRADOR'),
      evaluatedAt,
    )
    expect(result.restricciones).toHaveLength(66)
    expect(mocks.availability).toHaveBeenCalledTimes(1)
    expect(mocks.availability.mock.calls[0]?.[0]).toHaveLength(22)
    expect(result.restricciones[0]).toMatchObject({
      actividad: 'Diagnóstico técnico reservado',
      disponibilidad: { causaPrincipal: 'ORDEN_TECNICA_ACTIVA', disponible: false },
    })
    expect(result.restricciones[1]).toMatchObject({
      disponibilidad: { causaPrincipal: null, disponible: true },
    })
  })
  it('no abre transacción cuando todos los objetivos están vigentes', async () => {
    mocks.schedules.mockResolvedValue(
      schedules().map((row) => ({ ...row, fechaProgramada: new Date('2026-12-01T00:00:00.000Z') })),
    )
    expect(
      (await new PreventiveRestrictionsService().list(actor('ADMINISTRADOR'), evaluatedAt))
        .restricciones,
    ).toEqual([])
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
  it.each(['MECANICO', 'CONDUCTOR'] as const)(
    'rechaza %s antes de consultar datos',
    async (role) => {
      await expect(
        new PreventiveRestrictionsService().list(actor(role), evaluatedAt),
      ).rejects.toMatchObject({ statusCode: 403 })
      expect(mocks.schedules).not.toHaveBeenCalled()
    },
  )
})
