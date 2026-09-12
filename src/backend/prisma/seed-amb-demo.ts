import type { Prisma } from '@prisma/client'
import { evaluateJourneyProjectionAlerts } from '../src/alerts/journey-projection-alerts.js'

/** Academic fixtures only; no individual bus, operator's technical parts or mileage is asserted as real. */
export async function seedAmbDemo(
  tx: Prisma.TransactionClient,
  input: {
    adminId: number
    dispatcherId: number
    driverRoleId: number
    modelId: number
    passwordHash: string
  },
) {
  const driver = await tx.usuario.upsert({
    where: { email: 'conductor.amb.demo@sgmv.local' },
    update: { contrasenaHash: input.passwordHash },
    create: {
      nombre: 'SIM-CONDUCTOR-AMB',
      email: 'conductor.amb.demo@sgmv.local',
      contrasenaHash: input.passwordHash,
      rolId: input.driverRoleId,
    },
  })
  const bus = await tx.bus.upsert({
    where: { codigoInterno: 'SIM-AMB-001' },
    update: {},
    create: {
      codigoInterno: 'SIM-AMB-001',
      placa: 'SIM531',
      marca: 'SGMV-DEMO',
      modelo: 'URBANO-DUAL-A',
      modeloBusId: input.modelId,
      anio: 2026,
      kilometrajeActual: 48930,
    },
  })
  let plan = await tx.planMantenimientoPreventivo.findFirst({
    where: { busId: bus.id, claveTarea: 'SIM.AMB.MOTOR', activo: true },
  })
  if (!plan)
    plan = await tx.planMantenimientoPreventivo.create({
      data: {
        busId: bus.id,
        claveTarea: 'SIM.AMB.MOTOR',
        actividad: 'Revisión simulada de motor',
        componente: 'Motor SGMV-DEMO',
        criterio: 'KILOMETRAJE',
        intervaloKm: 5000,
        anticipacionKm: 500,
        bloqueaAlVencer: true,
        prioridad: 'MEDIA',
        activo: true,
        version: 1,
        creadoPorId: input.adminId,
      },
    })
  if (
    !(await tx.programacionMantenimiento.findFirst({
      where: { busId: bus.id, planMantenimientoPreventivoId: plan.id },
    }))
  ) {
    await tx.programacionMantenimiento.create({
      data: {
        busId: bus.id,
        planMantenimientoPreventivoId: plan.id,
        tipo: plan.componente,
        actividad: plan.actividad,
        criterio: 'KILOMETRAJE',
        kilometrajeObjetivo: 49500,
        creadaPorId: input.adminId,
      },
    })
  }
  const route = await tx.ruta.findUniqueOrThrow({ where: { codigo: '53' } })
  let journey = await tx.jornadaOperativa.findFirst({
    where: { busId: bus.id, conductorId: driver.id },
    orderBy: { id: 'desc' },
  })
  if (!journey)
    journey = await tx.jornadaOperativa.create({
      data: {
        busId: bus.id,
        conductorId: driver.id,
        rutaId: route.id,
        programadaPorId: input.dispatcherId,
        estado: 'PROGRAMADA',
        inicioProgramado: new Date(Date.now() + 24 * 3600000),
        finProgramado: new Date(Date.now() + 32 * 3600000),
        ciclosCompletosSimulados: 6,
        kmNoComercialesSimulados: 8,
        longitudKmOficialSnapshot: 47,
        kmProyectadosDemo: 290,
      },
    })
  await evaluateJourneyProjectionAlerts(journey.id, tx)
}
