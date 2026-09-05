import { Router } from 'express'

import { authenticate, authorizeRoles, enforceAllowedOrigin } from '../auth/auth.middleware.js'
import { idempotent } from '../idempotency/idempotency.middleware.js'
import { asyncHandler } from '../shared/http.js'
import { JourneyController } from './journey.controller.js'

const controller = new JourneyController()
const journeyRoutes = Router()

journeyRoutes.use(authenticate)

journeyRoutes.get('/mi-jornada', authorizeRoles('CONDUCTOR'), asyncHandler(controller.getMyJourney))
journeyRoutes.get(
  '/opciones',
  authorizeRoles('ADMINISTRADOR', 'DESPACHADOR'),
  asyncHandler(controller.getOptions),
)
journeyRoutes.get(
  '/',
  authorizeRoles('ADMINISTRADOR', 'DESPACHADOR', 'CONDUCTOR'),
  asyncHandler(controller.list),
)
journeyRoutes.post(
  '/',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR', 'DESPACHADOR'),
  idempotent(controller.create),
)
journeyRoutes.get(
  '/:jornadaId',
  authorizeRoles('ADMINISTRADOR', 'DESPACHADOR', 'CONDUCTOR'),
  asyncHandler(controller.getById),
)
journeyRoutes.get(
  '/:jornadaId/kilometraje',
  authorizeRoles('ADMINISTRADOR', 'DESPACHADOR', 'CONDUCTOR'),
  asyncHandler(controller.listReadings),
)
journeyRoutes.post(
  '/:jornadaId/iniciar',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR', 'DESPACHADOR', 'CONDUCTOR'),
  idempotent(controller.start),
)
journeyRoutes.post(
  '/:jornadaId/finalizar',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR', 'DESPACHADOR', 'CONDUCTOR'),
  idempotent(controller.finish),
)
journeyRoutes.post(
  '/:jornadaId/cancelar',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR', 'DESPACHADOR'),
  idempotent(controller.cancel),
)
journeyRoutes.post(
  '/:jornadaId/reasignar',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR', 'DESPACHADOR'),
  idempotent(controller.reassign),
)

export { journeyRoutes }
