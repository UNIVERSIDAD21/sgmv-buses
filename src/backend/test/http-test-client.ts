import { randomUUID } from 'node:crypto'

import type { Express } from 'express'
import request, { type Test } from 'supertest'

import { env } from '../src/config/env.js'

const MUTATING_METHODS = new Set(['delete', 'patch', 'post', 'put'])

export async function createCsrfAgent(app: Express) {
  const agent = request.agent(app)
  const csrfResponse = await agent.get('/auth/csrf').set('Origin', env.CORS_ORIGIN).expect(200)
  const csrfToken = csrfResponse.body.data?.csrfToken as string | undefined

  if (!csrfToken) {
    throw new Error('CSRF token test setup failed')
  }

  return new Proxy(agent, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver) as unknown

      if (typeof property === 'string' && MUTATING_METHODS.has(property)) {
        return (path: string) => {
          const method = value as (requestPath: string) => Test

          const test = method
            .call(target, path)
            .set('Origin', env.CORS_ORIGIN)
            .set('X-CSRF-Token', csrfToken)
            .set('Idempotency-Key', randomUUID())
          const originalSend = test.send.bind(test)

          test.send = ((body?: string | object) => {
            if (
              body &&
              typeof body === 'object' &&
              'claveIdempotencia' in body &&
              typeof body.claveIdempotencia === 'string'
            ) {
              test.set('Idempotency-Key', body.claveIdempotencia)
            }

            return originalSend(body)
          }) as Test['send']

          return test
        }
      }

      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}
