import { randomUUID } from 'node:crypto'
import { hash } from 'bcryptjs'
import { buildAmbOperationalHorizon } from '../src/amb/operational-horizon.js'

const option = (key: string) =>
  process.argv.find((arg) => arg.startsWith(`${key}=`))?.slice(key.length + 1)
const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString('en-CA', {
  timeZone: 'America/Bogota',
})
const plan = buildAmbOperationalHorizon(
  option('--desde') ?? tomorrow,
  option('--hasta') ?? `${Number(tomorrow.slice(0, 4)) + 1}-01-31`,
)
const localApply = process.argv.includes('--aplicar-local')
const publishedApply = process.argv.includes('--aplicar-entorno-publicado')

if (!localApply && !publishedApply) {
  console.log(JSON.stringify({ ...plan, aplicaDatos: false }, null, 2))
} else {
  const database = new URL(process.env.DATABASE_URL ?? '')
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(database.hostname)
  if (localApply === publishedApply) throw new Error('Seleccione un solo destino de aplicación')
  if (
    localApply &&
    (!local ||
      process.env.NODE_ENV === 'production' ||
      (database.pathname !== '/sgmv_admin_validation_20261013' &&
        !database.pathname.startsWith('/sgmv_test_')))
  )
    throw new Error('Utilice una base local aislada de revisión o pruebas')
  if (
    publishedApply &&
    (local ||
      !database.hostname.endsWith('.neon.tech') ||
      database.hostname !== process.env.SGMV_RELEASE_DATABASE_HOST ||
      process.env.SGMV_SIMULATION_RELEASE_CONTEXT !== 'sgmv-amb-mensual-2026-10-14')
  )
    throw new Error(
      'El destino publicado exige contexto de release y host verificado por el operador',
    )
  if (!process.argv.includes('--confirmar-datos-simulados'))
    throw new Error('Declare la simulación autorizada')
  if (!process.env.SEED_USER_PASSWORD)
    throw new Error('Falta la credencial protegida del escenario')
  const first = plan.empresas[0]!.turnos[0]!.meses.flatMap((month) => month.jornadas)[0]
  if (!first || first.inicioProgramado.getTime() <= Date.now())
    throw new Error('El horizonte debe comenzar en el futuro')

  const { prisma, runInPrismaTransaction, disconnectPrisma } =
    await import('../src/prisma/client.js')
  const { JourneyService } = await import('../src/journeys/journey.service.js')
  const { initialPreventiveTargets } = await import('../src/preventive/preventive-cycle.js')
  const { createJourneyChangeAlert } = await import('../src/alerts/alert.service.js')
  const passwordHash = await hash(process.env.SEED_USER_PASSWORD, 10)
  const service = new JourneyService()
  let createdJourneys = 0
  let skippedJourneys = 0
  try {
    const roles = await prisma.rol.findMany()
    async function account(
      email: string,
      nombre: string,
      roleCode: 'ADMINISTRADOR' | 'DESPACHADOR' | 'CONDUCTOR' | 'MECANICO',
    ) {
      const role = roles.find((row) => row.codigo === roleCode)
      if (!role)
        throw new Error('Falta un rol canónico; aplique las migraciones antes del escenario')
      const user = await prisma.usuario.upsert({
        where: { email },
        update: {},
        create: {
          email,
          nombre,
          rolId: role.id,
          contrasenaHash: passwordHash,
        },
        include: { rol: true },
      })
      if (user.estado !== 'ACTIVO' || user.rol.codigo !== roleCode || user.nombre !== nombre)
        throw new Error('Una cuenta del escenario fue modificada; no se reactiva ni sobrescribe')
      return user
    }
    const admin = await account(
      'administrador.amb.demo@sgmv.local',
      'Administrador AMB · Simulado',
      'ADMINISTRADOR',
    )
    const dispatcher = await account(
      'despachador.amb.demo@sgmv.local',
      'Despachador AMB · Simulado',
      'DESPACHADOR',
    )
    let model = await prisma.modeloBus.findFirst({
      where: { marca: 'SGMV-DEMO', nombreModelo: 'URBANO-AMB-MES' },
    })
    if (!model)
      model = await prisma.modeloBus.create({
        data: {
          marca: 'SGMV-DEMO',
          nombreModelo: 'URBANO-AMB-MES',
          versionTecnica: 'DEMO-MENSUAL-1',
          especificaciones: {
            origenDato: 'SIMULADO_SGMV',
            combustible: 'Diesel',
            configuracion: 'Modelo académico; sin homologación empresarial',
          },
        },
      })

    for (const [companyIndex, company] of plan.empresas.entries()) {
      const route = await prisma.ruta.upsert({
        where: { codigo: company.ruta.codigo },
        update: {},
        create: company.ruta,
      })
      if (
        route.operador !== company.empresa ||
        route.longitudKmOficial?.toNumber() !== company.ruta.longitudKmOficial
      )
        throw new Error('Una referencia de ruta difiere de la fuente; no se sobrescribe')
      await account(
        `mecanico.${company.slug.toLowerCase()}.demo@sgmv.local`,
        `Mecánico ${company.slug} · Simulado`,
        'MECANICO',
      )
      const buses = []
      for (const [index, code] of [company.busPrincipal, company.busReserva].entries()) {
        const bus = await runInPrismaTransaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(14102026)`
          let current = await tx.bus.findUnique({ where: { codigoInterno: code } })
          if (!current) {
            current = await tx.bus.create({
              data: {
                codigoInterno: code,
                placa: `SIM${String(companyIndex * 2 + index + 601)}`,
                empresaOperadora: company.empresa,
                origenDatos: 'SIMULADO_SGMV',
                fuenteDatos:
                  'Escenario académico autorizado: empresa/ruta públicas; matrícula, persona, stock y operación simulados',
                marca: 'SGMV-DEMO',
                modelo: 'URBANO-AMB-MES',
                modeloBusId: model!.id,
                anio: 2026,
                kilometrajeActual: 40_000 + companyIndex * 1000,
              },
            })
            await tx.busEstadoHistorial.create({
              data: {
                busId: current.id,
                estadoAnterior: null,
                estadoNuevo: 'OPERATIVO',
                cambiadoPorId: admin.id,
                motivo: 'Alta del escenario mensual simulado autorizado',
              },
            })
          }
          if (
            current.origenDatos !== 'SIMULADO_SGMV' ||
            current.empresaOperadora !== company.empresa
          )
            throw new Error(
              'El código del vehículo está ocupado por un registro ajeno al escenario',
            )
          for (const [key, activity, days] of [
            ['SIM.AMB.INSPECCION', 'Inspección visual semanal · Simulada', 7],
            ['SIM.AMB.REVISION30', 'Revisión general de fluidos, frenos y correas · Simulada', 30],
          ] as const) {
            let routine = await tx.planMantenimientoPreventivo.findFirst({
              where: { busId: current.id, claveTarea: key, activo: true },
            })
            if (!routine)
              routine = await tx.planMantenimientoPreventivo.create({
                data: {
                  busId: current.id,
                  claveTarea: key,
                  actividad: activity,
                  componente: 'Inspección general',
                  criterio: 'FECHA',
                  intervaloDias: days,
                  origenRegla: 'DEMO_ACADEMICA',
                  referenciaRegla:
                    'Cadencia de demostración del escenario SGMV; no es intervalo universal ni de fabricante',
                  anticipacionDias: 2,
                  bloqueaAlVencer: false,
                  prioridad: days === 7 ? 'BAJA' : 'MEDIA',
                  version: 1,
                  activo: true,
                  creadoPorId: admin.id,
                },
              })
            if (
              !(await tx.programacionMantenimiento.findFirst({
                where: { planMantenimientoPreventivoId: routine.id },
              }))
            )
              await tx.programacionMantenimiento.create({
                data: {
                  busId: current.id,
                  planMantenimientoPreventivoId: routine.id,
                  tipo: routine.componente,
                  actividad: routine.actividad,
                  criterio: routine.criterio,
                  ...initialPreventiveTargets(routine, current.kilometrajeActual),
                  creadaPorId: admin.id,
                },
              })
          }
          return current
        })
        buses.push(bus)
      }
      const drivers = await Promise.all(
        company.turnos.map((shift) =>
          account(
            `conductor.${company.slug.toLowerCase()}.${shift.codigo.toLowerCase()}.demo@sgmv.local`,
            `Conductor ${company.slug} ${shift.codigo} · Simulado`,
            'CONDUCTOR',
          ),
        ),
      )
      for (const [monthIndex, month] of plan.meses.entries()) {
        const outcome = await runInPrismaTransaction(async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(14102026)`
          await tx.$queryRaw`SELECT id FROM buses WHERE id = ${buses[0]!.id} FOR UPDATE`
          for (const driver of [...drivers].sort((a, b) => a.id - b.id))
            await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${driver.id} FOR UPDATE`
          let created = 0
          let skipped = 0
          for (const [shiftIndex, shift] of company.turnos.entries()) {
            const slots = shift.meses[monthIndex]!.jornadas
            const driver = drivers[shiftIndex]!
            const existing = await tx.jornadaOperativa.findMany({
              where: {
                busId: buses[0]!.id,
                conductorId: driver.id,
                inicioProgramado: { in: slots.map((slot) => slot.inicioProgramado) },
              },
              select: { rutaId: true, inicioProgramado: true, finProgramado: true, estado: true },
            })
            const existingTimes = new Set(existing.map((row) => row.inicioProgramado.getTime()))
            for (const row of existing) {
              const expected = slots.find(
                (slot) => slot.inicioProgramado.getTime() === row.inicioProgramado.getTime(),
              )!
              if (
                row.rutaId !== route.id ||
                row.finProgramado.getTime() !== expected.finProgramado.getTime()
              )
                throw new Error('Un tramo del escenario fue modificado; no se sobrescribe')
            }
            const missing = slots.filter(
              (slot) => !existingTimes.has(slot.inicioProgramado.getTime()),
            )
            skipped += existing.length
            if (!missing.length) continue
            if (existing.length)
              throw new Error(
                'Período parcialmente modificado; requiere conciliación, no duplicación',
              )
            const preview = await service.previewPeriod(
              {
                busId: buses[0]!.id,
                conductorId: driver.id,
                rutaId: route.id,
                fechaInicio: month.fechaInicio,
                fechaFin: month.fechaFin,
                diasSemana: [1, 2, 3, 4, 5, 6],
                horaInicio: shift.horaInicio,
                horaFin: shift.horaFin,
              },
              dispatcher,
            )
            if (!preview.puedeConfirmar)
              throw new Error('La disponibilidad o la agenda impiden el período; revise conflictos')
            // Importación de escenario: mismas fechas validadas, integridad SQL y locks de recursos.
            // No crear recorridos, lecturas, consumos ni mantenimientos ejecutados en el futuro.
            await tx.jornadaOperativa.createMany({
              data: missing.map((slot) => ({
                busId: buses[0]!.id,
                conductorId: driver.id,
                rutaId: route.id,
                programadaPorId: dispatcher.id,
                inicioProgramado: slot.inicioProgramado,
                finProgramado: slot.finProgramado,
                estado: 'PROGRAMADA',
              })),
            })
            const firstCreated = await tx.jornadaOperativa.findFirstOrThrow({
              where: {
                busId: buses[0]!.id,
                conductorId: driver.id,
                inicioProgramado: missing[0]!.inicioProgramado,
              },
            })
            // Aviso de entrada al período, no miles de avisos de importación por cada fila futura.
            await createJourneyChangeAlert(
              {
                affectedDriverIds: [driver.id],
                eventAt: firstCreated.createdAt,
                journeyId: firstCreated.id,
                occurrence: `IMPORTACION_MENSUAL_${month.mes}`,
              },
              tx,
            )
            created += missing.length
          }
          if (created)
            await tx.eventoAuditoria.create({
              data: {
                accion: 'Carga de programación mensual simulada',
                requestId: randomUUID(),
                metodo: 'POST',
                ruta: 'demo:amb:horizonte',
                resultado: 'EXITO',
                statusHttp: 201,
                actorId: admin.id,
                detalles: {
                  empresa: company.empresa,
                  mes: month.mes,
                  origenDato: 'SIMULADO_SGMV',
                  jornadasCreadas: created,
                },
              },
            })
          return { created, skipped }
        })
        createdJourneys += outcome.created
        skippedJourneys += outcome.skipped
        console.log(
          JSON.stringify({
            empresa: company.slug,
            mes: month.mes,
            createdJourneys,
            skippedJourneys,
            total: plan.totalJornadas,
          }),
        )
      }
    }
    await runInPrismaTransaction(async (tx) => {
      for (const [index, name] of [
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
            nombre: `${name} · Simulado`,
            categoria: 'Escenario AMB simulado',
            unidadMedida: index === 1 ? 'LITRO' : 'UNIDAD',
            stockActual: 50,
            stockMinimo: 10,
            costoUnitario: 20_000 + index * 15_000,
            especificaciones: {
              origenDato: 'SIMULADO_SGMV',
              nota: 'Cantidad, precio y referencia académicos; no inventario empresarial',
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
            motivo: 'Saldo inicial simulado del escenario académico AMB',
          },
        })
        await tx.compatibilidadRepuesto.create({
          data: {
            repuestoId: part.id,
            modeloBusId: model!.id,
            version: 1,
            permitido: true,
            vigente: true,
            fechaDefinicion: new Date(),
            definidaPorId: admin.id,
            especificacionesValidadas: {
              origenDato: 'SIMULADO_SGMV',
              contexto: 'Compatibilidad de demostración, no homologación real',
            },
          },
        })
      }
    })
    console.log(
      JSON.stringify({
        complete: true,
        desde: plan.fechaInicio,
        hasta: plan.fechaFin,
        meses: plan.meses.length,
        empresas: plan.empresas.length,
        busesSimulados: plan.empresas.length * 2,
        createdJourneys,
        skippedJourneys,
        origenOperacion: plan.origenOperacion,
        mantenimientos:
          'Rutinas recurrentes de 7 y 30 días; siguientes ciclos tras ejecución y cierre validados',
      }),
    )
  } finally {
    await disconnectPrisma()
  }
}
