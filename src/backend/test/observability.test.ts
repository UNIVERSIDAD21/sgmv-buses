import { Writable } from 'node:stream'

import { describe, expect, it } from 'vitest'

import { createLogger } from '../src/observability/logger.js'

describe('Structured logging', () => {
  it('emits JSON and redacts authentication secrets', () => {
    let output = ''
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString()
        callback()
      },
    })
    const testLogger = createLogger(destination, 'info')

    testLogger.info({
      payload: {
        contrasena: 'no-debe-aparecer',
        token: 'token-no-debe-aparecer',
      },
      requestId: 'request-visible',
    })

    const record = JSON.parse(output) as Record<string, unknown>
    const serialized = JSON.stringify(record)

    expect(record.requestId).toBe('request-visible')
    expect(serialized).toContain('[REDACTED]')
    expect(serialized).not.toContain('no-debe-aparecer')
    expect(serialized).not.toContain('token-no-debe-aparecer')
  })
})
