import { Router } from 'express'

import { authenticate, authorizeRoles, enforceAllowedOrigin } from '../auth/auth.middleware.js'
import { asyncHandler } from '../shared/http.js'
import { WorkOrderController } from './work-order.controller.js'

const workOrderController = new WorkOrderController()
const workOrderRoutes = Router()

workOrderRoutes.use(authenticate)

workOrderRoutes.get(
  '/resumen',
  authorizeRoles('ADMINISTRADOR', 'MECANICO'),
  asyncHandler(workOrderController.summarize),
)
workOrderRoutes.get(
  '/mis-ordenes',
  authorizeRoles('MECANICO'),
  asyncHandler(workOrderController.listMyOrders),
)
workOrderRoutes.get(
  '/mecanicos-disponibles',
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(workOrderController.getAvailableMechanics),
)
workOrderRoutes.post(
  '/',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(workOrderController.createManual),
)
workOrderRoutes.get(
  '/',
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(workOrderController.listAdminOrders),
)
workOrderRoutes.get(
  '/:ordenId/historial',
  authorizeRoles('ADMINISTRADOR', 'MECANICO'),
  asyncHandler(workOrderController.getStateHistory),
)
workOrderRoutes.get(
  '/:ordenId/reasignaciones',
  authorizeRoles('ADMINISTRADOR', 'MECANICO'),
  asyncHandler(workOrderController.getReassignments),
)
workOrderRoutes.post(
  '/:ordenId/asignar',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(workOrderController.assign),
)
workOrderRoutes.post(
  '/:ordenId/reasignar',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(workOrderController.reassign),
)
workOrderRoutes.post(
  '/:ordenId/iniciar',
  enforceAllowedOrigin,
  authorizeRoles('MECANICO'),
  asyncHandler(workOrderController.start),
)
workOrderRoutes.post(
  '/:ordenId/reanudar',
  enforceAllowedOrigin,
  authorizeRoles('MECANICO'),
  asyncHandler(workOrderController.resume),
)
workOrderRoutes.patch(
  '/:ordenId/intervencion',
  enforceAllowedOrigin,
  authorizeRoles('MECANICO'),
  asyncHandler(workOrderController.updateIntervention),
)
workOrderRoutes.post(
  '/:ordenId/actividades',
  enforceAllowedOrigin,
  authorizeRoles('MECANICO'),
  asyncHandler(workOrderController.createActivity),
)
workOrderRoutes.get(
  '/:ordenId/repuestos-disponibles',
  authorizeRoles('ADMINISTRADOR', 'MECANICO'),
  asyncHandler(workOrderController.getAvailableSpareParts),
)
workOrderRoutes.post(
  '/:ordenId/consumos',
  enforceAllowedOrigin,
  authorizeRoles('MECANICO'),
  asyncHandler(workOrderController.createConsumption),
)
workOrderRoutes.post(
  '/:ordenId/completar',
  enforceAllowedOrigin,
  authorizeRoles('MECANICO'),
  asyncHandler(workOrderController.complete),
)
workOrderRoutes.post(
  '/:ordenId/devolver',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(workOrderController.returnForCorrection),
)
workOrderRoutes.post(
  '/:ordenId/cerrar',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(workOrderController.close),
)
workOrderRoutes.get(
  '/:ordenId',
  authorizeRoles('ADMINISTRADOR', 'MECANICO'),
  asyncHandler(workOrderController.getOrder),
)

export { workOrderRoutes }
