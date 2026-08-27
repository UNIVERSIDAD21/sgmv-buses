import { Router } from 'express'

import { authenticate, authorizeRoles, enforceAllowedOrigin } from '../auth/auth.middleware.js'
import { asyncHandler } from '../shared/http.js'
import { NoveltyController } from './novelty.controller.js'

const noveltyController = new NoveltyController()
const noveltyRoutes = Router()

noveltyRoutes.use(authenticate)

noveltyRoutes.get(
  '/resumen',
  authorizeRoles('ADMIN_SUPERVISOR'),
  asyncHandler(noveltyController.summarize),
)
noveltyRoutes.get(
  '/mis-novedades',
  authorizeRoles('CONDUCTOR_OPERADOR'),
  asyncHandler(noveltyController.listOwnNovelties),
)
noveltyRoutes.get(
  '/mis-novedades/:novedadId',
  authorizeRoles('CONDUCTOR_OPERADOR'),
  asyncHandler(noveltyController.getOwnNovelty),
)
noveltyRoutes.post(
  '/',
  enforceAllowedOrigin,
  authorizeRoles('CONDUCTOR_OPERADOR'),
  asyncHandler(noveltyController.createNovelty),
)
noveltyRoutes.get(
  '/',
  authorizeRoles('ADMIN_SUPERVISOR'),
  asyncHandler(noveltyController.listAdminNovelties),
)
noveltyRoutes.get(
  '/:novedadId',
  authorizeRoles('ADMIN_SUPERVISOR'),
  asyncHandler(noveltyController.getAdminNovelty),
)
noveltyRoutes.post(
  '/:novedadId/revision',
  enforceAllowedOrigin,
  authorizeRoles('ADMIN_SUPERVISOR'),
  asyncHandler(noveltyController.reviewNovelty),
)
noveltyRoutes.post(
  '/:novedadId/convertir-orden',
  enforceAllowedOrigin,
  authorizeRoles('ADMIN_SUPERVISOR'),
  asyncHandler(noveltyController.convertToCorrectiveOrder),
)

export { noveltyRoutes }
