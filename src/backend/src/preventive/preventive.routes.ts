import { Router } from 'express'

import { authenticate, authorizeRoles, enforceAllowedOrigin } from '../auth/auth.middleware.js'
import { idempotent } from '../idempotency/idempotency.middleware.js'
import { asyncHandler } from '../shared/http.js'
import { PreventivePlanController } from './preventive-plan.controller.js'
import { PreventiveController } from './preventive.controller.js'

const preventivePlanController = new PreventivePlanController()
const preventiveController = new PreventiveController()
const preventiveRoutes = Router()

preventiveRoutes.use(authenticate)

preventiveRoutes.get(
  '/planes',
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(preventivePlanController.list),
)
preventiveRoutes.post(
  '/planes',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  idempotent(preventivePlanController.create),
)
preventiveRoutes.get(
  '/planes/:planId',
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(preventivePlanController.get),
)
preventiveRoutes.post(
  '/planes/:planId/versiones',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  idempotent(preventivePlanController.createVersion),
)
preventiveRoutes.post(
  '/planes/:planId/desactivar',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  idempotent(preventivePlanController.deactivate),
)

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
  idempotent(preventiveController.createSchedule),
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
  idempotent(preventiveController.updateSchedule),
)
preventiveRoutes.post(
  '/programaciones/:programacionId/generar-orden',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  idempotent(preventiveController.generateOrder),
)

export { preventiveRoutes }
