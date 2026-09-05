import { Router } from 'express'

import { authenticate, authorizeRoles, enforceAllowedOrigin } from '../auth/auth.middleware.js'
import { idempotent } from '../idempotency/idempotency.middleware.js'
import { asyncHandler } from '../shared/http.js'
import { NoveltyController } from './novelty.controller.js'

const noveltyController = new NoveltyController()
const noveltyRoutes = Router()

noveltyRoutes.use(authenticate)

noveltyRoutes.get(
  '/resumen',
  authorizeRoles('ADMINISTRADOR', 'DESPACHADOR'),
  asyncHandler(noveltyController.summarize),
)
noveltyRoutes.get(
  '/mis-novedades',
  authorizeRoles('CONDUCTOR'),
  asyncHandler(noveltyController.listOwnNovelties),
)
noveltyRoutes.get(
  '/mis-novedades/:novedadId',
  authorizeRoles('CONDUCTOR'),
  asyncHandler(noveltyController.getOwnNovelty),
)
noveltyRoutes.post(
  '/',
  enforceAllowedOrigin,
  authorizeRoles('CONDUCTOR'),
  idempotent(noveltyController.createNovelty),
)
noveltyRoutes.get(
  '/',
  authorizeRoles('ADMINISTRADOR', 'DESPACHADOR'),
  asyncHandler(noveltyController.listAdminNovelties),
)
noveltyRoutes.get(
  '/:novedadId',
  authorizeRoles('ADMINISTRADOR', 'DESPACHADOR'),
  asyncHandler(noveltyController.getAdminNovelty),
)
noveltyRoutes.post(
  '/:novedadId/revision',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  idempotent(noveltyController.reviewNovelty),
)
noveltyRoutes.post(
  '/:novedadId/convertir-orden',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  idempotent(noveltyController.convertToCorrectiveOrder),
)

export { noveltyRoutes }
