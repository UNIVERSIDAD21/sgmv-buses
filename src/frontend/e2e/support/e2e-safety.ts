const loopbackHosts = new Set(['127.0.0.1', '::1', 'localhost'])

export function assertSafeWriteE2eTarget(baseUrl: string | undefined) {
  if (!baseUrl) {
    throw new Error('PLAYWRIGHT_BASE_URL es obligatoria para E2E con escritura')
  }

  const target = new URL(baseUrl)
  if (!loopbackHosts.has(target.hostname) || process.env.NODE_ENV === 'production') {
    throw new Error(
      `E2E con escritura rechazado: ${target.origin} no es un destino local autorizado`,
    )
  }
}

export function assertSafeWriteE2eDatabase(databaseUrl: string | undefined) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL es obligatoria para E2E con escritura')
  }

  const target = new URL(databaseUrl)
  if (!loopbackHosts.has(target.hostname)) {
    throw new Error('E2E con escritura rechazado: la base no es local')
  }
}
