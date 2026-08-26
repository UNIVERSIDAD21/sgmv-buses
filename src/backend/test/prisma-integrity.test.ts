import { randomUUID } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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

type CoreFixture = Awaited<ReturnType<typeof createCore>>

function track(bucket: keyof typeof created) {
  const id = randomUUID()
  created[bucket].push(id)
  return id
}

function shortCode() {
  return randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()
}

function code(prefix: string) {
  return `${prefix}-${shortCode()}`
}

function orderedDates() {
  const fechaAsignacion = new Date()
  const fechaInicioEjecucion = new Date(fechaAsignacion.getTime() + 1000)
  const fechaCompletadaTecnico = new Date(fechaAsignacion.getTime() + 2000)
  const fechaCierre = new Date(fechaAsignacion.getTime() + 3000)

  return {
    fechaAsignacion,
    fechaCierre,
    fechaCompletadaTecnico,
    fechaInicioEjecucion,
  }
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
  const unique = shortCode()
  const normalizedLabel = label.toUpperCase().replace(/[^A-Z0-9]+/g, '')
  const emailLabel = label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
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
        nombre: `Supervisor ${label}`,
        email: `supervisor-${emailLabel}-${unique.toLowerCase()}@test.sgmv.local`,
        contrasenaHash: 'hash-demo-no-real',
        rolId: roles.admin.id,
      },
      {
        id: mecanicoId,
        nombre: `Mecanico ${label}`,
        email: `mecanico-${emailLabel}-${unique.toLowerCase()}@test.sgmv.local`,
        contrasenaHash: 'hash-demo-no-real',
        rolId: roles.mecanico.id,
      },
      {
        id: conductorId,
        nombre: `Conductor ${label}`,
        email: `conductor-${emailLabel}-${unique.toLowerCase()}@test.sgmv.local`,
        contrasenaHash: 'hash-demo-no-real',
        rolId: roles.conductor.id,
      },
      {
        id: segundoConductorId,
        nombre: `Conductor alterno ${label}`,
        email: `conductor-alt-${emailLabel}-${unique.toLowerCase()}@test.sgmv.local`,
        contrasenaHash: 'hash-demo-no-real',
        rolId: roles.conductor.id,
      },
    ],
  })

  await prisma.bus.createMany({
    data: [
      {
        id: busId,
        codigoInterno: `TEST-BUS-${normalizedLabel}-${unique}-1`,
        placa: `T${unique.slice(0, 6)}1`,
        marca: 'Marca Test',
        modelo: 'Modelo Test',
        anio: 2020,
        kilometrajeActual: 10000,
      },
      {
        id: segundoBusId,
        codigoInterno: `TEST-BUS-${normalizedLabel}-${unique}-2`,
        placa: `T${unique.slice(0, 6)}2`,
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

async function createAssignedCorrectiveOrder(core: CoreFixture, label: string) {
  const ordenId = track('ordenes')
  const fechaCreacion = new Date()
  const fechaAsignacion = new Date(fechaCreacion.getTime() + 1000)

  return prisma.ordenTrabajo.create({
    data: {
      id: ordenId,
      codigo: code(`OT-TEST-${label.toUpperCase()}`),
      busId: core.busId,
      tipo: 'CORRECTIVA',
      origen: 'CORRECTIVO_DIRECTO',
      descripcion: `Orden correctiva directa ${label}.`,
      estado: 'ASIGNADA',
      tecnicoAsignadoId: core.mecanicoId,
      fechaCreacion,
      fechaAsignacion,
      creadaPorId: core.adminId,
    },
  })
}

async function createRepuesto(stockActual = '5') {
  const repuestoId = track('repuestos')

  return prisma.repuesto.create({
    data: {
      id: repuestoId,
      codigo: code('REP-TEST'),
      nombre: 'Repuesto de prueba',
      unidadMedida: 'unidad',
      stockActual,
      stockMinimo: '1',
      costoUnitario: '25000',
    },
  })
}

async function cleanup() {
  await prisma.$transaction(
    async (tx) => {
      await tx.movimientoInventario.deleteMany({ where: { id: { in: created.movimientos } } })
      await tx.consumoRepuesto.deleteMany({ where: { id: { in: created.consumos } } })
      await tx.actividadOrden.deleteMany({ where: { id: { in: created.actividades } } })
      await tx.intervencion.deleteMany({ where: { id: { in: created.intervenciones } } })
      await tx.ordenTrabajo.deleteMany({ where: { id: { in: created.ordenes } } })
      await tx.novedad.deleteMany({ where: { id: { in: created.novedades } } })
      await tx.programacionMantenimiento.deleteMany({
        where: { id: { in: created.programaciones } },
      })
      await tx.asignacionConductor.deleteMany({ where: { id: { in: created.asignaciones } } })
      await tx.repuesto.deleteMany({ where: { id: { in: created.repuestos } } })
      await tx.bus.deleteMany({ where: { id: { in: created.buses } } })
      await tx.usuario.deleteMany({ where: { id: { in: created.usuarios } } })
    },
    {
      maxWait: 15000,
      timeout: 60000,
    },
  )
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

  it('keeps novelty-origin orders unique and bound to the same bus as the novelty', async () => {
    const core = await createCore('novelty')
    const novedadId = track('novedades')
    const ordenId = track('ordenes')
    const duplicateOrdenId = track('ordenes')
    const invalidMissingNovedadOrdenId = track('ordenes')
    const invalidBusOrdenId = track('ordenes')

    await prisma.novedad.create({
      data: {
        id: novedadId,
        conductorId: core.conductorId,
        busId: core.busId,
        tipo: 'Falla reportada',
        descripcion: 'Ruido en el sistema de frenos.',
      },
    })

    await expect(
      prisma.ordenTrabajo.create({
        data: {
          id: invalidBusOrdenId,
          codigo: code('OT-TEST-NOV-BUS'),
          busId: core.segundoBusId,
          tipo: 'CORRECTIVA',
          origen: 'NOVEDAD',
          descripcion: 'Orden con bus diferente al bus de la novedad.',
          estado: 'PENDIENTE_ASIGNACION',
          creadaPorId: core.adminId,
          novedadId,
        },
      }),
    ).rejects.toBeTruthy()

    await prisma.ordenTrabajo.create({
      data: {
        id: ordenId,
        codigo: code('OT-TEST-NOV'),
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
          codigo: code('OT-TEST-NOV-DUP'),
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
          id: invalidMissingNovedadOrdenId,
          codigo: code('OT-TEST-NOV-INV'),
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

  it('allows historical preventive orders but only one active per schedule and bus', async () => {
    const core = await createCore('preventive')
    const programacionId = track('programaciones')
    const primeraOrdenId = track('ordenes')
    const duplicateOrdenId = track('ordenes')
    const segundaOrdenId = track('ordenes')
    const invalidBusOrdenId = track('ordenes')
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

    await expect(
      prisma.ordenTrabajo.create({
        data: {
          id: invalidBusOrdenId,
          codigo: code('OT-TEST-PREV-BUS'),
          busId: core.segundoBusId,
          tipo: 'PREVENTIVA',
          origen: 'PREVENTIVO',
          descripcion: 'Orden preventiva con bus diferente al de la programacion.',
          estado: 'PENDIENTE_ASIGNACION',
          creadaPorId: core.adminId,
          programacionMantenimientoId: programacionId,
          fechaObjetivoPreventivo: fechaObjetivo,
          kilometrajeObjetivoPreventivo: 10500,
        },
      }),
    ).rejects.toBeTruthy()

    await prisma.ordenTrabajo.create({
      data: {
        id: primeraOrdenId,
        codigo: code('OT-TEST-PREV'),
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
          codigo: code('OT-TEST-PREV-DUP'),
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
        ...orderedDates(),
        estado: 'CERRADA',
        tecnicoAsignadoId: core.mecanicoId,
        cerradaPorId: core.adminId,
      },
    })

    const segundaFechaCreacion = new Date()
    const segundaOrden = await prisma.ordenTrabajo.create({
      data: {
        id: segundaOrdenId,
        codigo: code('OT-TEST-PREV-HIST'),
        busId: core.busId,
        tipo: 'PREVENTIVA',
        origen: 'PREVENTIVO',
        descripcion: 'Nueva orden preventiva tras cierre historico.',
        estado: 'ASIGNADA',
        tecnicoAsignadoId: core.mecanicoId,
        fechaCreacion: segundaFechaCreacion,
        fechaAsignacion: new Date(segundaFechaCreacion.getTime() + 1000),
        creadaPorId: core.adminId,
        programacionMantenimientoId: programacionId,
        fechaObjetivoPreventivo: fechaObjetivo,
        kilometrajeObjetivoPreventivo: 10500,
      },
    })

    expect(segundaOrden.programacionMantenimientoId).toBe(programacionId)
  }, 60000)

  it('validates work-order dates and prevents reopening closed orders', async () => {
    const core = await createCore('dates')
    const missingAssignmentDateId = track('ordenes')
    const invalidChronologyId = track('ordenes')
    const terminalOrden = await createAssignedCorrectiveOrder(core, 'DATES')
    const fechaCreacion = new Date()
    const fechaAsignacion = new Date(fechaCreacion.getTime() - 1000)

    await expect(
      prisma.ordenTrabajo.create({
        data: {
          id: missingAssignmentDateId,
          codigo: code('OT-TEST-DATE-MISS'),
          busId: core.busId,
          tipo: 'CORRECTIVA',
          origen: 'CORRECTIVO_DIRECTO',
          descripcion: 'Orden asignada sin fecha de asignacion.',
          estado: 'ASIGNADA',
          tecnicoAsignadoId: core.mecanicoId,
          creadaPorId: core.adminId,
        },
      }),
    ).rejects.toBeTruthy()

    await expect(
      prisma.ordenTrabajo.create({
        data: {
          id: invalidChronologyId,
          codigo: code('OT-TEST-DATE-INV'),
          busId: core.busId,
          tipo: 'CORRECTIVA',
          origen: 'CORRECTIVO_DIRECTO',
          descripcion: 'Orden con asignacion anterior a la creacion.',
          estado: 'ASIGNADA',
          tecnicoAsignadoId: core.mecanicoId,
          fechaCreacion,
          fechaAsignacion,
          creadaPorId: core.adminId,
        },
      }),
    ).rejects.toBeTruthy()

    await prisma.ordenTrabajo.update({
      where: { id: terminalOrden.id },
      data: {
        ...orderedDates(),
        estado: 'CERRADA',
        cerradaPorId: core.adminId,
      },
    })

    await expect(
      prisma.ordenTrabajo.update({
        where: { id: terminalOrden.id },
        data: {
          estado: 'ASIGNADA',
        },
      }),
    ).rejects.toBeTruthy()
  }, 60000)

  it('normalizes case-sensitive business identifiers at the database boundary', async () => {
    const core = await createCore('normalization')
    const roles = await ensureRoles()
    const invalidUsuarioId = track('usuarios')
    const invalidBusId = track('buses')
    const invalidOrdenId = track('ordenes')
    const invalidRepuestoId = track('repuestos')

    await expect(
      prisma.usuario.create({
        data: {
          id: invalidUsuarioId,
          nombre: 'Usuario con correo no normalizado',
          email: `Upper-${shortCode()}@test.sgmv.local`,
          contrasenaHash: 'hash-demo-no-real',
          rolId: roles.conductor.id,
        },
      }),
    ).rejects.toBeTruthy()

    await expect(
      prisma.bus.create({
        data: {
          id: invalidBusId,
          codigoInterno: `test-bus-${shortCode()}`,
          placa: `t${shortCode().slice(0, 6)}`,
          marca: 'Marca Test',
          modelo: 'Modelo Test',
          anio: 2022,
        },
      }),
    ).rejects.toBeTruthy()

    await expect(
      prisma.ordenTrabajo.create({
        data: {
          id: invalidOrdenId,
          codigo: `ot-test-${shortCode().toLowerCase()}`,
          busId: core.busId,
          tipo: 'CORRECTIVA',
          origen: 'CORRECTIVO_DIRECTO',
          descripcion: 'Orden con codigo no normalizado.',
          estado: 'PENDIENTE_ASIGNACION',
          creadaPorId: core.adminId,
        },
      }),
    ).rejects.toBeTruthy()

    await expect(
      prisma.repuesto.create({
        data: {
          id: invalidRepuestoId,
          codigo: `rep-test-${shortCode().toLowerCase()}`,
          nombre: 'Repuesto no normalizado',
          unidadMedida: 'unidad',
        },
      }),
    ).rejects.toBeTruthy()
  }, 60000)

  it('links spare-part consumption through ConsumoRepuesto and derives order costs', async () => {
    const core = await createCore('inventory')
    const orden = await createAssignedCorrectiveOrder(core, 'INVENTORY')
    const repuesto = await createRepuesto()
    const consumoId = track('consumos')
    const invalidMovimientoId = track('movimientos')
    const movimientoId = track('movimientos')

    expect(orden.costoTotal.toNumber()).toBe(0)

    await expect(
      prisma.movimientoInventario.create({
        data: {
          id: invalidMovimientoId,
          repuestoId: repuesto.id,
          tipo: 'CONSUMO',
          cantidad: '1',
          responsableId: core.mecanicoId,
        },
      }),
    ).rejects.toBeTruthy()

    await prisma.$transaction(async (tx) => {
      await tx.consumoRepuesto.create({
        data: {
          id: consumoId,
          ordenTrabajoId: orden.id,
          repuestoId: repuesto.id,
          cantidad: '1',
          costoUnitario: '25000',
          subtotal: '25000',
          consumidoPorId: core.mecanicoId,
        },
      })

      await tx.movimientoInventario.create({
        data: {
          id: movimientoId,
          repuestoId: repuesto.id,
          tipo: 'CONSUMO',
          cantidad: '1',
          responsableId: core.mecanicoId,
          consumoRepuestoId: consumoId,
        },
      })
    })

    const movimiento = await prisma.movimientoInventario.findUniqueOrThrow({
      where: { id: movimientoId },
      include: {
        consumoRepuesto: {
          include: {
            ordenTrabajo: true,
            repuesto: true,
          },
        },
      },
    })
    const ordenActualizada = await prisma.ordenTrabajo.findUniqueOrThrow({
      where: { id: orden.id },
    })

    expect(movimiento.consumoRepuesto?.ordenTrabajo.id).toBe(orden.id)
    expect(movimiento.consumoRepuesto?.repuesto.id).toBe(repuesto.id)
    expect(ordenActualizada.costoTotal.toNumber()).toBe(25000)
    expect(Object.values(Prisma.MovimientoInventarioScalarFieldEnum) as string[]).not.toContain(
      'ordenTrabajoId',
    )
    expect(Object.values(Prisma.OrdenTrabajoScalarFieldEnum) as string[]).not.toContain(
      'repuestoId',
    )
  }, 60000)

  it('rejects inconsistent spare-part movements, orphan consumptions and manual subtotals', async () => {
    const core = await createCore('inventory-negative')
    const orden = await createAssignedCorrectiveOrder(core, 'INVNEG')
    const repuesto = await createRepuesto()
    const otroRepuesto = await createRepuesto()
    const standaloneConsumoId = track('consumos')
    const wrongSubtotalConsumoId = track('consumos')
    const wrongPartConsumoId = track('consumos')
    const wrongPartMovimientoId = track('movimientos')

    await expect(
      prisma.consumoRepuesto.create({
        data: {
          id: standaloneConsumoId,
          ordenTrabajoId: orden.id,
          repuestoId: repuesto.id,
          cantidad: '1',
          costoUnitario: '25000',
          subtotal: '25000',
          consumidoPorId: core.mecanicoId,
        },
      }),
    ).rejects.toBeTruthy()

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.consumoRepuesto.create({
          data: {
            id: wrongSubtotalConsumoId,
            ordenTrabajoId: orden.id,
            repuestoId: repuesto.id,
            cantidad: '2',
            costoUnitario: '25000',
            subtotal: '1',
            consumidoPorId: core.mecanicoId,
          },
        })
      }),
    ).rejects.toBeTruthy()

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.consumoRepuesto.create({
          data: {
            id: wrongPartConsumoId,
            ordenTrabajoId: orden.id,
            repuestoId: repuesto.id,
            cantidad: '1',
            costoUnitario: '25000',
            subtotal: '25000',
            consumidoPorId: core.mecanicoId,
          },
        })

        await tx.movimientoInventario.create({
          data: {
            id: wrongPartMovimientoId,
            repuestoId: otroRepuesto.id,
            tipo: 'CONSUMO',
            cantidad: '1',
            responsableId: core.mecanicoId,
            consumoRepuestoId: wrongPartConsumoId,
          },
        })
      }),
    ).rejects.toBeTruthy()
  }, 60000)

  it('requires reasons for administrative inventory movements and keeps stock non-negative', async () => {
    const core = await createCore('stock')
    const orden = await createAssignedCorrectiveOrder(core, 'STOCK')
    const repuesto = await createRepuesto('1')
    const invalidEntradaId = track('movimientos')
    const invalidAjusteId = track('movimientos')
    const blockedConsumoId = track('consumos')
    const blockedMovimientoId = track('movimientos')

    await expect(
      prisma.movimientoInventario.create({
        data: {
          id: invalidEntradaId,
          repuestoId: repuesto.id,
          tipo: 'ENTRADA',
          cantidad: '1',
          responsableId: core.adminId,
        },
      }),
    ).rejects.toBeTruthy()

    await expect(
      prisma.movimientoInventario.create({
        data: {
          id: invalidAjusteId,
          repuestoId: repuesto.id,
          tipo: 'AJUSTE_SALIDA',
          cantidad: '1',
          motivo: ' ',
          responsableId: core.adminId,
        },
      }),
    ).rejects.toBeTruthy()

    await expect(
      prisma.$transaction(async (tx) => {
        const stockUpdate = await tx.repuesto.updateMany({
          where: {
            id: repuesto.id,
            stockActual: { gte: '2' },
          },
          data: {
            stockActual: { decrement: '2' },
          },
        })

        if (stockUpdate.count !== 1) {
          throw new Error('Stock insuficiente para consumo atomico.')
        }

        await tx.consumoRepuesto.create({
          data: {
            id: blockedConsumoId,
            ordenTrabajoId: orden.id,
            repuestoId: repuesto.id,
            cantidad: '2',
            costoUnitario: '25000',
            subtotal: '50000',
            consumidoPorId: core.mecanicoId,
          },
        })

        await tx.movimientoInventario.create({
          data: {
            id: blockedMovimientoId,
            repuestoId: repuesto.id,
            tipo: 'CONSUMO',
            cantidad: '2',
            responsableId: core.mecanicoId,
            consumoRepuestoId: blockedConsumoId,
          },
        })
      }),
    ).rejects.toThrow('Stock insuficiente')

    const repuestoSinCambio = await prisma.repuesto.findUniqueOrThrow({
      where: { id: repuesto.id },
    })
    const consumoBloqueado = await prisma.consumoRepuesto.findUnique({
      where: { id: blockedConsumoId },
    })
    const movimientoBloqueado = await prisma.movimientoInventario.findUnique({
      where: { id: blockedMovimientoId },
    })

    expect(repuestoSinCambio.stockActual.toNumber()).toBe(1)
    expect(consumoBloqueado).toBeNull()
    expect(movimientoBloqueado).toBeNull()

    await expect(
      prisma.repuesto.update({
        where: { id: repuesto.id },
        data: {
          stockActual: { decrement: '2' },
        },
      }),
    ).rejects.toBeTruthy()
  }, 60000)
})
