import { Router } from 'express'

import { authenticate, authorizeRoles, enforceAllowedOrigin } from '../auth/auth.middleware.js'
import { asyncHandler } from '../shared/http.js'
import { UserController } from './user.controller.js'

const controller = new UserController()
const userRoutes = Router()

userRoutes.use(authenticate, authorizeRoles('ADMINISTRADOR'))
userRoutes.get('/', asyncHandler(controller.list))
userRoutes.post('/', enforceAllowedOrigin, asyncHandler(controller.create))
userRoutes.get('/:usuarioId', asyncHandler(controller.get))
userRoutes.patch('/:usuarioId', enforceAllowedOrigin, asyncHandler(controller.update))
userRoutes.patch('/:usuarioId/rol', enforceAllowedOrigin, asyncHandler(controller.changeRole))
userRoutes.patch('/:usuarioId/estado', enforceAllowedOrigin, asyncHandler(controller.changeState))
userRoutes.post(
  '/:usuarioId/activacion',
  enforceAllowedOrigin,
  asyncHandler(controller.reissueActivation),
)

export { userRoutes }
