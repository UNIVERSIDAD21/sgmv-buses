import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import AppShell from './AppShell'

const getUnreadAlertCount = vi.fn(async () => ({ count: 2 }))

vi.mock('../../features/alertas/alert.api', () => ({
  ALERTS_UPDATED_EVENT: 'sgmv:alerts-updated',
  getUnreadAlertCount: () => getUnreadAlertCount(),
}))

const user = {
  email: 'despachador.demo@sgmv.local',
  nombre: 'Despachador Demo',
  rol: { codigo: 'DESPACHADOR' as const },
}

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/inicio']}>
      <Routes>
        <Route element={<AppShell onLogout={vi.fn(async () => undefined)} user={user} />}>
          <Route element={<p>Inicio operativo</p>} path="/inicio" />
          <Route element={<p>Jornadas cargadas</p>} path="/jornadas" />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
  getUnreadAlertCount.mockClear()
})

describe('AppShell final UX', () => {
  it('identifies the isolated local or test environment without sensitive configuration', () => {
    renderShell()

    expect(screen.getByLabelText(/Entorno (local|pruebas)/i)).toHaveTextContent(
      /datos de prueba aislados|No se sincronizan automáticamente con producción/i,
    )
    expect(screen.queryByText(/DATABASE_URL|localhost:55432/i)).not.toBeInTheDocument()
  })

  it('persists the compact preference while keeping every link accessible by name', async () => {
    const view = renderShell()

    fireEvent.click(screen.getByRole('button', { name: /Colapsar men/ }))
    expect(window.localStorage.getItem('sgmv:sidebar-expanded')).toBe('false')
    expect(screen.getAllByRole('link', { name: 'Jornadas operativas' }).length).toBeGreaterThan(0)

    view.unmount()
    renderShell()
    expect(screen.getByRole('button', { name: /Expandir men/ })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('does not request the alert counter again on each internal navigation', async () => {
    renderShell()
    await waitFor(() => expect(getUnreadAlertCount).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getAllByRole('link', { name: 'Jornadas operativas' })[0]!)
    expect(await screen.findByText('Jornadas cargadas')).toBeInTheDocument()
    expect(getUnreadAlertCount).toHaveBeenCalledTimes(1)
  })
})
