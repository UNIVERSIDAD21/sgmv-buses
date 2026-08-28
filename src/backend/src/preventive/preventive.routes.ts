import { Router } from 'express'

import { authenticate, authorizeRoles, enforceAllowedOrigin } from '../auth/auth.middleware.js'
import { asyncHandler } from '../shared/http.js'
import { PreventiveController } from './preventive.controller.js'

const preventiveController = new PreventiveController()
const preventiveRoutes = Router()

preventiveRoutes.use(authenticate)

preventiveRoutes.get(
  '/resumen',
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(preventiveController.summarize),
)
preventiveRoutes.get(
  '/programaciones',
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(preventiveController.listSchedules),
)
preventiveRoutes.post(
  '/programaciones',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(preventiveController.createSchedule),
)
preventiveRoutes.get(
  '/programaciones/:programacionId',
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(preventiveController.getSchedule),
)
preventiveRoutes.patch(
  '/programaciones/:programacionId',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(preventiveController.updateSchedule),
)
preventiveRoutes.post(
  '/programaciones/:programacionId/generar-orden',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(preventiveController.generateOrder),
)

export { preventiveRoutes }
