import cookieParser from 'cookie-parser'
import cors from 'cors'
import express, { type Express } from 'express'
import helmet from 'helmet'

import { authRoutes } from './auth/auth.routes.js'
import { env } from './config/env.js'
import { fleetRoutes } from './fleet/fleet.routes.js'
import { noveltyRoutes } from './novelties/novelty.routes.js'
import { preventiveRoutes } from './preventive/preventive.routes.js'
import { reportRoutes } from './reports/report.routes.js'
import { errorHandler, notFoundHandler } from './shared/http.js'
import { inventoryRoutes, sparePartRoutes } from './spare-parts/spare-part.routes.js'
import { workOrderRoutes } from './work-orders/work-order.routes.js'

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
  app.use('/flota', fleetRoutes)
  app.use('/novedades', noveltyRoutes)
  app.use('/mantenimiento-preventivo', preventiveRoutes)
  app.use('/ordenes-trabajo', workOrderRoutes)
  app.use('/repuestos', sparePartRoutes)
  app.use('/inventario', inventoryRoutes)
  app.use('/historial', reportRoutes)
  configureRoutes?.(app)
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
