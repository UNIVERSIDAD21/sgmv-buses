import { createHash, randomUUID } from 'node:crypto'

import { PrismaClient, type RolCodigo } from '@prisma/client'
import { compare, hash } from 'bcryptjs'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createApp } from '../src/app.js'
import { UserService } from '../src/users/user.service.js'
import { createCsrfAgent } from './http-test-client.js'

const prisma = new PrismaClient()
const app = createApp()
const initialPassword = 'Clave-Segura-Inicial-2026!'
const activatedPassword = 'Clave-Activada-Segura-2026!'
const changedPassword = 'Clave-Actualizada-Segura-2026!'
const suffix = randomUUID().slice(0, 8)
const createdUserIds: number[] = []

async function createActiveUser(roleCode: RolCodigo, label: string) {
  const role = await prisma.rol.findUniqueOrThrow({ where: { codigo: roleCode } })
  const user = await prisma.usuario.create({
    data: {
      contrasenaHash: await hash(initialPassword, 10),
      email: `usuarios-${label}-${suffix}@test.sgmv.local`,
      nombre: `Usuarios ${label}`,
      rolId: role.id,
    },
  })
  createdUserIds.push(user.id)
  return user
}

async function authenticatedAgent(email: string) {
  const agent = await createCsrfAgent(app)
  await agent.post('/auth/login').send({ contrasena: initialPassword, email }).expect(200)
  return agent
}

function expectSanitized(body: unknown) {
  const serialized = JSON.stringify(body)
  expect(serialized).not.toContain('contrasenaHash')
  expect(serialized).not.toContain('tokenHash')
  expect(serialized).not.toContain('intentosFallidosLogin')
}

