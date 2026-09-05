const API_URL =
  import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '/api' : 'http://localhost:4000')
const CSRF_HEADER = 'X-CSRF-Token'
const IDEMPOTENCY_HEADER = 'Idempotency-Key'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

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

interface CsrfResponse {
  data?: {
    csrfToken?: string
  }
}

let csrfTokenPromise: Promise<string> | null = null

async function getCsrfToken() {
  if (!csrfTokenPromise) {
    csrfTokenPromise = fetch(`${API_URL}/auth/csrf`, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
      method: 'GET',
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => ({}))) as CsrfResponse
        const token = body.data?.csrfToken

        if (!response.ok || !token) {
          throw new ApiError(
            response.status,
            'CSRF_TOKEN_UNAVAILABLE',
            'No se pudo preparar la solicitud segura',
          )
        }

        return token
      })
      .catch((error: unknown) => {
        csrfTokenPromise = null
        throw error
      })
  }

  return csrfTokenPromise
}

function idempotencyKeyFromBody(body: BodyInit | null | undefined) {
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body) as { claveIdempotencia?: unknown }

      if (typeof parsed.claveIdempotencia === 'string') {
        return parsed.claveIdempotencia
      }
    } catch {
      // Non-JSON bodies use a fresh standard key.
    }
  }

  return crypto.randomUUID()
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
  const method = (init.method ?? 'GET').toUpperCase()

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (!SAFE_METHODS.has(method) && !headers.has(CSRF_HEADER)) {
    headers.set(CSRF_HEADER, await getCsrfToken())
  }

  if (!SAFE_METHODS.has(method) && !headers.has(IDEMPOTENCY_HEADER)) {
    headers.set(IDEMPOTENCY_HEADER, idempotencyKeyFromBody(init.body))
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
