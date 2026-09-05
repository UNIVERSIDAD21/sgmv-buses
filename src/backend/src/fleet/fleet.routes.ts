import { Router } from 'express'

import { authenticate, authorizeRoles, enforceAllowedOrigin } from '../auth/auth.middleware.js'
import { idempotent } from '../idempotency/idempotency.middleware.js'
import { asyncHandler } from '../shared/http.js'
import { FleetCatalogController } from './fleet-catalog.controller.js'
import { FleetController } from './fleet.controller.js'

const fleetCatalogController = new FleetCatalogController()
const fleetController = new FleetController()
const fleetRoutes = Router()

fleetRoutes.use(authenticate)

fleetRoutes.get(
  '/modelos-bus',
  authorizeRoles('ADMINISTRADOR', 'DESPACHADOR'),
  asyncHandler(fleetCatalogController.listModelosBus),
)
fleetRoutes.post(
  '/modelos-bus',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  idempotent(fleetCatalogController.createModeloBus),
)
fleetRoutes.get(
  '/modelos-bus/:modeloBusId',
  authorizeRoles('ADMINISTRADOR', 'DESPACHADOR'),
  asyncHandler(fleetCatalogController.getModeloBus),
)
fleetRoutes.patch(
  '/modelos-bus/:modeloBusId',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  idempotent(fleetCatalogController.updateModeloBus),
)
fleetRoutes.post(
  '/modelos-bus/:modeloBusId/activar',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  idempotent(fleetCatalogController.activateModeloBus),
)
fleetRoutes.post(
  '/modelos-bus/:modeloBusId/desactivar',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  idempotent(fleetCatalogController.deactivateModeloBus),
)

fleetRoutes.get(
  '/rutas',
  authorizeRoles('ADMINISTRADOR', 'DESPACHADOR'),
  asyncHandler(fleetCatalogController.listRutas),
)
fleetRoutes.post(
  '/rutas',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  idempotent(fleetCatalogController.createRuta),
)
fleetRoutes.get(
  '/rutas/:rutaId',
  authorizeRoles('ADMINISTRADOR', 'DESPACHADOR'),
  asyncHandler(fleetCatalogController.getRuta),
)
fleetRoutes.patch(
  '/rutas/:rutaId',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  idempotent(fleetCatalogController.updateRuta),
)
fleetRoutes.post(
  '/rutas/:rutaId/activar',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  idempotent(fleetCatalogController.activateRuta),
)
fleetRoutes.post(
  '/rutas/:rutaId/desactivar',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  idempotent(fleetCatalogController.deactivateRuta),
)

fleetRoutes.get(
  '/resumen',
  authorizeRoles('ADMINISTRADOR', 'DESPACHADOR'),
  asyncHandler(fleetController.summarize),
)
fleetRoutes.get(
  '/mi-bus',
  authorizeRoles('CONDUCTOR'),
  asyncHandler(fleetController.getAssignedBus),
)
fleetRoutes.get(
  '/conductores-disponibles',
  authorizeRoles('ADMINISTRADOR', 'DESPACHADOR'),
  asyncHandler(fleetController.getAvailableDrivers),
)
fleetRoutes.get(
  '/buses',
  authorizeRoles('ADMINISTRADOR', 'DESPACHADOR'),
  asyncHandler(fleetController.listBuses),
)
fleetRoutes.post(
  '/buses',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  idempotent(fleetController.createBus),
)
fleetRoutes.get(
  '/buses/:busId',
  authorizeRoles('ADMINISTRADOR', 'DESPACHADOR', 'CONDUCTOR'),
  asyncHandler(fleetController.getBus),
)
fleetRoutes.patch(
  '/buses/:busId',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  idempotent(fleetController.updateBus),
)
fleetRoutes.post(
  '/buses/:busId/kilometraje',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR', 'DESPACHADOR'),
  idempotent(fleetController.registerMileage),
)
fleetRoutes.get(
  '/buses/:busId/kilometraje',
  authorizeRoles('ADMINISTRADOR', 'DESPACHADOR'),
  asyncHandler(fleetController.getMileageReadings),
)
fleetRoutes.post(
  '/buses/:busId/estado',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  idempotent(fleetController.changeState),
)
fleetRoutes.get(
  '/buses/:busId/estados',
  authorizeRoles('ADMINISTRADOR', 'DESPACHADOR'),
  asyncHandler(fleetController.getStateHistory),
)
fleetRoutes.get(
  '/buses/:busId/asignaciones',
  authorizeRoles('ADMINISTRADOR', 'DESPACHADOR'),
  asyncHandler(fleetController.getAssignments),
)

export { fleetRoutes }
