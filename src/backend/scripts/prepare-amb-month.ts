import { randomUUID } from 'node:crypto'
import { hash } from 'bcryptjs'

import { buildAmbOperationalMonth } from '../src/amb/operational-month.js'

const option = (key: string) =>
  process.argv.find((arg) => arg.startsWith(`${key}=`))?.slice(key.length + 1)
const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString('en-CA', {
  timeZone: 'America/Bogota',
})
const plan = buildAmbOperationalMonth(option('--desde') ?? tomorrow, Number(option('--dias') ?? 30))
const apply = process.argv.includes('--aplicar-demo')
const total = plan.empresas.reduce(
  (sum, company) => sum + company.turnos.reduce((count, shift) => count + shift.jornadas.length, 0),
  0,
)

if (!apply) {
  console.log(JSON.stringify({ ...plan, totalJornadas: total, aplicaDatos: false }, null, 2))
} else {
  const url = new URL(process.env.DATABASE_URL ?? '')
  if (
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    process.env.NODE_ENV === 'production'
  )
    throw new Error('La preparación de demostración solo permite una base local; nunca producción')
  if (!url.pathname.startsWith('/sgmv_test_') && url.pathname !== '/sgmv_admin_validation_20261013')
    throw new Error('Utilice la base aislada de revisión, no la base habitual del operador')
  if (!process.argv.includes('--confirmar-datos-simulados'))
    throw new Error(
      'Confirme que vehículos, conductores, odómetros e inventario son datos simulados',
    )
  if (!process.env.SEED_USER_PASSWORD) throw new Error('Falta la clave del entorno de demostración')
  const firstSlot = plan.empresas[0]!.turnos[0]!.jornadas[0]
  if (!firstSlot)
    throw new Error('El período no contiene días de operación; seleccione otro horizonte')
  if (firstSlot.inicioProgramado.getTime() <= Date.now())
    throw new Error('El horizonte debe comenzar en el futuro; no se fabrican jornadas realizadas')

  const { runInPrismaTransaction, disconnectPrisma } = await import('../src/prisma/client.js')
  const { JourneyService } = await import('../src/journeys/journey.service.js')
  const { officialAmbRoutes } = await import('../src/amb/routes.js')
  const passwordHash = await hash(process.env.SEED_USER_PASSWORD, 10)
  try {
    const outcome = await runInPrismaTransaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(14102026)`
      const admin = await tx.usuario.findUniqueOrThrow({
        where: { email: 'administrador.demo@sgmv.local' },
        include: { rol: true },
      })
      const dispatcher = await tx.usuario.findUniqueOrThrow({
        where: { email: 'despachador.demo@sgmv.local' },
        include: { rol: true },
      })
      const driverRole = await tx.rol.findUniqueOrThrow({ where: { codigo: 'CONDUCTOR' } })
      if (
        admin.estado !== 'ACTIVO' ||
        admin.rol.codigo !== 'ADMINISTRADOR' ||
        dispatcher.estado !== 'ACTIVO' ||
        dispatcher.rol.codigo !== 'DESPACHADOR'
      )
        throw new Error('Las cuentas de coordinación deben estar activas y conservar su rol')
      let model = await tx.modeloBus.findFirst({
        where: { marca: 'SGMV-DEMO', nombreModelo: 'URBANO-AMB-MES' },
      })
      if (!model)
        model = await tx.modeloBus.create({
          data: {
            marca: 'SGMV-DEMO',
            nombreModelo: 'URBANO-AMB-MES',
            versionTecnica: 'DEMO-MENSUAL-1',
            especificaciones: {
              origenDato: 'SIMULADO_SGMV',
              combustible: 'Diesel',
              configuracion: 'Vehículo académico; sin homologación de fabricante',
            },
          },
        })
      let createdJourneys = 0
      let skippedJourneys = 0
      const service = new JourneyService()
      for (const [companyIndex, company] of plan.empresas.entries()) {
        const reference = officialAmbRoutes.find((route) => route.codigo === company.codigoRuta)!
        const route = await tx.ruta.upsert({
          where: { codigo: company.codigoRuta },
          update: {},
          create: { ...reference, origenDato: 'OFICIAL' },
        })
        const buses = []
        for (const [index, code] of [company.busPrincipal, company.busReserva].entries()) {
          let bus = await tx.bus.findUnique({ where: { codigoInterno: code } })
          if (!bus)
            bus = await tx.bus.create({
              data: {
                codigoInterno: code,
                placa: `SIM${String(companyIndex * 2 + index + 601)}`,
                empresaOperadora: company.empresa,
                origenDatos: 'SIMULADO_SGMV',
                fuenteDatos:
                  'Escenario académico mensual SGMV; únicamente empresa y ruta son referencias públicas',
                marca: 'SGMV-DEMO',
                modelo: 'URBANO-AMB-MES',
                modeloBusId: model.id,
                anio: 2026,
                kilometrajeActual: 40_000 + companyIndex * 1000,
              },
            })
          if (bus.origenDatos !== 'SIMULADO_SGMV' || bus.empresaOperadora !== company.empresa)
            throw new Error(
              'El código está ocupado por un registro ajeno al escenario; no se sobrescribe',
            )
          buses.push(bus)
          let routine = await tx.planMantenimientoPreventivo.findFirst({
            where: { busId: bus.id, claveTarea: 'SIM.AMB.INSPECCION', activo: true },
          })
          if (!routine)
            routine = await tx.planMantenimientoPreventivo.create({
              data: {
                busId: bus.id,
                claveTarea: 'SIM.AMB.INSPECCION',
                actividad: 'Inspección visual académica programada',
                componente: 'Inspección general',
                criterio: 'FECHA',
                intervaloDias: 7,
                origenRegla: 'DEMO_ACADEMICA',
                referenciaRegla:
                  'Cadencia académica de demostración; no es un intervalo universal ni de fabricante',
                anticipacionDias: 2,
                bloqueaAlVencer: false,
                prioridad: 'BAJA',
                version: 1,
                activo: true,
                creadoPorId: admin.id,
              },
            })
          const existingSchedule = await tx.programacionMantenimiento.findFirst({
            where: { planMantenimientoPreventivoId: routine.id },
          })
          if (!existingSchedule) {
            const sunday = new Date(`${plan.fechaInicio}T07:00:00-05:00`)
            while (sunday.getUTCDay() !== 0) sunday.setUTCDate(sunday.getUTCDate() + 1)
            await tx.programacionMantenimiento.create({
              data: {
                busId: bus.id,
                planMantenimientoPreventivoId: routine.id,
                tipo: routine.componente,
                actividad: routine.actividad,
                criterio: 'FECHA',
                fechaProgramada: sunday,
                creadaPorId: admin.id,
              },
            })
          }
        }
        for (const shift of company.turnos) {
          const email = `conductor.${company.slug.toLowerCase()}.${shift.codigo.toLowerCase()}.demo@sgmv.local`
          const driver = await tx.usuario.upsert({
            where: { email },
            update: {},
            create: {
              nombre: `Conductor ${company.slug} ${shift.codigo} · Simulado`,
              email,
              contrasenaHash: passwordHash,
              rolId: driverRole.id,
            },
          })
          if (driver.estado !== 'ACTIVO' || driver.rolId !== driverRole.id)
            throw new Error(
              'La cuenta existente no está disponible; no se reactiva ni cambia de rol',
            )
          for (const slot of shift.jornadas) {
            const existing = await tx.jornadaOperativa.findFirst({
              where: {
                busId: buses[0]!.id,
                conductorId: driver.id,
                rutaId: route.id,
                inicioProgramado: slot.inicioProgramado,
                finProgramado: slot.finProgramado,
              },
            })
            if (existing) {
              skippedJourneys++
              continue
            }
            await service.create(
              {
                busId: buses[0]!.id,
                conductorId: driver.id,
                rutaId: route.id,
                inicioProgramado: slot.inicioProgramado.toISOString(),
                finProgramado: slot.finProgramado.toISOString(),
              },
              dispatcher,
            )
            createdJourneys++
          }
        }
      }
      for (const [index, component] of [
        'Filtro de lubricación',
        'Lubricante de motor',
        'Elemento de freno',
        'Correa auxiliar',
      ].entries()) {
        const code = `SIM-AMB-REP-${index + 1}`
        if (await tx.repuesto.findUnique({ where: { codigo: code } })) continue
        const part = await tx.repuesto.create({
          data: {
            codigo: code,
            nombre: `${component} · Demostración`,
            categoria: 'Escenario académico mensual',
            unidadMedida: index === 1 ? 'LITRO' : 'UNIDAD',
            stockActual: 50,
            stockMinimo: 10,
            costoUnitario: 20_000 + index * 15_000,
            especificaciones: {
              origenDato: 'SIMULADO_SGMV',
              nota: 'Referencia, precio y cantidad de demostración, sin catálogo empresarial',
            },
          },
        })
        await tx.movimientoInventario.create({
          data: {
            repuestoId: part.id,
            tipo: 'ENTRADA',
            cantidad: 50,
            costoUnitario: part.costoUnitario,
            responsableId: admin.id,
            motivo: 'Saldo inicial simulado del escenario académico mensual SGMV',
          },
        })
        await tx.compatibilidadRepuesto.create({
          data: {
            repuestoId: part.id,
            modeloBusId: model.id,
            version: 1,
            permitido: true,
            vigente: true,
            fechaDefinicion: new Date(),
            definidaPorId: admin.id,
            especificacionesValidadas: {
              origenDato: 'SIMULADO_SGMV',
              contexto: 'Compatibilidad académica; no corresponde a una homologación real',
            },
          },
        })
      }
      await tx.eventoAuditoria.create({
        data: {
          accion: 'Preparación local de operación mensual simulada',
          requestId: randomUUID(),
          metodo: 'POST',
          ruta: 'demo:amb:mes:local',
          resultado: 'EXITO',
          statusHttp: 201,
          actorId: admin.id,
          detalles: {
            desde: plan.fechaInicio,
            hasta: plan.fechaFin,
            jornadasCreadas: createdJourneys,
            jornadasExistentes: skippedJourneys,
            origenDato: 'SIMULADO_SGMV',
          },
        },
      })
      return { createdJourneys, skippedJourneys }
    })
    console.log(
      JSON.stringify({
        ...outcome,
        empresas: plan.empresas.length,
        desde: plan.fechaInicio,
        hasta: plan.fechaFin,
        origenOperacion: plan.origenOperacion,
      }),
    )
  } finally {
    await disconnectPrisma()
  }
}
