const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'

interface ApiEnvelope<T> {
  data: T
  message?: string
}

interface ApiErrorEnvelope {
  error?: {
    code?: string
    message?: string
  }
}

export class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(status: number, code: string, message: string) {
    super(message)
    this.code = code
    this.status = status
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  })

  const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T> & ApiErrorEnvelope

  if (!response.ok) {
    throw new ApiError(
      response.status,
      body.error?.code ?? 'REQUEST_ERROR',
      body.error?.message ?? 'No se pudo completar la solicitud',
    )
  }

  return body.data
}
