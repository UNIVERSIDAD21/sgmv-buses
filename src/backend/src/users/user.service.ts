import { createHash, randomBytes } from 'node:crypto'

import { Prisma, type EstadoUsuario, type RolCodigo } from '@prisma/client'
import { compare, hash } from 'bcryptjs'

import type { AuthenticatedUser } from '../auth/auth.types.js'
import { env } from '../config/env.js'
import { prisma } from '../prisma/client.js'
import { AppError } from '../shared/http.js'
import type {
  ChangeUserRoleInput,
  ChangeUserStateInput,
  CreateUserInput,
  ListUsersQuery,
  UpdateUserInput,
} from './user.schemas.js'
import { safeUserSelect, UserRepository } from './user.repository.js'

const ADMINISTRATOR_GUARD_LOCK = 1_397_189_782

function assertAdministrator(actor: AuthenticatedUser) {
  if (actor.rol.codigo !== 'ADMINISTRADOR') {
    throw new AppError(403, 'FORBIDDEN', 'No tiene permisos para administrar usuarios')
  }
}

function activationTokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function createActivationSecret() {
  const token = randomBytes(32).toString('base64url')
  return { token, tokenHash: activationTokenHash(token) }
}

function activationError() {
  return new AppError(400, 'INVALID_ACTIVATION_TOKEN', 'El codigo de activacion no es valido')
}

function handleUniqueEmail(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new AppError(409, 'EMAIL_ALREADY_EXISTS', 'Ya existe una cuenta con ese correo')
  }

  throw error
}

