import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

import { Prisma, PrismaClient } from '@prisma/client'
import { config } from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const currentDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(currentDir, '../../..')

config({ path: resolve(repoRoot, '.env') })

const prisma = new PrismaClient()
const describeDb = process.env.DATABASE_URL ? describe : describe.skip

const created = {
  actividades: [] as string[],
  asignaciones: [] as string[],
  buses: [] as string[],
  consumos: [] as string[],
  intervenciones: [] as string[],
  movimientos: [] as string[],
  novedades: [] as string[],
  ordenes: [] as string[],
  programaciones: [] as string[],
  repuestos: [] as string[],
  usuarios: [] as string[],
}

function track(bucket: keyof typeof created) {
  const id = randomUUID()
  created[bucket].push(id)
  return id
}

async function ensureRoles() {
  const [admin, mecanico, conductor] = await Promise.all([
    prisma.rol.upsert({
      where: { codigo: 'ADMIN_SUPERVISOR' },
      update: {},
      create: {
        codigo: 'ADMIN_SUPERVISOR',
        nombre: 'Administrador / Supervisor',
      },
    }),
    prisma.rol.upsert({
      where: { codigo: 'MECANICO' },
      update: {},
      create: {
        codigo: 'MECANICO',
        nombre: 'Personal Tecnico / Mecanico',
      },
    }),
    prisma.rol.upsert({
      where: { codigo: 'CONDUCTOR_OPERADOR' },
      update: {},
      create: {
        codigo: 'CONDUCTOR_OPERADOR',
        nombre: 'Conductor / Operador',
      },
    }),
  ])

  return { admin, conductor, mecanico }
}

async function createCore(label: string) {
  const roles = await ensureRoles()
  const shortId = randomUUID().replaceAll('-', '').slice(0, 8)
  const suffix = `${label}-${shortId}`
  const adminId = track('usuarios')
  const mecanicoId = track('usuarios')
  const conductorId = track('usuarios')
  const segundoConductorId = track('usuarios')
  const busId = track('buses')
  const segundoBusId = track('buses')

  await prisma.usuario.createMany({
    data: [
      {
        id: adminId,
        nombre: `Supervisor ${suffix}`,
        email: `supervisor-${suffix}@test.sgmv.local`,
        contrasenaHash: 'hash-demo-no-real',
        rolId: roles.admin.id,
      },
      {
        id: mecanicoId,
        nombre: `Mecanico ${suffix}`,
        email: `mecanico-${suffix}@test.sgmv.local`,
        contrasenaHash: 'hash-demo-no-real',
        rolId: roles.mecanico.id,
      },
      {
        id: conductorId,
        nombre: `Conductor ${suffix}`,
        email: `conductor-${suffix}@test.sgmv.local`,
        contrasenaHash: 'hash-demo-no-real',
        rolId: roles.conductor.id,
      },
      {
        id: segundoConductorId,
        nombre: `Conductor alterno ${suffix}`,
        email: `conductor-alt-${suffix}@test.sgmv.local`,
        contrasenaHash: 'hash-demo-no-real',
        rolId: roles.conductor.id,
      },
    ],
  })

  await prisma.bus.createMany({
    data: [
      {
        id: busId,
        codigoInterno: `TEST-BUS-${suffix}-1`,
        placa: `T${shortId.slice(0, 7)}1`.toUpperCase(),
        marca: 'Marca Test',
        modelo: 'Modelo Test',
        anio: 2020,
        kilometrajeActual: 10000,
      },
      {
        id: segundoBusId,
        codigoInterno: `TEST-BUS-${suffix}-2`,
        placa: `T${shortId.slice(0, 7)}2`.toUpperCase(),
        marca: 'Marca Test',
        modelo: 'Modelo Test',
        anio: 2021,
        kilometrajeActual: 12000,
      },
    ],
  })

  return {
    adminId,
    busId,
    conductorId,
    mecanicoId,
    segundoBusId,
    segundoConductorId,
  }
}

async function cleanup() {
  await prisma.movimientoInventario.deleteMany({ where: { id: { in: created.movimientos } } })
  await prisma.consumoRepuesto.deleteMany({ where: { id: { in: created.consumos } } })
  await prisma.actividadOrden.deleteMany({ where: { id: { in: created.actividades } } })
  await prisma.intervencion.deleteMany({ where: { id: { in: created.intervenciones } } })
  await prisma.ordenTrabajo.deleteMany({ where: { id: { in: created.ordenes } } })
  await prisma.novedad.deleteMany({ where: { id: { in: created.novedades } } })
  await prisma.programacionMantenimiento.deleteMany({
    where: { id: { in: created.programaciones } },
  })
  await prisma.asignacionConductor.deleteMany({ where: { id: { in: created.asignaciones } } })
  await prisma.repuesto.deleteMany({ where: { id: { in: created.repuestos } } })
  await prisma.bus.deleteMany({ where: { id: { in: created.buses } } })
  await prisma.usuario.deleteMany({ where: { id: { in: created.usuarios } } })
}

