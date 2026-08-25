import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'

import { env } from './config/env.js'

export function createApp() {
  const app = express()

  app.disable('x-powered-by')
  app.use(helmet())
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())

  app.get('/health', (_request, response) => {
    response.status(200).json({
      status: 'ok',
      service: 'sgmv-api',
      environment: env.NODE_ENV,
    })
  })

  return app
}
