import { Router } from 'express'

import { authenticate, authorizeRoles } from '../auth/auth.middleware.js'
import { asyncHandler } from '../shared/http.js'
import { ReportController } from './report.controller.js'

const reportController = new ReportController()
const reportRoutes = Router()

reportRoutes.use(authenticate)

reportRoutes.get('/resumen', asyncHandler(reportController.summarize))
reportRoutes.get(
  '/mi-bus',
  authorizeRoles('CONDUCTOR'),
  asyncHandler(reportController.getMyBusHistory),
)
reportRoutes.get(
  '/buses',
  authorizeRoles('ADMINISTRADOR', 'DESPACHADOR', 'MECANICO'),
  asyncHandler(reportController.listBuses),
)
reportRoutes.get(
  '/informes/mantenimiento',
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(reportController.maintenanceReport),
)
reportRoutes.get(
  '/informes/repuestos',
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(reportController.partsReport),
)
reportRoutes.get(
  '/informes/costos',
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(reportController.costReport),
)
reportRoutes.get(
  '/buses/:busId',
  authorizeRoles('ADMINISTRADOR', 'DESPACHADOR', 'MECANICO'),
  asyncHandler(reportController.getBusHistory),
)

export { reportRoutes }
