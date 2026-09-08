import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BrowserRouter, MemoryRouter } from 'react-router-dom'

import App from '../../App'
import AlertsPage from './AlertsPage'

const csrfToken = 'csrf-token-alertas-p9'

type TestRole = 'ADMINISTRADOR' | 'DESPACHADOR' | 'MECANICO' | 'CONDUCTOR'

const roleNames: Record<TestRole, string> = {
  ADMINISTRADOR: 'Administrador',
  DESPACHADOR: 'Despachador',
  MECANICO: 'Mecánico',
  CONDUCTOR: 'Conductor',
}

function userForRole(role: TestRole) {
  return {
    email: `${role.toLowerCase()}@sgmv.local`,
    estado: 'ACTIVO' as const,
    id: `user-${role.toLowerCase()}`,
    nombre: roleNames[role],
    rol: { codigo: role, nombre: roleNames[role] },
  }
}

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(status >= 400 ? { error: data } : { data }), {
    headers: { 'Content-Type': 'application/json' },
    status,
  })
}

function alertItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    alertaId: 'alert-1',
    contextoEvento: { busId: 'bus-1', enlaceInterno: '/novedades', schemaVersion: 1 },
    destinatarioId: 'recipient-1',
    enlaceInterno: '/novedades',
    estado: 'NO_LEIDA',
    fechaAtencion: null,
    fechaGeneracion: '2026-09-07T12:00:00.000Z',
    fechaLectura: null,
    mensaje: 'La novedad requiere revisión prioritaria.',
    prioridad: 'CRITICA',
    tipo: 'NOVEDAD_CRITICA',
    titulo: 'Novedad crítica reportada',
    ...overrides,
  }
}

function inbox(items = [alertItem()], page = 1, totalPages = 1) {
  return { items, page, pageSize: 10, total: items.length, totalPages }
}

interface AlertMockOptions {
  failFirstList?: boolean
  initialItems?: ReturnType<typeof alertItem>[]
  role?: TestRole
}

function mockAlertApi(options: AlertMockOptions = {}) {
  const state = {
    items: options.initialItems ?? [alertItem()],
    failedList: false,
  }
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init })
    const url = new URL(typeof input === 'string' ? input : input.toString())
    const method = init?.method ?? 'GET'

    if (url.pathname === '/auth/csrf') return response({ csrfToken })
    if (url.pathname === '/auth/me')
      return response({ user: userForRole(options.role ?? 'ADMINISTRADOR') })
    if (url.pathname === '/alertas/no-leidas/count') {
      return response({ count: state.items.filter((item) => item.estado === 'NO_LEIDA').length })
    }
    if (url.pathname === '/alertas' && method === 'GET') {
      if (options.failFirstList && !state.failedList) {
        state.failedList = true
        return response(
          { code: 'ALERTS_UNAVAILABLE', message: 'Servicio temporalmente no disponible' },
          503,
        )
      }
      return response(inbox(state.items, Number(url.searchParams.get('page') ?? 1), 2))
    }

    const mutation = url.pathname.match(/^\/alertas\/([^/]+)\/(leida|atendida)$/)
    if (mutation && method === 'PATCH') {
      const item = state.items.find((candidate) => candidate.destinatarioId === mutation[1])
      if (!item) return response({ code: 'NOT_FOUND', message: 'Alerta no encontrada' }, 404)
      if (mutation[2] === 'leida' && item.estado === 'NO_LEIDA') {
        item.estado = 'LEIDA'
        item.fechaLectura = '2026-09-07T12:05:00.000Z'
      } else if (mutation[2] === 'atendida' && item.estado !== 'ATENDIDA') {
        item.estado = 'ATENDIDA'
        item.fechaLectura ??= '2026-09-07T12:05:00.000Z'
        item.fechaAtencion = '2026-09-07T12:06:00.000Z'
      }
      return response({ alerta: item })
    }

    return response({ code: 'NOT_FOUND', message: `Ruta no simulada: ${url.pathname}` }, 404)
  })

  vi.stubGlobal('fetch', fetchMock)
  return { calls, fetchMock, state }
}

function callsFor(calls: Array<{ input: RequestInfo | URL; init?: RequestInit }>, path: string) {
  return calls.filter(
    ({ input }) => new URL(typeof input === 'string' ? input : input.toString()).pathname === path,
  )
}

