import { Router } from 'express'

import { authenticate, authorizeRoles, enforceAllowedOrigin } from '../auth/auth.middleware.js'
import { asyncHandler } from '../shared/http.js'
import { FleetController } from './fleet.controller.js'

const fleetController = new FleetController()
const fleetRoutes = Router()

fleetRoutes.use(authenticate)

fleetRoutes.get(
  '/resumen',
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(fleetController.summarize),
)
fleetRoutes.get(
  '/mi-bus',
  authorizeRoles('CONDUCTOR'),
  asyncHandler(fleetController.getAssignedBus),
)
fleetRoutes.get(
  '/conductores-disponibles',
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(fleetController.getAvailableDrivers),
)
fleetRoutes.get('/buses', authorizeRoles('ADMINISTRADOR'), asyncHandler(fleetController.listBuses))
fleetRoutes.post(
  '/buses',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(fleetController.createBus),
)
fleetRoutes.get(
  '/buses/:busId',
  authorizeRoles('ADMINISTRADOR', 'CONDUCTOR'),
  asyncHandler(fleetController.getBus),
)
fleetRoutes.patch(
  '/buses/:busId',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(fleetController.updateBus),
)
fleetRoutes.post(
  '/buses/:busId/kilometraje',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(fleetController.registerMileage),
)
fleetRoutes.get(
  '/buses/:busId/kilometraje',
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(fleetController.getMileageReadings),
)
fleetRoutes.post(
  '/buses/:busId/estado',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(fleetController.changeState),
)
fleetRoutes.get(
  '/buses/:busId/estados',
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(fleetController.getStateHistory),
)
fleetRoutes.post(
  '/buses/:busId/asignaciones',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(fleetController.assignDriver),
)
fleetRoutes.get(
  '/buses/:busId/asignaciones',
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(fleetController.getAssignments),
)

export { fleetRoutes }
