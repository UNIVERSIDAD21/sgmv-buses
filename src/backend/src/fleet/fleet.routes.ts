import { Router } from 'express'

import { authenticate, authorizeRoles, enforceAllowedOrigin } from '../auth/auth.middleware.js'
import { asyncHandler } from '../shared/http.js'
import { FleetController } from './fleet.controller.js'

const fleetController = new FleetController()
const fleetRoutes = Router()

fleetRoutes.use(authenticate)

fleetRoutes.get(
  '/resumen',
  authorizeRoles('ADMIN_SUPERVISOR'),
  asyncHandler(fleetController.summarize),
)
fleetRoutes.get(
  '/mi-bus',
  authorizeRoles('CONDUCTOR_OPERADOR'),
  asyncHandler(fleetController.getAssignedBus),
)
fleetRoutes.get(
  '/conductores-disponibles',
  authorizeRoles('ADMIN_SUPERVISOR'),
  asyncHandler(fleetController.getAvailableDrivers),
)
fleetRoutes.get(
  '/buses',
  authorizeRoles('ADMIN_SUPERVISOR'),
  asyncHandler(fleetController.listBuses),
)
fleetRoutes.post(
  '/buses',
  enforceAllowedOrigin,
  authorizeRoles('ADMIN_SUPERVISOR'),
  asyncHandler(fleetController.createBus),
)
fleetRoutes.get(
  '/buses/:busId',
  authorizeRoles('ADMIN_SUPERVISOR', 'CONDUCTOR_OPERADOR'),
  asyncHandler(fleetController.getBus),
)
fleetRoutes.patch(
  '/buses/:busId',
  enforceAllowedOrigin,
  authorizeRoles('ADMIN_SUPERVISOR'),
  asyncHandler(fleetController.updateBus),
)
fleetRoutes.post(
  '/buses/:busId/kilometraje',
  enforceAllowedOrigin,
  authorizeRoles('ADMIN_SUPERVISOR'),
  asyncHandler(fleetController.registerMileage),
)
fleetRoutes.get(
  '/buses/:busId/kilometraje',
  authorizeRoles('ADMIN_SUPERVISOR'),
  asyncHandler(fleetController.getMileageReadings),
)
fleetRoutes.post(
  '/buses/:busId/estado',
  enforceAllowedOrigin,
  authorizeRoles('ADMIN_SUPERVISOR'),
  asyncHandler(fleetController.changeState),
)
fleetRoutes.get(
  '/buses/:busId/estados',
  authorizeRoles('ADMIN_SUPERVISOR'),
  asyncHandler(fleetController.getStateHistory),
)
fleetRoutes.post(
  '/buses/:busId/asignaciones',
  enforceAllowedOrigin,
  authorizeRoles('ADMIN_SUPERVISOR'),
  asyncHandler(fleetController.assignDriver),
)
fleetRoutes.get(
  '/buses/:busId/asignaciones',
  authorizeRoles('ADMIN_SUPERVISOR'),
  asyncHandler(fleetController.getAssignments),
)

export { fleetRoutes }
