import type { AuthenticatedUser } from '../auth/auth.types.js'

declare global {
  namespace Express {
    interface Request {
      id: string
      user?: AuthenticatedUser
    }
  }
}

export {}
