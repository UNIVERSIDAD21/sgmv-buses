import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { createApp } from '../src/app.js'

describe('GET /health', () => {
  it('returns the API health status', async () => {
    const response = await request(createApp()).get('/health').expect(200)

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'sgmv-api',
    })
  })
})
