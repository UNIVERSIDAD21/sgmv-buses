import { afterEach, describe, expect, it, vi } from 'vitest'

import { prisma } from '../src/prisma/client.js'
import { WorkOrderRepository } from '../src/work-orders/work-order.repository.js'

afterEach(() => vi.restoreAllMocks())

describe('proyección de despacho por snapshot', () => {
  it('consulta por lotes y conserva la exclusión de jornada y la fecha común', async () => {
    const now = new Date('2026-09-10T21:00:00Z')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(now)
    const orders = Array.from({ length: 100 }, (_, index) => ({
      bus: { codigoInterno: 'BUS', id: 'bus', placa: 'ABC123' },
      busId: 'bus',
      codigo: `OT-${index}`,
      disponibilidadAlCierre: null,
      estado: 'ASIGNADA',
      fechaCierre: null,
      id: `order-${index}`,
      jornadaOperativaId: index === 0 ? 'journey' : null,
    }))
    const tx = {
      ordenTrabajo: { findMany: vi.fn().mockResolvedValueOnce(orders).mockResolvedValue([]) },
      bus: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ id: 'bus', estadoOperativo: 'OPERATIVO', kilometrajeActual: 0 }]),
      },
      jornadaOperativa: { findMany: vi.fn().mockResolvedValue([{ id: 'journey', busId: 'bus' }]) },
      novedad: { findMany: vi.fn().mockResolvedValue([]) },
      programacionMantenimiento: { findMany: vi.fn().mockResolvedValue([]) },
    }
    const transaction = vi
      .spyOn(prisma, '$transaction')
      .mockImplementation((async (callback: (client: unknown) => Promise<unknown>) =>
        callback(tx)) as never)
    try {
      const result = await new WorkOrderRepository().listDispatchProjections()
      expect(transaction).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ isolationLevel: 'RepeatableRead' }),
      )
      expect(tx.ordenTrabajo.findMany).toHaveBeenCalledTimes(2)
      for (const model of [tx.bus, tx.jornadaOperativa, tx.novedad, tx.programacionMantenimiento]) {
        expect(model.findMany).toHaveBeenCalledTimes(1)
      }
      expect(result).toHaveLength(100)
      expect(result[0].disponibilidad.disponible).toBe(true)
      expect(result[1].disponibilidad.causaPrincipal).toBe('CONFLICTO_JORNADA')
      expect(new Set(result.map((row) => row.disponibilidad.evaluadoAt))).toEqual(
        new Set([now.toISOString()]),
      )
      expect(JSON.stringify(result)).not.toMatch(/costo|diagnostico|subtotal/i)
    } finally {
      vi.useRealTimers()
    }
  })
})
