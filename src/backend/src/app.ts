import cookieParser from 'cookie-parser'
import cors from 'cors'
import express, { type Express } from 'express'
import helmet from 'helmet'

import { authRoutes } from './auth/auth.routes.js'
import { env } from './config/env.js'
import { errorHandler, notFoundHandler } from './shared/http.js'

export function createApp(configureRoutes?: (app: Express) => void) {
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

  app.use('/auth', authRoutes)
  configureRoutes?.(app)
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