describe('Gestion administrativa y activacion de usuarios', () => {
  let admin: Awaited<ReturnType<typeof createActiveUser>>
  let conductor: Awaited<ReturnType<typeof createActiveUser>>
  let adminAgent: Awaited<ReturnType<typeof createCsrfAgent>>
  let conductorAgent: Awaited<ReturnType<typeof createCsrfAgent>>
  let managedUserId: number
  let managedEmail: string
  let activationToken: string

  beforeAll(async () => {
    admin = await createActiveUser('ADMINISTRADOR', 'admin')
    conductor = await createActiveUser('CONDUCTOR', 'conductor')
    adminAgent = await authenticatedAgent(admin.email)
    conductorAgent = await authenticatedAgent(conductor.email)
  }, 60_000)

  afterAll(async () => {
    try {
      await prisma.tokenActivacionCuenta.deleteMany({
        where: {
          OR: [{ usuarioId: { in: createdUserIds } }, { creadoPorId: { in: createdUserIds } }],
        },
      })
      await prisma.usuario.deleteMany({ where: { id: { in: createdUserIds } } })
    } finally {
      await prisma.$disconnect()
    }
  }, 60_000)

  it('no expone registro publico', async () => {
    await request(app).get('/register').expect(404)
    await request(app).post('/register').send({}).expect(403)
    await request(app).post('/auth/register').send({}).expect(403)
  })

  it('permite al administrador crear una cuenta pendiente con rol canonico e ID Int', async () => {
    managedEmail = `nuevo-conductor-${suffix}@test.sgmv.local`
    const response = await adminAgent
      .post('/usuarios')
      .send({
        email: managedEmail,
        nombre: 'Nuevo Conductor Seguro',
        rol: 'CONDUCTOR',
        telefono: '3001234567',
      })
      .expect(201)

    managedUserId = response.body.data.usuario.id as number
    activationToken = response.body.data.activacion.token as string
    createdUserIds.push(managedUserId)

    expect(Number.isInteger(managedUserId)).toBe(true)
    expect(response.body.data.usuario).toMatchObject({
      email: managedEmail,
      estado: 'PENDIENTE_ACTIVACION',
      rol: { codigo: 'CONDUCTOR' },
    })
    expect(activationToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expectSanitized(response.body)

    const stored = await prisma.usuario.findUniqueOrThrow({ where: { id: managedUserId } })
    const storedToken = await prisma.tokenActivacionCuenta.findFirstOrThrow({
      where: { usuarioId: managedUserId },
    })
    expect(stored.contrasenaHash).toBeNull()
    expect(storedToken.tokenHash).toBe(createHash('sha256').update(activationToken).digest('hex'))
    expect(storedToken.tokenHash).not.toBe(activationToken)
  })

  it('rechaza correo duplicado y no crea cuentas anonimas', async () => {
    await adminAgent
      .post('/usuarios')
      .send({ email: managedEmail, nombre: 'Duplicado', rol: 'CONDUCTOR' })
      .expect(409)
    await request(app)
      .post('/usuarios')
      .send({ email: `anonimo-${suffix}@test.sgmv.local`, nombre: 'Anonimo', rol: 'ADMINISTRADOR' })
      .expect(403)
  })

  it('impide que roles no administrativos creen cuentas o asignen ADMINISTRADOR', async () => {
    const response = await conductorAgent
      .post('/usuarios')
      .send({
        email: `escalamiento-${suffix}@test.sgmv.local`,
        nombre: 'Escalamiento',
        rol: 'ADMINISTRADOR',
      })
      .expect(403)
    expect(response.body.error.code).toBe('FORBIDDEN')
  })

  it('lista, busca y filtra sin exponer secretos', async () => {
    const response = await adminAgent
      .get(`/usuarios?busqueda=nuevo-conductor-${suffix}&rol=CONDUCTOR&estado=PENDIENTE_ACTIVACION`)
      .expect(200)
    expect(response.body.data.items).toHaveLength(1)
    expect(response.body.data.items[0].id).toBe(managedUserId)
    expectSanitized(response.body)

    const detail = await adminAgent.get(`/usuarios/${managedUserId}`).expect(200)
    expect(detail.body.data.id).toBe(managedUserId)
    expectSanitized(detail.body)
    expect(JSON.stringify(detail.body)).not.toContain(activationToken)
  })

  it('permite editar solo datos administrativos basicos', async () => {
    const response = await adminAgent
      .patch(`/usuarios/${managedUserId}`)
      .send({ nombre: 'Conductor Actualizado', telefono: null })
      .expect(200)
    expect(response.body.data).toMatchObject({ nombre: 'Conductor Actualizado', telefono: null })
  })

  it('rechaza IDs invalidos antes de consultar la base', async () => {
    for (const invalidId of ['0', '-1', '1.5', 'abc', '2147483648']) {
      await adminAgent.get(`/usuarios/${invalidId}`).expect(400)
    }
  })

  it('impide acceso directo de no administradores al listado, detalle, rol y estado', async () => {
    await conductorAgent.get('/usuarios').expect(403)
    await conductorAgent.get(`/usuarios/${managedUserId}`).expect(403)
    await conductorAgent
      .patch(`/usuarios/${managedUserId}/rol`)
      .send({ rol: 'ADMINISTRADOR' })
      .expect(403)
    await conductorAgent
      .patch(`/usuarios/${managedUserId}/estado`)
      .send({ estado: 'ACTIVO' })
      .expect(403)
  })

  it('rechaza login de una cuenta pendiente con respuesta controlada', async () => {
    const agent = await createCsrfAgent(app)
    const response = await agent
      .post('/auth/login')
      .send({ contrasena: activatedPassword, email: managedEmail })
      .expect(403)
    expect(response.body.error.code).toBe('FORBIDDEN')
  })

  it('rechaza token de activacion invalido', async () => {
    const agent = await createCsrfAgent(app)
    await agent
      .post('/auth/activar')
      .send({ contrasena: activatedPassword, token: 'a'.repeat(43) })
      .expect(400)
  })

  it('rechaza token de activacion expirado', async () => {
    const email = `expirado-${suffix}@test.sgmv.local`
    const created = await adminAgent
      .post('/usuarios')
      .send({ email, nombre: 'Token Expirado', rol: 'MECANICO' })
      .expect(201)
    const userId = created.body.data.usuario.id as number
    createdUserIds.push(userId)
    await prisma.tokenActivacionCuenta.updateMany({
      data: {
        createdAt: new Date(Date.now() - 7_200_000),
        expiraAt: new Date(Date.now() - 3_600_000),
      },
      where: { usuarioId: userId },
    })
    const agent = await createCsrfAgent(app)
    await agent
      .post('/auth/activar')
      .send({ contrasena: activatedPassword, token: created.body.data.activacion.token })
      .expect(400)
  })

  it('activa una cuenta valida y conserva el rol asignado por el administrador', async () => {
    const agent = await createCsrfAgent(app)
    const response = await agent
      .post('/auth/activar')
      .send({ contrasena: activatedPassword, token: activationToken })
      .expect(200)
    expect(response.body.data.user).toMatchObject({
      email: managedEmail,
      estado: 'ACTIVO',
      rol: { codigo: 'CONDUCTOR' },
    })
    expectSanitized(response.body)
  })

  it('invalida el token despues del primer uso', async () => {
    const agent = await createCsrfAgent(app)
    await agent
      .post('/auth/activar')
      .send({ contrasena: activatedPassword, token: activationToken })
      .expect(400)
  })

  it('almacena la contrasena activada solo como hash bcrypt', async () => {
    const stored = await prisma.usuario.findUniqueOrThrow({ where: { id: managedUserId } })
    expect(stored.contrasenaHash).toMatch(/^\$2[aby]\$/)
    expect(stored.contrasenaHash).not.toBe(activatedPassword)
    expect(await compare(activatedPassword, stored.contrasenaHash!)).toBe(true)
  })

  it('permite login normal despues de activar', async () => {
    const agent = await createCsrfAgent(app)
    await agent
      .post('/auth/login')
      .send({ contrasena: activatedPassword, email: managedEmail })
      .expect(200)
  })

  it('impide al administrador cambiar su propio rol o estado', async () => {
    await adminAgent.patch(`/usuarios/${admin.id}/rol`).send({ rol: 'CONDUCTOR' }).expect(409)
    await adminAgent.patch(`/usuarios/${admin.id}/estado`).send({ estado: 'INACTIVO' }).expect(409)
  })

  it('permite cambiar rol de terceros solo al administrador', async () => {
    const response = await adminAgent
      .patch(`/usuarios/${managedUserId}/rol`)
      .send({ rol: 'MECANICO' })
      .expect(200)
    expect(response.body.data.rol.codigo).toBe('MECANICO')
  })

  it('bloquea, desbloquea, inactiva y reactiva sin borrar historia', async () => {
    await adminAgent
      .patch(`/usuarios/${managedUserId}/estado`)
      .send({ estado: 'BLOQUEADO' })
      .expect(200)
    let agent = await createCsrfAgent(app)
    await agent
      .post('/auth/login')
      .send({ contrasena: activatedPassword, email: managedEmail })
      .expect(403)

    await adminAgent
      .patch(`/usuarios/${managedUserId}/estado`)
      .send({ estado: 'ACTIVO' })
      .expect(200)
    await adminAgent
      .patch(`/usuarios/${managedUserId}/estado`)
      .send({ estado: 'INACTIVO' })
      .expect(200)
    agent = await createCsrfAgent(app)
    await agent
      .post('/auth/login')
      .send({ contrasena: activatedPassword, email: managedEmail })
      .expect(403)

    const response = await adminAgent
      .patch(`/usuarios/${managedUserId}/estado`)
      .send({ estado: 'ACTIVO' })
      .expect(200)
    expect(response.body.data.id).toBe(managedUserId)
  })

  it('permite cambiar la propia contrasena verificando la anterior', async () => {
    const agent = await createCsrfAgent(app)
    await agent
      .post('/auth/login')
      .send({ contrasena: activatedPassword, email: managedEmail })
      .expect(200)
    await agent
      .post('/auth/cambiar-contrasena')
      .send({ contrasenaActual: 'incorrecta', contrasenaNueva: changedPassword })
      .expect(400)
    await agent
      .post('/auth/cambiar-contrasena')
      .send({ contrasenaActual: activatedPassword, contrasenaNueva: changedPassword })
      .expect(200)

    const login = await createCsrfAgent(app)
    await login
      .post('/auth/login')
      .send({ contrasena: changedPassword, email: managedEmail })
      .expect(200)
  })

  it('protege al ultimo administrador activo incluso desde el servicio transaccional', async () => {
    const activeAdmins = await prisma.usuario.findMany({
      select: { id: true },
      where: { estado: 'ACTIVO', rol: { codigo: 'ADMINISTRADOR' } },
    })
    const protectedAdmin = activeAdmins.find((item) => item.id !== admin.id) ?? admin
    const disabledIds = activeAdmins
      .filter((item) => item.id !== protectedAdmin.id)
      .map((item) => item.id)
    const service = new UserService()

    try {
      await prisma.usuario.updateMany({
        data: { estado: 'INACTIVO' },
        where: { id: { in: disabledIds } },
      })
      await expect(
        service.changeRole(
          protectedAdmin.id,
          { rol: 'CONDUCTOR' },
          {
            email: admin.email,
            estado: 'ACTIVO',
            id: admin.id,
            nombre: admin.nombre,
            rol: { codigo: 'ADMINISTRADOR', nombre: 'Administrador' },
          },
        ),
      ).rejects.toMatchObject({ code: 'LAST_ACTIVE_ADMINISTRATOR' })
    } finally {
      await prisma.usuario.updateMany({
        data: { estado: 'ACTIVO' },
        where: { id: { in: disabledIds } },
      })
    }
  })

  it('deja trazabilidad de mutaciones sin almacenar token ni contrasena', async () => {
    const response = await adminAgent
      .patch(`/usuarios/${managedUserId}`)
      .send({ telefono: '3017654321' })
      .expect(200)
    const requestId = response.headers['x-request-id'] as string

    await expect
      .poll(() => prisma.eventoAuditoria.findFirst({ where: { requestId } }), { timeout: 5_000 })
      .toMatchObject({ actorId: admin.id, resultado: 'EXITO', ruta: `/usuarios/${managedUserId}` })
    const audit = await prisma.eventoAuditoria.findFirstOrThrow({ where: { requestId } })
    const serialized = JSON.stringify(audit)
    expect(serialized).not.toContain(activationToken)
    expect(serialized).not.toContain(changedPassword)
  })
})
