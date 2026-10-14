import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { Prisma, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const apply = process.argv.includes('--apply')
const database = new URL(process.env.DATABASE_URL ?? '')
if (
  !['localhost', '127.0.0.1', '[::1]'].includes(database.hostname) ||
  process.env.NODE_ENV === 'production'
) {
  throw new Error('Esta herramienta solo trabaja en una base local. No modifica producción.')
}
const testUser = { email: { endsWith: '@test.sgmv.local', mode: 'insensitive' as const } }
const fixtureBus = {
  marca: 'Marca RF04',
  modelo: 'Modelo RF04',
  codigoInterno: { startsWith: 'OT-BUS-' },
}
const include = {
  ordenesTrabajo: {
    include: {
      intervenciones: { include: { actividades: true } },
      estadosHistorial: true,
      reasignaciones: true,
      autorizacionesExcepcion: true,
    },
  },
  novedades: true,
  lecturasKilometraje: true,
  estadosHistorial: true,
} as const

// Coincidencia conjunta de firma exacta y autoría reservada. No se clasifica
// un bus real como prueba por contener casualmente "RF" en su descripción.
const eligible: Prisma.BusWhereInput = {
  ...fixtureBus,
  ordenesTrabajo: {
    every: {
      creadaPor: testUser,
      OR: [{ tecnicoAsignadoId: null }, { tecnicoAsignado: testUser }],
      AND: [
        { OR: [{ cerradaPorId: null }, { cerradaPor: testUser }] },
        { OR: [{ anuladaPorId: null }, { anuladaPor: testUser }] },
        { OR: [{ esperaRegistradaPorId: null }, { esperaRegistradaPor: testUser }] },
      ],
      estadosHistorial: { every: { cambiadoPor: testUser } },
      reasignaciones: { every: { reasignadoPor: testUser } },
      autorizacionesExcepcion: { every: { autorizadoPor: testUser } },
      consumosRepuesto: { none: {} },
      intervenciones: {
        every: { tecnico: testUser, actividades: { every: { registradaPor: testUser } } },
      },
    },
  },
  novedades: {
    every: {
      conductor: testUser,
      OR: [{ revisadaPorId: null }, { revisadaPor: testUser }],
      evidencias: { none: {} },
    },
  },
  lecturasKilometraje: {
    every: { registradoPor: testUser, OR: [{ observadoPorId: null }, { observadoPor: testUser }] },
  },
  estadosHistorial: { every: { cambiadoPor: testUser } },
  jornadasOperativas: { none: {} },
  asignaciones: { none: {} },
  programacionesMantenimiento: { none: {} },
  planesPreventivos: { none: {} },
  compatibilidadesRepuesto: { none: {} },
}

try {
  const [candidates, safe, accounts] = await Promise.all([
    prisma.bus.findMany({ where: fixtureBus, select: { id: true, codigoInterno: true } }),
    prisma.bus.findMany({ where: eligible, include }),
    prisma.usuario.count({ where: testUser }),
  ])
  const plan = {
    scope: 'local',
    apply,
    hardDeleteAccounts: false,
    reservedAccounts: accounts,
    eligibleBuses: safe.map((bus) => ({
      id: bus.id,
      codigo: bus.codigoInterno,
      orders: bus.ordenesTrabajo.length,
    })),
    blockedBuses: candidates.filter((bus) => !safe.some((item) => item.id === bus.id)),
    blockedReason:
      'Relaciones compartidas, consumos, fotos, planificación o autoría no confirmada. Requieren revisión; no se alteran.',
  }
  if (!apply) {
    console.log(JSON.stringify(plan, null, 2))
  } else {
    const ids = (process.env.CONFIRMED_TEST_BUS_IDS ?? '').split(',').filter(Boolean).map(Number)
    if (
      ids.length === 0 ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !Number.isSafeInteger(id) || !safe.some((bus) => bus.id === id))
    ) {
      throw new Error(
        'CONFIRMED_TEST_BUS_IDS debe enumerar únicamente los IDs elegibles revisados en la previsualización.',
      )
    }
    const backupPath = process.env.TEST_DATA_BACKUP_PATH
    if (
      !backupPath ||
      !resolve(backupPath).startsWith(resolve(process.env.HOME ?? '', '.openclaw/artifacts') + '/')
    ) {
      throw new Error(
        'TEST_DATA_BACKUP_PATH debe estar fuera del repositorio, bajo ~/.openclaw/artifacts/.',
      )
    }
    mkdirSync(dirname(backupPath), { recursive: true, mode: 0o700 })
    const selected = safe.filter((bus) => ids.includes(bus.id))
    const orderIds = selected.flatMap((bus) => bus.ordenesTrabajo.map((order) => order.id))
    const noveltyIds = selected.flatMap((bus) => bus.novedades.map((item) => item.id))
    const alertSnapshot = await prisma.alertaInterna.findMany({
      where: {
        OR: [
          { busId: { in: ids } },
          { ordenTrabajoId: { in: orderIds } },
          { novedadId: { in: noveltyIds } },
        ],
      },
      include: { destinatarios: true },
    })
    writeFileSync(
      backupPath,
      JSON.stringify(
        {
          database: database.pathname,
          capturedAt: new Date().toISOString(),
          buses: selected,
          alertas: alertSnapshot,
        },
        null,
        2,
      ),
      { mode: 0o600, flag: 'wx' },
    )
    await prisma.$transaction(
      async (tx) => {
        const current = await tx.bus.findMany({
          where: { AND: [eligible, { id: { in: ids } }] },
          include,
        })
        if (JSON.stringify(current) !== JSON.stringify(selected))
          throw new Error(
            'Los registros cambiaron después de la previsualización. No se realizó la limpieza.',
          )
        const orderIds = current.flatMap((bus) => bus.ordenesTrabajo.map((order) => order.id))
        const interventionIds = current.flatMap((bus) =>
          bus.ordenesTrabajo.flatMap((order) => order.intervenciones.map((item) => item.id)),
        )
        const noveltyIds = current.flatMap((bus) => bus.novedades.map((item) => item.id))
        const alertsWhere = {
          OR: [
            { busId: { in: ids } },
            { ordenTrabajoId: { in: orderIds } },
            { novedadId: { in: noveltyIds } },
          ],
        }
        const alerts = await tx.alertaInterna.findMany({ where: alertsWhere, select: { id: true } })
        await tx.alertaDestinatario.deleteMany({
          where: { alertaInternaId: { in: alerts.map((item) => item.id) } },
        })
        await tx.alertaInterna.deleteMany({ where: alertsWhere })
        await tx.autorizacionExcepcionConsumo.deleteMany({
          where: { ordenTrabajoId: { in: orderIds } },
        })
        await tx.actividadOrden.deleteMany({ where: { intervencionId: { in: interventionIds } } })
        await tx.novedad.updateMany({
          where: { id: { in: noveltyIds } },
          data: { lecturaKilometrajeId: null },
        })
        await tx.lecturaKilometraje.deleteMany({ where: { busId: { in: ids } } })
        await tx.intervencion.deleteMany({ where: { ordenTrabajoId: { in: orderIds } } })
        await tx.ordenEstadoHistorial.deleteMany({ where: { ordenTrabajoId: { in: orderIds } } })
        await tx.ordenReasignacion.deleteMany({ where: { ordenTrabajoId: { in: orderIds } } })
        await tx.ordenTrabajo.deleteMany({ where: { id: { in: orderIds } } })
        await tx.novedad.deleteMany({ where: { id: { in: noveltyIds } } })
        await tx.busEstadoHistorial.deleteMany({ where: { busId: { in: ids } } })
        await tx.bus.deleteMany({ where: { id: { in: ids } } })
        await tx.eventoAuditoria.create({
          data: {
            accion: 'Limpieza local de fixtures confirmados',
            requestId: randomUUID(),
            metodo: 'DELETE',
            ruta: 'maintenance:cleanup-test-data:local',
            resultado: 'EXITO',
            statusHttp: 200,
            detalles: { canal: 'CLI', busIds: ids, ordenes: orderIds.length, backup: backupPath },
          },
        })
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 },
    )
    console.log(JSON.stringify({ ...plan, removedBuses: ids.length, backup: backupPath }, null, 2))
  }
} finally {
  await prisma.$disconnect()
}
