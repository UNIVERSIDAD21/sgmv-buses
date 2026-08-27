import { prisma } from '../prisma/client.js'

const authUserInclude = {
  rol: {
    select: {
      codigo: true,
      nombre: true,
    },
  },
} as const

export type AuthUserRecord = Awaited<ReturnType<AuthRepository['findByEmailForAuth']>>

export class AuthRepository {
  findByEmailForAuth(email: string) {
    return prisma.usuario.findUnique({
      where: { email },
      include: authUserInclude,
    })
  }

  findByIdForSession(id: string) {
    return prisma.usuario.findUnique({
      where: { id },
      include: authUserInclude,
    })
  }

  async registerFailedLogin(userId: string, failedAttempts: number, blockedUntil: Date | null) {
    await prisma.usuario.update({
      where: { id: userId },
      data: {
        bloqueadoHasta: blockedUntil,
        intentosFallidosLogin: failedAttempts,
      },
    })
  }

  async registerSuccessfulLogin(userId: string) {
    await prisma.usuario.update({
      where: { id: userId },
      data: {
        bloqueadoHasta: null,
        intentosFallidosLogin: 0,
        ultimoAccesoAt: new Date(),
      },
    })
  }
}
