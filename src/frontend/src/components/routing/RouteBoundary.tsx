import { Component, Suspense, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

export function RouteLoading() {
  return (
    <section
      aria-atomic="true"
      aria-busy="true"
      aria-live="polite"
      className="mx-auto flex min-h-64 max-w-3xl flex-col justify-center px-6 py-12"
      role="status"
    >
      <h2 className="text-base font-semibold text-slate-900">Cargando módulo</h2>
      <p className="mt-2 text-sm text-slate-600">Estamos preparando la información solicitada.</p>
    </section>
  )
}

interface RouteErrorBoundaryProps {
  children: ReactNode
}

interface RouteErrorBoundaryState {
  hasError: boolean
}

class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <section
          aria-atomic="true"
          aria-live="assertive"
          className="mx-auto flex min-h-64 max-w-3xl flex-col justify-center px-6 py-12"
          role="alert"
        >
          <h2 className="text-base font-semibold text-slate-900">
            No fue posible cargar este módulo
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Verifique su conexión e intente cargar la página nuevamente.
          </p>
          <div className="mt-5">
            <button
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              onClick={() => window.location.reload()}
              type="button"
            >
              Reintentar carga
            </button>
          </div>
        </section>
      )
    }

    return this.props.children
  }
}

export function LazyRoute({ children }: { children: ReactNode }) {
  const location = useLocation()

  return (
    <RouteErrorBoundary key={location.pathname}>
      <Suspense fallback={<RouteLoading />}>{children}</Suspense>
    </RouteErrorBoundary>
  )
}
