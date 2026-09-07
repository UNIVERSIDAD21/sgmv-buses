import { Router } from 'express'

import { authenticate, authorizeRoles, enforceAllowedOrigin } from '../auth/auth.middleware.js'
import { idempotent } from '../idempotency/idempotency.middleware.js'
import { asyncHandler } from '../shared/http.js'
import { SparePartController } from './spare-part.controller.js'
import { CompatibilityController } from './compatibility.controller.js'

const sparePartController = new SparePartController()
const compatibilityController = new CompatibilityController()
const sparePartRoutes = Router()
const inventoryRoutes = Router()

sparePartRoutes.use(authenticate)
sparePartRoutes.use(authorizeRoles('ADMINISTRADOR'))

sparePartRoutes.get('/resumen', asyncHandler(sparePartController.summarize))
sparePartRoutes.post('/', enforceAllowedOrigin, idempotent(sparePartController.create))
sparePartRoutes.get('/', asyncHandler(sparePartController.list))
sparePartRoutes.post(
  '/:repuestoId/activar',
  enforceAllowedOrigin,
  idempotent(sparePartController.activate),
)
sparePartRoutes.post(
  '/:repuestoId/desactivar',
  enforceAllowedOrigin,
  idempotent(sparePartController.deactivate),
)
sparePartRoutes.post(
  '/:repuestoId/entradas',
  enforceAllowedOrigin,
  idempotent(sparePartController.registerEntry),
)
sparePartRoutes.post(
  '/:repuestoId/ajustes',
  enforceAllowedOrigin,
  idempotent(sparePartController.registerAdjustment),
)
sparePartRoutes.get('/:repuestoId/movimientos', asyncHandler(sparePartController.listPartMovements))
sparePartRoutes.get('/:repuestoId/compatibilidades', asyncHandler(compatibilityController.list))
sparePartRoutes.post(
  '/:repuestoId/compatibilidades',
  enforceAllowedOrigin,
  idempotent(compatibilityController.create),
)
sparePartRoutes.post(
  '/:repuestoId/compatibilidades/:compatibilidadId/inactivar',
  enforceAllowedOrigin,
  idempotent(compatibilityController.deactivate),
)
sparePartRoutes.patch('/:repuestoId', enforceAllowedOrigin, idempotent(sparePartController.update))
sparePartRoutes.get('/:repuestoId', asyncHandler(sparePartController.getById))

inventoryRoutes.use(authenticate)
inventoryRoutes.use(authorizeRoles('ADMINISTRADOR'))
inventoryRoutes.get('/movimientos', asyncHandler(sparePartController.listMovements))

export { inventoryRoutes, sparePartRoutes }