describeDb('Prisma persistence integrity', () => {
  beforeAll(async () => {
    await ensureRoles()
  }, 60000)

  afterAll(async () => {
    try {
      await cleanup()
    } finally {
      await prisma.$disconnect()
    }
  }, 60000)

  it('enforces one active bus assignment per driver and per bus', async () => {
    const core = await createCore('assignment')
    const firstAssignmentId = track('asignaciones')
    const duplicateDriverAssignmentId = track('asignaciones')
    const duplicateBusAssignmentId = track('asignaciones')
    const reassignmentId = track('asignaciones')

    await prisma.asignacionConductor.create({
      data: {
        id: firstAssignmentId,
        conductorId: core.conductorId,
        busId: core.busId,
        asignadoPorId: core.adminId,
        activa: true,
      },
    })

    await expect(
      prisma.asignacionConductor.create({
        data: {
          id: duplicateDriverAssignmentId,
          conductorId: core.conductorId,
          busId: core.segundoBusId,
          asignadoPorId: core.adminId,
          activa: true,
        },
      }),
    ).rejects.toBeTruthy()

    await expect(
      prisma.asignacionConductor.create({
        data: {
          id: duplicateBusAssignmentId,
          conductorId: core.segundoConductorId,
          busId: core.busId,
          asignadoPorId: core.adminId,
          activa: true,
        },
      }),
    ).rejects.toBeTruthy()

    await prisma.asignacionConductor.update({
      where: { id: firstAssignmentId },
      data: {
        activa: false,
        fechaFin: new Date(),
      },
    })

    const reassignment = await prisma.asignacionConductor.create({
      data: {
        id: reassignmentId,
        conductorId: core.conductorId,
        busId: core.segundoBusId,
        asignadoPorId: core.adminId,
        activa: true,
      },
    })

    expect(reassignment.activa).toBe(true)
  }, 60000)

  it('keeps novelty-origin orders unique and origin-consistent', async () => {
    const core = await createCore('novelty')
    const novedadId = track('novedades')
    const ordenId = track('ordenes')
    const duplicateOrdenId = track('ordenes')
    const invalidOrdenId = track('ordenes')

    await prisma.novedad.create({
      data: {
        id: novedadId,
        conductorId: core.conductorId,
        busId: core.busId,
        tipo: 'Falla reportada',
        descripcion: 'Ruido en el sistema de frenos.',
      },
    })

    await prisma.ordenTrabajo.create({
      data: {
        id: ordenId,
        codigo: `OT-TEST-NOV-${randomUUID().slice(0, 8)}`,
        busId: core.busId,
        tipo: 'CORRECTIVA',
        origen: 'NOVEDAD',
        descripcion: 'Orden correctiva creada desde novedad.',
        estado: 'PENDIENTE_ASIGNACION',
        creadaPorId: core.adminId,
        novedadId,
      },
    })

    await expect(
      prisma.ordenTrabajo.create({
        data: {
          id: duplicateOrdenId,
          codigo: `OT-TEST-NOV-DUP-${randomUUID().slice(0, 8)}`,
          busId: core.busId,
          tipo: 'CORRECTIVA',
          origen: 'NOVEDAD',
          descripcion: 'Orden duplicada no permitida.',
          estado: 'PENDIENTE_ASIGNACION',
          creadaPorId: core.adminId,
          novedadId,
        },
      }),
    ).rejects.toBeTruthy()

    await expect(
      prisma.ordenTrabajo.create({
        data: {
          id: invalidOrdenId,
          codigo: `OT-TEST-NOV-INV-${randomUUID().slice(0, 8)}`,
          busId: core.busId,
          tipo: 'CORRECTIVA',
          origen: 'NOVEDAD',
          descripcion: 'Orden con origen novedad sin novedad relacionada.',
          estado: 'PENDIENTE_ASIGNACION',
          creadaPorId: core.adminId,
        },
      }),
    ).rejects.toBeTruthy()
  }, 60000)

  it('allows historical preventive orders but only one active per schedule', async () => {
    const core = await createCore('preventive')
    const programacionId = track('programaciones')
    const primeraOrdenId = track('ordenes')
    const duplicateOrdenId = track('ordenes')
    const segundaOrdenId = track('ordenes')
    const fechaObjetivo = new Date(Date.UTC(2026, 8, 5))

    await prisma.programacionMantenimiento.create({
      data: {
        id: programacionId,
        busId: core.busId,
        tipo: 'Revision preventiva',
        actividad: 'Revision por kilometraje y fecha.',
        criterio: 'FECHA_KILOMETRAJE',
        fechaProgramada: fechaObjetivo,
        kilometrajeObjetivo: 10500,
        creadaPorId: core.adminId,
      },
    })

    await prisma.ordenTrabajo.create({
      data: {
        id: primeraOrdenId,
        codigo: `OT-TEST-PREV-${randomUUID().slice(0, 8)}`,
        busId: core.busId,
        tipo: 'PREVENTIVA',
        origen: 'PREVENTIVO',
        descripcion: 'Primera orden preventiva activa.',
        estado: 'PENDIENTE_ASIGNACION',
        creadaPorId: core.adminId,
        programacionMantenimientoId: programacionId,
        fechaObjetivoPreventivo: fechaObjetivo,
        kilometrajeObjetivoPreventivo: 10500,
      },
    })

    await expect(
      prisma.ordenTrabajo.create({
        data: {
          id: duplicateOrdenId,
          codigo: `OT-TEST-PREV-DUP-${randomUUID().slice(0, 8)}`,
          busId: core.busId,
          tipo: 'PREVENTIVA',
          origen: 'PREVENTIVO',
          descripcion: 'Segunda orden preventiva activa no permitida.',
          estado: 'PENDIENTE_ASIGNACION',
          creadaPorId: core.adminId,
          programacionMantenimientoId: programacionId,
          fechaObjetivoPreventivo: fechaObjetivo,
          kilometrajeObjetivoPreventivo: 10500,
        },
      }),
    ).rejects.toBeTruthy()

    await prisma.ordenTrabajo.update({
      where: { id: primeraOrdenId },
      data: {
        estado: 'CERRADA',
        tecnicoAsignadoId: core.mecanicoId,
        fechaInicioEjecucion: new Date(),
        fechaCompletadaTecnico: new Date(),
        fechaCierre: new Date(),
        cerradaPorId: core.adminId,
      },
    })

    const segundaOrden = await prisma.ordenTrabajo.create({
      data: {
        id: segundaOrdenId,
        codigo: `OT-TEST-PREV-HIST-${randomUUID().slice(0, 8)}`,
        busId: core.busId,
        tipo: 'PREVENTIVA',
        origen: 'PREVENTIVO',
        descripcion: 'Nueva orden preventiva tras cierre historico.',
        estado: 'ASIGNADA',
        tecnicoAsignadoId: core.mecanicoId,
        creadaPorId: core.adminId,
        programacionMantenimientoId: programacionId,
        fechaObjetivoPreventivo: fechaObjetivo,
        kilometrajeObjetivoPreventivo: 10500,
      },
    })

    expect(segundaOrden.programacionMantenimientoId).toBe(programacionId)
  }, 60000)

  it('links spare-part consumption through ConsumoRepuesto, not directly to work orders', async () => {
    const core = await createCore('inventory')
    const ordenId = track('ordenes')
    const repuestoId = track('repuestos')
    const consumoId = track('consumos')
    const invalidMovimientoId = track('movimientos')
    const movimientoId = track('movimientos')

    await prisma.ordenTrabajo.create({
      data: {
        id: ordenId,
        codigo: `OT-TEST-INV-${randomUUID().slice(0, 8)}`,
        busId: core.busId,
        tipo: 'CORRECTIVA',
        origen: 'CORRECTIVO_DIRECTO',
        descripcion: 'Orden correctiva directa para consumo de repuesto.',
        estado: 'ASIGNADA',
        tecnicoAsignadoId: core.mecanicoId,
        creadaPorId: core.adminId,
      },
    })

    await prisma.repuesto.create({
      data: {
        id: repuestoId,
        codigo: `REP-TEST-${randomUUID().slice(0, 8)}`,
        nombre: 'Repuesto de prueba',
        unidadMedida: 'unidad',
        stockActual: '5',
        stockMinimo: '1',
        costoUnitario: '25000',
      },
    })

    await prisma.consumoRepuesto.create({
      data: {
        id: consumoId,
        ordenTrabajoId: ordenId,
        repuestoId,
        cantidad: '1',
        costoUnitario: '25000',
        subtotal: '25000',
        consumidoPorId: core.mecanicoId,
      },
    })

    await expect(
      prisma.movimientoInventario.create({
        data: {
          id: invalidMovimientoId,
          repuestoId,
          tipo: 'CONSUMO',
          cantidad: '1',
          responsableId: core.mecanicoId,
        },
      }),
    ).rejects.toBeTruthy()

    const movimiento = await prisma.movimientoInventario.create({
      data: {
        id: movimientoId,
        repuestoId,
        tipo: 'CONSUMO',
        cantidad: '1',
        responsableId: core.mecanicoId,
        consumoRepuestoId: consumoId,
      },
      include: {
        consumoRepuesto: {
          include: {
            ordenTrabajo: true,
            repuesto: true,
          },
        },
      },
    })

    expect(movimiento.consumoRepuesto?.ordenTrabajo.id).toBe(ordenId)
    expect(movimiento.consumoRepuesto?.repuesto.id).toBe(repuestoId)
    expect(Object.values(Prisma.MovimientoInventarioScalarFieldEnum) as string[]).not.toContain(
      'ordenTrabajoId',
    )
    expect(Object.values(Prisma.OrdenTrabajoScalarFieldEnum) as string[]).not.toContain(
      'repuestoId',
    )
  }, 60000)
})