function renderAlertsPage() {
  return render(
    <MemoryRouter initialEntries={['/alertas']}>
      <AlertsPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  window.history.pushState({}, '', '/')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('P9 AlertsPage', () => {
  it('loads own alerts, filters, paginates, and distinguishes unread semantically', async () => {
    const item = alertItem()
    const { calls } = mockAlertApi({ initialItems: [item] })

    renderAlertsPage()

    const article = await screen.findByRole('article')
    expect(within(article).getByText('No leída')).toBeInTheDocument()
    expect(article.className).toContain('border-emerald-300')
    expect(within(article).getByText('Novedad crítica reportada')).toBeInTheDocument()
    expect(within(article).getByText('Crítica')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'NO_LEIDA' } })
    fireEvent.change(screen.getByLabelText('Prioridad'), { target: { value: 'CRITICA' } })
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'NOVEDAD_CRITICA' } })
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-09-01' } })
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-09-07' } })

    await waitFor(() => {
      const listCall = callsFor(calls, '/alertas').at(-1)
      const url = new URL(String(listCall?.input))
      expect(url.searchParams.get('estado')).toBe('NO_LEIDA')
      expect(url.searchParams.get('prioridad')).toBe('CRITICA')
      expect(url.searchParams.get('tipo')).toBe('NOVEDAD_CRITICA')
      expect(url.searchParams.get('fechaDesde')).toBe('2026-09-01')
      expect(url.searchParams.get('fechaHasta')).toBe('2026-09-07')
    })

    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    await waitFor(() => {
      const listCall = callsFor(calls, '/alertas').at(-1)
      expect(new URL(String(listCall?.input)).searchParams.get('page')).toBe('2')
    })
  })

  it('marks an alert read, refreshes the item, and updates the inbox through the event contract', async () => {
    const { calls, state } = mockAlertApi()

    renderAlertsPage()
    const article = await screen.findByRole('article')
    fireEvent.click(within(article).getByRole('button', { name: 'Marcar leída' }))

    expect(await screen.findByText('Leída')).toBeInTheDocument()
    expect(state.items[0]?.estado).toBe('LEIDA')
    await waitFor(() => {
      expect(callsFor(calls, '/alertas/recipient-1/leida')).toHaveLength(1)
    })
    expect(screen.queryByRole('button', { name: 'Marcar leída' })).not.toBeInTheDocument()
  })

  it('marks an alert attended and preserves an individual terminal state', async () => {
    const { calls, state } = mockAlertApi()

    renderAlertsPage()
    const article = await screen.findByRole('article')
    fireEvent.click(within(article).getByRole('button', { name: 'Marcar atendida' }))

    expect(await screen.findByText('Atendida')).toBeInTheDocument()
    expect(state.items[0]?.estado).toBe('ATENDIDA')
    expect(callsFor(calls, '/alertas/recipient-1/atendida')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Marcar atendida' })).not.toBeInTheDocument()
  })

  it('shows a recoverable API error and retries the list', async () => {
    mockAlertApi({ failFirstList: true })

    renderAlertsPage()

    expect(await screen.findByText('Servicio temporalmente no disponible')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('article')).toBeInTheDocument()
  })

  it('navigates only through a safe internal origin and omits null or external links', async () => {
    mockAlertApi({
      initialItems: [
        alertItem({ destinatarioId: 'safe', enlaceInterno: '/novedades' }),
        alertItem({
          alertaId: 'unsafe-alert',
          destinatarioId: 'unsafe',
          enlaceInterno: 'https://evil.test',
        }),
        alertItem({ alertaId: 'null-alert', destinatarioId: 'null', enlaceInterno: null }),
      ],
    })

    window.history.pushState({}, '', '/alertas')
    render(
      <BrowserRouter>
        <AlertsPage />
      </BrowserRouter>,
    )

    const safeArticle = (await screen.findAllByRole('article')).find((article) =>
      within(article).queryByRole('button', { name: 'Ver origen' }),
    )
    expect(safeArticle).not.toBeNull()
    fireEvent.click(within(safeArticle!).getByRole('button', { name: 'Ver origen' }))
    expect(window.location.pathname).toBe('/novedades')
    expect(screen.getAllByRole('button', { name: 'Ver origen' })).toHaveLength(1)
  })

  it('does not send duplicate mutations when the same action is clicked twice', async () => {
    const { calls } = mockAlertApi()

    renderAlertsPage()
    const article = await screen.findByRole('article')
    const button = within(article).getByRole('button', { name: 'Marcar atendida' })
    fireEvent.click(button)
    fireEvent.click(button)

    await screen.findByText('Atendida')
    expect(callsFor(calls, '/alertas/recipient-1/atendida')).toHaveLength(1)
  })
})

describe('P9 campana, acceso y navegación por rol', () => {
  it('shows unread count and opens /alertas', async () => {
    const { calls } = mockAlertApi()
    window.history.pushState({}, '', '/inicio')
    render(<App />)

    const bell = await screen.findByRole('button', { name: 'Alertas internas, 1 sin leer' })
    fireEvent.click(bell)

    await waitFor(() => expect(window.location.pathname).toBe('/alertas'))
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Alertas internas' }),
    ).toBeInTheDocument()
    expect(callsFor(calls, '/alertas').length).toBeGreaterThan(0)
  })

  it.each(['ADMINISTRADOR', 'DESPACHADOR', 'MECANICO', 'CONDUCTOR'] as const)(
    'permite la bandeja para el rol %s y mantiene el conteo propio',
    async (role) => {
      const { calls } = mockAlertApi({ role })
      window.history.pushState({}, '', '/alertas')
      render(<App />)

      expect(
        await screen.findByRole('heading', { level: 2, name: 'Alertas internas' }),
      ).toBeInTheDocument()
      expect(
        await screen.findByRole('button', { name: 'Alertas internas, 1 sin leer' }),
      ).toBeInTheDocument()
      expect(callsFor(calls, '/alertas/no-leidas/count').length).toBeGreaterThan(0)
    },
  )

  it('reduces the campana count after marking the alert read', async () => {
    mockAlertApi()
    window.history.pushState({}, '', '/alertas')
    render(<App />)

    const article = await screen.findByRole('article')
    fireEvent.click(within(article).getByRole('button', { name: 'Marcar leída' }))

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Alertas internas, ninguna sin leer' }),
      ).toBeInTheDocument()
    })
  })
})
