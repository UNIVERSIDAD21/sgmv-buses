import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import StatCard from './StatCard'

describe('StatCard', () => {
  it('expone una acción navegable con nombre accesible cuando recibe una ruta', () => {
    render(
      <MemoryRouter>
        <StatCard
          actionLabel="Asignar mecánico"
          description="Esperan un responsable técnico"
          label="Órdenes pendientes de asignación"
          priority="attention"
          to="/ordenes-trabajo?estado=PENDIENTE_ASIGNACION"
          value={3}
        />
      </MemoryRouter>,
    )

    const link = screen.getByRole('link', { name: /órdenes pendientes de asignación: 3/i })
    expect(link).toHaveAttribute('href', '/ordenes-trabajo?estado=PENDIENTE_ASIGNACION')
    expect(screen.getByText(/asignar mecánico/i)).toBeInTheDocument()
  })

  it('conserva una superficie informativa cuando no recibe una ruta', () => {
    render(<StatCard label="Total de buses" value={12} />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('Total de buses')).toBeInTheDocument()
  })
})
