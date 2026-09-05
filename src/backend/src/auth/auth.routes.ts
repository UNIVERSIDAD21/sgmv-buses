import { Router } from 'express'

import { asyncHandler } from '../shared/http.js'
import { limitLoginAttempts } from '../security/rate-limit.middleware.js'
import { AuthController } from './auth.controller.js'
import { authenticate, enforceAllowedOrigin } from './auth.middleware.js'

const authController = new AuthController()
const authRoutes = Router()

authRoutes.get('/csrf', authController.csrf)
authRoutes.post(
  '/login',
  enforceAllowedOrigin,
  limitLoginAttempts,
  asyncHandler(authController.login),
)
authRoutes.get('/me', authenticate, asyncHandler(authController.me))
authRoutes.post('/logout', enforceAllowedOrigin, authenticate, asyncHandler(authController.logout))

export { authRoutes }
