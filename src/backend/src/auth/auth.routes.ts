import { Router } from 'express'

import { asyncHandler } from '../shared/http.js'
import { AuthController } from './auth.controller.js'
import { authenticate, enforceAllowedOrigin } from './auth.middleware.js'

const authController = new AuthController()
const authRoutes = Router()

authRoutes.post('/login', enforceAllowedOrigin, asyncHandler(authController.login))
authRoutes.get('/me', authenticate, asyncHandler(authController.me))
authRoutes.post('/logout', enforceAllowedOrigin, asyncHandler(authController.logout))

export { authRoutes }
