import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { journeyFixture } from '../../test/app-test-helpers'
import JourneyAgenda from './JourneyAgenda'
import type { JourneyGroupBy } from './JourneyAgenda'
import type { JourneyDto } from './journey.types'

function makeJourney(id: number, overrides: Partial<JourneyDto> = {}): JourneyDto {
  const base = journeyFixture() as JourneyDto
  return {
    ...base,
    id,
    inicioProgramado: `2026-10-${String(5 + (id % 3)).padStart(2, '0')}T11:00:00.000Z`,
    finProgramado: `2026-10-${String(5 + (id % 3)).padStart(2, '0')}T19:00:00.000Z`,
    ...overrides,
  }
}

function showAgenda(journeys: JourneyDto[], searchTerm = '') {
  const onAction = vi.fn()
  function Harness() {
    const [groupBy, setGroupBy] = useState<JourneyGroupBy>('bus')
    return (
      <JourneyAgenda
        journeys={journeys}
        onAction={onAction}
        page={1}
        searchTerm={searchTerm}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
      />
    )
  }
  render(
    <MemoryRouter>
      <Harness />
    </MemoryRouter>,
  )
  return onAction
}

describe('Agenda compacta de jornadas', () => {
  it('agrupa por Bus de forma predeterminada y deja el detalle bajo demanda', () => {
    showAgenda([makeJourney(1)])
    const group = screen.getByRole('article', { name: 'Jornadas de BUS-JORNADA-01 · JOR001' })
    expect(
      within(group).getByText('1 jornada en esta página', { exact: false }),
    ).toBeInTheDocument()
    expect(within(group).getByText('Operativo')).toBeInTheDocument()
    expect(within(group).queryByText('Estado de jornada')).not.toBeInTheDocument()
    fireEvent.click(within(group).getByRole('button', { name: 'Ver jornadas' }))
    expect(within(group).getByText('Estado de jornada')).toBeInTheDocument()
    expect(within(group).getByText('Programada')).toBeInTheDocument()
    expect(within(group).queryByText(/Odómetro inicial/)).not.toBeInTheDocument()
    fireEvent.click(within(group).getByLabelText('Acciones de jornada 1'))
    fireEvent.click(within(group).getByRole('button', { name: 'Ver detalle' }))
    expect(within(group).getByRole('region', { name: 'Detalle de jornada 1' })).toHaveTextContent(
      'Odómetro inicial',
    )
    expect(within(group).getByRole('link', { name: 'Ver historial del bus' })).toHaveAttribute(
      'href',
      '/historial?busId=2007',
    )
  })

  it('mantiene compactas más de diez jornadas del mismo bus y distingue bus de jornada', () => {
    const base = makeJourney(1)
    const journeys = Array.from({ length: 12 }, (_, index) =>
      makeJourney(index + 1, {
        bus: { ...base.bus, estadoOperativo: 'FUERA_DE_SERVICIO' },
        estado: index === 0 ? 'INTERRUMPIDA' : 'PROGRAMADA',
      }),
    )
    showAgenda(journeys)
    const group = screen.getByRole('article', { name: 'Jornadas de BUS-JORNADA-01 · JOR001' })
    expect(
      within(group).getByText('12 jornadas en esta página', { exact: false }),
    ).toBeInTheDocument()
    expect(within(group).getByText('Fuera de servicio')).toBeInTheDocument()
    expect(within(group).queryByLabelText(/Acciones de jornada/)).not.toBeInTheDocument()
    fireEvent.click(within(group).getByRole('button', { name: 'Ver jornadas' }))
    expect(within(group).getAllByLabelText(/Acciones de jornada/)).toHaveLength(12)
    expect(within(group).getByText('Interrumpida')).toBeInTheDocument()
    expect(within(group).getAllByText('Programada')).toHaveLength(11)
    fireEvent.click(within(group).getByRole('button', { name: 'Ocultar jornadas' }))
    expect(within(group).queryByLabelText(/Acciones de jornada/)).not.toBeInTheDocument()
    expect(journeys[0].estado).toBe('INTERRUMPIDA')
  })

  it('agrupa varios buses por Conductor o Fecha sin cambiar los datos', () => {
    const base = makeJourney(1)
    const journeys = [
      base,
      makeJourney(2, {
        bus: { ...base.bus, id: 2008, codigoInterno: 'BUS-002', placa: 'JOR002' },
      }),
      makeJourney(3, {
        bus: { ...base.bus, id: 2009, codigoInterno: 'BUS-003', placa: 'JOR003' },
        conductor: { ...base.conductor, id: 2072, nombre: 'Otra conductora' },
      }),
    ]
    showAgenda(journeys)
    expect(screen.getAllByRole('article')).toHaveLength(3)
    fireEvent.change(screen.getByLabelText('Agrupar por'), { target: { value: 'conductor' } })
    expect(screen.getAllByRole('article')).toHaveLength(2)
    const driverGroup = screen.getByRole('article', { name: 'Jornadas de Conductor' })
    expect(within(driverGroup).getByText(/2 buses en esta página/)).toBeInTheDocument()
    fireEvent.click(within(driverGroup).getByRole('button', { name: 'Ver jornadas' }))
    expect(within(driverGroup).getByText(/BUS-002 · JOR002/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Agrupar por'), { target: { value: 'fecha' } })
    expect(screen.getAllByRole('article')).toHaveLength(3)
    const firstDateGroup = screen.getAllByRole('article')[0]
    fireEvent.click(within(firstDateGroup).getByRole('button', { name: 'Ver jornadas' }))
    expect(within(firstDateGroup).getAllByText('Conductor').length).toBeGreaterThan(0)
    expect(within(firstDateGroup).getByText('BUS-JORNADA-01 · JOR001')).toBeInTheDocument()
    expect(journeys.map((journey) => journey.id)).toEqual([1, 2, 3])
  })

  it('abre resultados buscados y conserva las acciones autorizadas en el menú', () => {
    const journey = makeJourney(5)
    const onAction = showAgenda([journey], 'BUS-JORNADA-01')
    const group = screen.getByRole('article', { name: 'Jornadas de BUS-JORNADA-01 · JOR001' })
    expect(within(group).getByLabelText('Acciones de jornada 5')).toBeInTheDocument()
    fireEvent.click(within(group).getByLabelText('Acciones de jornada 5'))
    fireEvent.click(within(group).getByRole('button', { name: 'Cambiar bus o conductor' }))
    expect(onAction).toHaveBeenCalledWith('reassign', journey)
    fireEvent.click(within(group).getByLabelText('Acciones de jornada 5'))
    fireEvent.click(within(group).getByRole('button', { name: 'Cancelar jornada' }))
    expect(onAction).toHaveBeenCalledWith('cancel', journey)
  })
})
