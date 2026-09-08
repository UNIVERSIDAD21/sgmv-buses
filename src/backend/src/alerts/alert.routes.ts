import { Router } from 'express'

import { authenticate, enforceAllowedOrigin } from '../auth/auth.middleware.js'
import { asyncHandler } from '../shared/http.js'
import { AlertController } from './alert.controller.js'

const alertController = new AlertController()
const alertRoutes = Router()
alertRoutes.use(authenticate)
alertRoutes.get('/no-leidas/count', asyncHandler(alertController.countUnread))
alertRoutes.get('/', asyncHandler(alertController.listOwn))
alertRoutes.patch(
  '/:destinatarioId/leida',
  enforceAllowedOrigin,
  asyncHandler(alertController.markRead),
)
alertRoutes.patch(
  '/:destinatarioId/atendida',
  enforceAllowedOrigin,
  asyncHandler(alertController.markAttended),
)

export { alertRoutes }