async function acquireAdministratorGuard(transaction: Prisma.TransactionClient) {
  await transaction.$executeRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`sgmv:usuarios:${ADMINISTRATOR_GUARD_LOCK}`}, 0))`,
  )
}

async function protectLastActiveAdministrator(
  transaction: Prisma.TransactionClient,
  target: { estado: EstadoUsuario; id: number; rol: { codigo: RolCodigo } },
) {
  if (target.estado !== 'ACTIVO' || target.rol.codigo !== 'ADMINISTRADOR') {
    return
  }

  const activeAdministrators = await transaction.usuario.count({
    where: { estado: 'ACTIVO', rol: { codigo: 'ADMINISTRADOR' } },
  })

  if (activeAdministrators <= 1) {
    throw new AppError(
      409,
      'LAST_ACTIVE_ADMINISTRATOR',
      'Debe permanecer al menos un administrador activo',
    )
  }
}

export class UserService {
  constructor(private readonly repository = new UserRepository()) {}

  list(query: ListUsersQuery, actor: AuthenticatedUser) {
    assertAdministrator(actor)
    return this.repository.list(query)
  }

  async get(usuarioId: number, actor: AuthenticatedUser) {
    assertAdministrator(actor)
    const user = await this.repository.findById(usuarioId)

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Usuario no encontrado')
    }

    return user
  }

  async create(input: CreateUserInput, actor: AuthenticatedUser) {
    assertAdministrator(actor)
    const activation = createActivationSecret()
    const expiraAt = new Date(Date.now() + env.ACTIVATION_TOKEN_TTL_MINUTES * 60_000)

    try {
      const user = await prisma.$transaction(async (transaction) => {
        const role = await transaction.rol.findUnique({ where: { codigo: input.rol } })

        if (!role) {
          throw new AppError(400, 'INVALID_ROLE', 'Rol no disponible')
        }

        const created = await transaction.usuario.create({
          data: {
            contrasenaHash: null,
            email: input.email.trim().toLowerCase(),
            estado: 'PENDIENTE_ACTIVACION',
            nombre: input.nombre.trim(),
            rolId: role.id,
            telefono: input.telefono?.trim() ?? null,
          },
          select: safeUserSelect,
        })

        await transaction.tokenActivacionCuenta.create({
          data: {
            creadoPorId: actor.id,
            expiraAt,
            tokenHash: activation.tokenHash,
            usuarioId: created.id,
          },
        })

        return created
      })

      return { activacion: { expiraAt, token: activation.token }, usuario: user }
    } catch (error) {
      handleUniqueEmail(error)
    }
  }

  async update(usuarioId: number, input: UpdateUserInput, actor: AuthenticatedUser) {
    assertAdministrator(actor)

    try {
      const updated = await prisma.usuario.updateMany({
        data: {
          ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}),
          ...(input.nombre !== undefined ? { nombre: input.nombre.trim() } : {}),
          ...(input.telefono !== undefined
            ? { telefono: input.telefono === null ? null : input.telefono.trim() }
            : {}),
        },
        where: { id: usuarioId },
      })

      if (updated.count === 0) {
        throw new AppError(404, 'USER_NOT_FOUND', 'Usuario no encontrado')
      }

      return await this.repository.findById(usuarioId)
    } catch (error) {
      handleUniqueEmail(error)
    }
  }

  async changeRole(usuarioId: number, input: ChangeUserRoleInput, actor: AuthenticatedUser) {
    assertAdministrator(actor)

    if (usuarioId === actor.id) {
      throw new AppError(409, 'SELF_ROLE_CHANGE_FORBIDDEN', 'No puede cambiar su propio rol')
    }

    return prisma.$transaction(async (transaction) => {
      await acquireAdministratorGuard(transaction)
      const target = await transaction.usuario.findUnique({
        select: { estado: true, id: true, rol: { select: { codigo: true } } },
        where: { id: usuarioId },
      })

      if (!target) {
        throw new AppError(404, 'USER_NOT_FOUND', 'Usuario no encontrado')
      }

      if (target.rol.codigo === input.rol) {
        return transaction.usuario.findUniqueOrThrow({
          select: safeUserSelect,
          where: { id: usuarioId },
        })
      }

      if (input.rol !== 'ADMINISTRADOR') {
        await protectLastActiveAdministrator(transaction, target)
      }

      const role = await transaction.rol.findUnique({ where: { codigo: input.rol } })
      if (!role) {
        throw new AppError(400, 'INVALID_ROLE', 'Rol no disponible')
      }

      return transaction.usuario.update({
        data: { rolId: role.id },
        select: safeUserSelect,
        where: { id: usuarioId },
      })
    })
  }

  async changeState(usuarioId: number, input: ChangeUserStateInput, actor: AuthenticatedUser) {
    assertAdministrator(actor)

    if (usuarioId === actor.id) {
      throw new AppError(
        409,
        'SELF_STATE_CHANGE_FORBIDDEN',
        'No puede cambiar el estado de su propia cuenta',
      )
    }

    return prisma.$transaction(async (transaction) => {
      await acquireAdministratorGuard(transaction)
      const target = await transaction.usuario.findUnique({
        select: {
          contrasenaHash: true,
          estado: true,
          id: true,
          rol: { select: { codigo: true } },
        },
        where: { id: usuarioId },
      })

      if (!target) {
        throw new AppError(404, 'USER_NOT_FOUND', 'Usuario no encontrado')
      }

      if (target.estado === input.estado) {
        return transaction.usuario.findUniqueOrThrow({
          select: safeUserSelect,
          where: { id: usuarioId },
        })
      }

      if (input.estado === 'ACTIVO' && !target.contrasenaHash) {
        throw new AppError(
          409,
          'ACTIVATION_REQUIRED',
          'La cuenta debe completar su activacion antes de habilitarse',
        )
      }

      if (input.estado === 'BLOQUEADO' && !target.contrasenaHash) {
        throw new AppError(409, 'ACTIVATION_REQUIRED', 'Una cuenta pendiente no puede bloquearse')
      }

      if (input.estado !== 'ACTIVO') {
        await protectLastActiveAdministrator(transaction, target)
      }

      return transaction.usuario.update({
        data: {
          bloqueadoHasta: null,
          estado: input.estado,
          intentosFallidosLogin: 0,
        },
        select: safeUserSelect,
        where: { id: usuarioId },
      })
    })
  }

  async reissueActivation(usuarioId: number, actor: AuthenticatedUser) {
    assertAdministrator(actor)
    const activation = createActivationSecret()
    const now = new Date()
    const expiraAt = new Date(now.getTime() + env.ACTIVATION_TOKEN_TTL_MINUTES * 60_000)

    const user = await prisma.$transaction(async (transaction) => {
      const target = await transaction.usuario.findUnique({
        select: { contrasenaHash: true, estado: true, id: true },
        where: { id: usuarioId },
      })

      if (!target) {
        throw new AppError(404, 'USER_NOT_FOUND', 'Usuario no encontrado')
      }

      if (target.contrasenaHash || !['PENDIENTE_ACTIVACION', 'INACTIVO'].includes(target.estado)) {
        throw new AppError(409, 'ACCOUNT_ALREADY_ACTIVATED', 'La cuenta ya tiene una contrasena')
      }

      await transaction.tokenActivacionCuenta.updateMany({
        data: { usadoAt: now },
        where: { usadoAt: null, usuarioId },
      })
      await transaction.tokenActivacionCuenta.create({
        data: {
          creadoPorId: actor.id,
          expiraAt,
          tokenHash: activation.tokenHash,
          usuarioId,
        },
      })

      return transaction.usuario.update({
        data: { estado: 'PENDIENTE_ACTIVACION' },
        select: safeUserSelect,
        where: { id: usuarioId },
      })
    })

    return { activacion: { expiraAt, token: activation.token }, usuario: user }
  }

  async activate(token: string, password: string) {
    const now = new Date()
    const tokenHash = activationTokenHash(token)
    const candidate = await prisma.tokenActivacionCuenta.findUnique({
      include: { usuario: { select: { estado: true, id: true } } },
      where: { tokenHash },
    })

    if (
      !candidate ||
      candidate.usadoAt ||
      candidate.expiraAt.getTime() <= now.getTime() ||
      candidate.usuario.estado !== 'PENDIENTE_ACTIVACION'
    ) {
      throw activationError()
    }

    const passwordHash = await hash(password, 12)

    return prisma.$transaction(async (transaction) => {
      const claimed = await transaction.tokenActivacionCuenta.updateMany({
        data: { usadoAt: now },
        where: { expiraAt: { gt: now }, id: candidate.id, usadoAt: null },
      })

      if (claimed.count !== 1) {
        throw activationError()
      }

      await transaction.tokenActivacionCuenta.updateMany({
        data: { usadoAt: now },
        where: { id: { not: candidate.id }, usadoAt: null, usuarioId: candidate.usuarioId },
      })

      const activated = await transaction.usuario.updateMany({
        data: {
          bloqueadoHasta: null,
          contrasenaHash: passwordHash,
          estado: 'ACTIVO',
          intentosFallidosLogin: 0,
        },
        where: { id: candidate.usuarioId, estado: 'PENDIENTE_ACTIVACION' },
      })

      if (activated.count !== 1) {
        throw activationError()
      }

      return transaction.usuario.findUniqueOrThrow({
        select: safeUserSelect,
        where: { id: candidate.usuarioId },
      })
    })
  }

  async changeOwnPassword(actor: AuthenticatedUser, currentPassword: string, newPassword: string) {
    const target = await prisma.usuario.findUnique({ where: { id: actor.id } })

    if (!target?.contrasenaHash || !(await compare(currentPassword, target.contrasenaHash))) {
      throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'La contrasena actual no es valida')
    }

    if (await compare(newPassword, target.contrasenaHash)) {
      throw new AppError(400, 'PASSWORD_REUSE', 'La nueva contrasena debe ser diferente')
    }

    await prisma.usuario.update({
      data: { contrasenaHash: await hash(newPassword, 12) },
      where: { id: actor.id },
    })

    return { ok: true }
  }
}
