import { Router } from 'express'

import { authenticate, authorizeRoles, enforceAllowedOrigin } from '../auth/auth.middleware.js'
import { asyncHandler } from '../shared/http.js'
import { NoveltyController } from './novelty.controller.js'

const noveltyController = new NoveltyController()
const noveltyRoutes = Router()

noveltyRoutes.use(authenticate)

noveltyRoutes.get(
  '/resumen',
  authorizeRoles('ADMINISTRADOR'),
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
  asyncHandler(noveltyController.createNovelty),
)
noveltyRoutes.get(
  '/',
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(noveltyController.listAdminNovelties),
)
noveltyRoutes.get(
  '/:novedadId',
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(noveltyController.getAdminNovelty),
)
noveltyRoutes.post(
  '/:novedadId/revision',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(noveltyController.reviewNovelty),
)
noveltyRoutes.post(
  '/:novedadId/convertir-orden',
  enforceAllowedOrigin,
  authorizeRoles('ADMINISTRADOR'),
  asyncHandler(noveltyController.convertToCorrectiveOrder),
)

export { noveltyRoutes }
