import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

const ids = {
  roles: {
    admin: '10000000-0000-4000-8000-000000000001',
    despachador: '10000000-0000-4000-8000-000000000004',
    mecanico: '10000000-0000-4000-8000-000000000002',
    conductor: '10000000-0000-4000-8000-000000000003',
  },
  usuarios: {
    admin: '20000000-0000-4000-8000-000000000001',
    despachador: '20000000-0000-4000-8000-000000000005',
    mecanico: '20000000-0000-4000-8000-000000000002',
    mecanicoApoyo: '20000000-0000-4000-8000-000000000004',
    conductor: '20000000-0000-4000-8000-000000000003',
  },
  buses: {
    principal: '30000000-0000-4000-8000-000000000001',
    respaldo: '30000000-0000-4000-8000-000000000002',
  },
  modelosBus: {
    principal: '31000000-0000-4000-8000-000000000001',
    respaldo: '31000000-0000-4000-8000-000000000002',
  },
  rutas: {
    centroNorte: '32000000-0000-4000-8000-000000000001',
    alternaInactiva: '32000000-0000-4000-8000-000000000002',
  },
  jornadas: {
    finalizada: '33000000-0000-4000-8000-000000000001',
    programada: '33000000-0000-4000-8000-000000000002',
  },
  lecturasJornada: {
    inicio: '34000000-0000-4000-8000-000000000001',
    fin: '34000000-0000-4000-8000-000000000002',
    novedad: '34000000-0000-4000-8000-000000000005',
  },
  lecturasTecnicas: {
    cierre: '34000000-0000-4000-8000-000000000006',
    ingreso: '34000000-0000-4000-8000-000000000003',
    revision: '34000000-0000-4000-8000-000000000004',
  },
  asignacion: '40000000-0000-4000-8000-000000000001',
  lecturaKilometraje: '41000000-0000-4000-8000-000000000001',
  busEstadoHistorial: '42000000-0000-4000-8000-000000000001',
  novedad: '50000000-0000-4000-8000-000000000001',
  programacion: '60000000-0000-4000-8000-000000000001',
  planPreventivoRecurrente: '61000000-0000-4000-8000-000000000001',
  programacionRecurrente: '62000000-0000-4000-8000-000000000001',
  ordenes: {
    correctiva: '70000000-0000-4000-8000-000000000001',
    preventiva: '70000000-0000-4000-8000-000000000002',
  },
  intervencion: '80000000-0000-4000-8000-000000000001',
  actividad: '81000000-0000-4000-8000-000000000001',
  estadosOrden: {
    correctivaCreada: '82000000-0000-4000-8000-000000000001',
    correctivaAsignada: '82000000-0000-4000-8000-000000000002',
    correctivaEjecucion: '82000000-0000-4000-8000-000000000003',
    correctivaCompletada: '82000000-0000-4000-8000-000000000004',
    correctivaCerrada: '82000000-0000-4000-8000-000000000006',
    preventivaCreada: '82000000-0000-4000-8000-000000000005',
  },
  repuesto: '90000000-0000-4000-8000-000000000001',
  compatibilidades: {
    modeloAnterior: '93000000-0000-4000-8000-000000000001',
    modeloVigente: '93000000-0000-4000-8000-000000000002',
    busAnterior: '93000000-0000-4000-8000-000000000003',
    busVigente: '93000000-0000-4000-8000-000000000004',
    negativaModelo: '93000000-0000-4000-8000-000000000005',
  },
  autorizacionExcepcion: '94000000-0000-4000-8000-000000000001',
  alertas: {
    novedadCritica: '96000000-0000-4000-8000-000000000001',
    ordenCompletada: '96000000-0000-4000-8000-000000000002',
  },
  alertasDestinatarios: {
    novedadAdmin: '97000000-0000-4000-8000-000000000001',
    novedadDespacho: '97000000-0000-4000-8000-000000000002',
    ordenAdmin: '97000000-0000-4000-8000-000000000003',
  },
  repuestosRf05: {
    agotado: '90000000-0000-4000-8000-000000000003',
    bajo: '90000000-0000-4000-8000-000000000002',
    inactivo: '90000000-0000-4000-8000-000000000004',
  },
  consumo: '91000000-0000-4000-8000-000000000001',
  movimientos: {
    entrada: '92000000-0000-4000-8000-000000000001',
    consumo: '92000000-0000-4000-8000-000000000002',
    entradaBajo: '92000000-0000-4000-8000-000000000003',
    ajusteBajo: '92000000-0000-4000-8000-000000000004',
    entradaInactivo: '92000000-0000-4000-8000-000000000005',
  },
}

async function main() {
  const demoPassword = process.env.SEED_USER_PASSWORD

  if (!demoPassword || demoPassword.length < 12) {
    throw new Error(
      'SEED_USER_PASSWORD debe estar configurada con minimo 12 caracteres para ejecutar el seed.',
    )
  }

  const contrasenaHash = await hash(demoPassword, 10)
  const now = new Date()
  const fechaPreventivo = new Date(Date.UTC(2026, 8, 2))

  await prisma.$transaction(
    async (tx) => {
      await tx.rol.upsert({
        where: { codigo: 'ADMINISTRADOR' },
        update: {
          nombre: 'Administrador',
          descripcion: 'Gestiona flota, novedades, preventivos, ordenes, repuestos e informes.',
        },
        create: {
          id: ids.roles.admin,
          codigo: 'ADMINISTRADOR',
          nombre: 'Administrador',
          descripcion: 'Gestiona flota, novedades, preventivos, ordenes, repuestos e informes.',
        },
      })

      await tx.rol.upsert({
        where: { codigo: 'MECANICO' },
        update: {
          nombre: 'Mecánico',
          descripcion: 'Ejecuta ordenes asignadas y registra actividades y consumos autorizados.',
        },
        create: {
          id: ids.roles.mecanico,
          codigo: 'MECANICO',
          nombre: 'Mecánico',
          descripcion: 'Ejecuta ordenes asignadas y registra actividades y consumos autorizados.',
        },
      })

      await tx.rol.upsert({
        where: { codigo: 'DESPACHADOR' },
        update: {
          nombre: 'Despachador',
          descripcion:
            'Coordina jornadas, asignaciones, disponibilidad, salidas, llegadas y alertas operativas.',
        },
        create: {
          id: ids.roles.despachador,
          codigo: 'DESPACHADOR',
          nombre: 'Despachador',
          descripcion:
            'Coordina jornadas, asignaciones, disponibilidad, salidas, llegadas y alertas operativas.',
        },
      })

      await tx.rol.upsert({
        where: { codigo: 'CONDUCTOR' },
        update: {
          nombre: 'Conductor',
          descripcion: 'Consulta su jornada y registra novedades operativas.',
        },
        create: {
          id: ids.roles.conductor,
          codigo: 'CONDUCTOR',
          nombre: 'Conductor',
          descripcion: 'Consulta su jornada y registra novedades operativas.',
        },
      })

      await tx.usuario.upsert({
        where: { email: 'administrador.demo@sgmv.local' },
        update: {
          nombre: 'Administrador Demo',
          contrasenaHash,
          estado: 'ACTIVO',
          rolId: ids.roles.admin,
        },
        create: {
          id: ids.usuarios.admin,
          nombre: 'Administrador Demo',
          email: 'administrador.demo@sgmv.local',
          telefono: '3000000001',
          contrasenaHash,
          estado: 'ACTIVO',
          rolId: ids.roles.admin,
        },
      })

      await tx.usuario.upsert({
        where: { email: 'despachador.demo@sgmv.local' },
        update: {
          nombre: 'Despachador Demo',
          contrasenaHash,
          estado: 'ACTIVO',
          rolId: ids.roles.despachador,
        },
        create: {
          id: ids.usuarios.despachador,
          nombre: 'Despachador Demo',
          email: 'despachador.demo@sgmv.local',
          telefono: '3000000005',
          contrasenaHash,
          estado: 'ACTIVO',
          rolId: ids.roles.despachador,
        },
      })

      await tx.usuario.upsert({
        where: { email: 'mecanico.demo@sgmv.local' },
        update: {
          nombre: 'Mecanico Demo',
          contrasenaHash,
          estado: 'ACTIVO',
          rolId: ids.roles.mecanico,
        },
        create: {
          id: ids.usuarios.mecanico,
          nombre: 'Mecanico Demo',
          email: 'mecanico.demo@sgmv.local',
          telefono: '3000000002',
          contrasenaHash,
          estado: 'ACTIVO',
          rolId: ids.roles.mecanico,
        },
      })

      await tx.usuario.upsert({
        where: { email: 'mecanico.apoyo.demo@sgmv.local' },
        update: {
          nombre: 'Mecanico Apoyo Demo',
          contrasenaHash,
          estado: 'ACTIVO',
          rolId: ids.roles.mecanico,
        },
        create: {
          id: ids.usuarios.mecanicoApoyo,
          nombre: 'Mecanico Apoyo Demo',
          email: 'mecanico.apoyo.demo@sgmv.local',
          telefono: '3000000004',
          contrasenaHash,
          estado: 'ACTIVO',
          rolId: ids.roles.mecanico,
        },
      })

      await tx.usuario.upsert({
        where: { email: 'conductor.demo@sgmv.local' },
        update: {
          nombre: 'Conductor Demo',
          contrasenaHash,
          estado: 'ACTIVO',
          rolId: ids.roles.conductor,
        },
        create: {
          id: ids.usuarios.conductor,
          nombre: 'Conductor Demo',
          email: 'conductor.demo@sgmv.local',
          telefono: '3000000003',
          contrasenaHash,
          estado: 'ACTIVO',
          rolId: ids.roles.conductor,
        },
      })

      await tx.modeloBus.upsert({
        where: { id: ids.modelosBus.principal },
        update: {
          activo: true,
          especificaciones: {
            combustible: 'Diesel',
            configuracion: 'Bus urbano',
          },
          marca: 'Mercedes-Benz',
          nombreModelo: 'OF-1721',
          versionTecnica: 'Euro V',
        },
        create: {
          id: ids.modelosBus.principal,
          activo: true,
          especificaciones: {
            combustible: 'Diesel',
            configuracion: 'Bus urbano',
          },
          marca: 'Mercedes-Benz',
          nombreModelo: 'OF-1721',
          versionTecnica: 'Euro V',
        },
      })

      await tx.modeloBus.upsert({
        where: { id: ids.modelosBus.respaldo },
        update: {
          activo: true,
          especificaciones: {
            combustible: 'Diesel',
            configuracion: 'Bus urbano',
          },
          marca: 'Volkswagen',
          nombreModelo: '17-230',
          versionTecnica: 'OD',
        },
        create: {
          id: ids.modelosBus.respaldo,
          activo: true,
          especificaciones: {
            combustible: 'Diesel',
            configuracion: 'Bus urbano',
          },
          marca: 'Volkswagen',
          nombreModelo: '17-230',
          versionTecnica: 'OD',
        },
      })

      await tx.ruta.upsert({
        where: { codigo: 'RUTA-CENTRO-NORTE' },
        update: {
          activa: true,
          destino: 'Terminal Norte',
          nombre: 'Centro - Norte',
          origen: 'Patio Central',
        },
        create: {
          id: ids.rutas.centroNorte,
          activa: true,
          codigo: 'RUTA-CENTRO-NORTE',
          destino: 'Terminal Norte',
          nombre: 'Centro - Norte',
          origen: 'Patio Central',
        },
      })

      await tx.ruta.upsert({
        where: { codigo: 'RUTA-ALTERNA-DEMO' },
        update: {
          activa: false,
          destino: 'Terminal Sur',
          nombre: 'Alterna demo inactiva',
          origen: 'Patio Central',
        },
        create: {
          id: ids.rutas.alternaInactiva,
          activa: false,
          codigo: 'RUTA-ALTERNA-DEMO',
          destino: 'Terminal Sur',
          nombre: 'Alterna demo inactiva',
          origen: 'Patio Central',
        },
      })

      await tx.bus.upsert({
        where: { codigoInterno: 'BUS-001' },
        update: {
          placa: 'SGM001',
          marca: 'Mercedes-Benz',
          modelo: 'OF-1721',
          anio: 2020,
          kilometrajeActual: 45200,
          estadoOperativo: 'OPERATIVO',
          modeloBusId: ids.modelosBus.principal,
        },
        create: {
          id: ids.buses.principal,
          codigoInterno: 'BUS-001',
          placa: 'SGM001',
          marca: 'Mercedes-Benz',
          modelo: 'OF-1721',
          anio: 2020,
          kilometrajeActual: 45200,
          estadoOperativo: 'OPERATIVO',
          modeloBusId: ids.modelosBus.principal,
        },
      })

      await tx.bus.upsert({
        where: { codigoInterno: 'BUS-002' },
        update: {
          placa: 'SGM002',
          marca: 'Volkswagen',
          modelo: '17-230',
          anio: 2019,
          kilometrajeActual: 58750,
          estadoOperativo: 'EN_MANTENIMIENTO',
          modeloBusId: ids.modelosBus.respaldo,
        },
        create: {
          id: ids.buses.respaldo,
          codigoInterno: 'BUS-002',
          placa: 'SGM002',
          marca: 'Volkswagen',
          modelo: '17-230',
          anio: 2019,
          kilometrajeActual: 58750,
          estadoOperativo: 'EN_MANTENIMIENTO',
          modeloBusId: ids.modelosBus.respaldo,
        },
      })

      await tx.asignacionConductor.upsert({
        where: { id: ids.asignacion },
        update: {
          activa: true,
          fechaFin: null,
          conductorId: ids.usuarios.conductor,
          busId: ids.buses.principal,
          asignadoPorId: ids.usuarios.admin,
        },
        create: {
          id: ids.asignacion,
          conductorId: ids.usuarios.conductor,
          busId: ids.buses.principal,
          activa: true,
          asignadoPorId: ids.usuarios.admin,
          motivo: 'Asignacion inicial de desarrollo.',
        },
      })

      await tx.lecturaKilometraje.upsert({
        where: { id: ids.lecturaKilometraje },
        update: {
          kilometrajeAnterior: 45210,
          kilometrajeNuevo: 45210,
          registradoPorId: ids.usuarios.admin,
        },
        create: {
          id: ids.lecturaKilometraje,
          busId: ids.buses.principal,
          kilometrajeAnterior: 45210,
          kilometrajeNuevo: 45210,
          registradoPorId: ids.usuarios.admin,
          motivo: 'Lectura inicial de desarrollo.',
        },
      })

      const jornadaFinalizada = {
        inicioProgramado: new Date('2026-09-01T12:00:00.000Z'),
        finProgramado: new Date('2026-09-01T20:00:00.000Z'),
        inicioReal: new Date('2026-09-01T12:05:00.000Z'),
        finReal: new Date('2026-09-01T19:55:00.000Z'),
      }

      await tx.jornadaOperativa.upsert({
        where: { id: ids.jornadas.finalizada },
        update: {},
        create: {
          id: ids.jornadas.finalizada,
          busId: ids.buses.principal,
          conductorId: ids.usuarios.conductor,
          rutaId: ids.rutas.centroNorte,
          estado: 'FINALIZADA',
          inicioProgramado: jornadaFinalizada.inicioProgramado,
          finProgramado: jornadaFinalizada.finProgramado,
          inicioReal: jornadaFinalizada.inicioReal,
          finReal: jornadaFinalizada.finReal,
          programadaPorId: ids.usuarios.despachador,
          iniciadaPorId: ids.usuarios.conductor,
          finalizadaPorId: ids.usuarios.conductor,
        },
      })

      await tx.lecturaKilometraje.upsert({
        where: { id: ids.lecturasJornada.inicio },
        update: {
          kilometrajeAnterior: 44900,
          kilometrajeNuevo: 44900,
          registradoPorId: ids.usuarios.conductor,
          fechaLectura: jornadaFinalizada.inicioReal,
        },
        create: {
          id: ids.lecturasJornada.inicio,
          busId: ids.buses.principal,
          kilometrajeAnterior: 44900,
          kilometrajeNuevo: 44900,
          registradoPorId: ids.usuarios.conductor,
          fechaRegistro: jornadaFinalizada.inicioReal,
          fechaLectura: jornadaFinalizada.inicioReal,
          tipo: 'INICIO_JORNADA',
          jornadaOperativaId: ids.jornadas.finalizada,
          motivo: 'Inicio de jornada operativa demo.',
        },
      })

      await tx.lecturaKilometraje.upsert({
        where: { id: ids.lecturasJornada.fin },
        update: {
          kilometrajeAnterior: 44980,
          kilometrajeNuevo: 45000,
          registradoPorId: ids.usuarios.conductor,
          fechaLectura: jornadaFinalizada.finReal,
        },
        create: {
          id: ids.lecturasJornada.fin,
          busId: ids.buses.principal,
          kilometrajeAnterior: 44980,
          kilometrajeNuevo: 45000,
          registradoPorId: ids.usuarios.conductor,
          fechaRegistro: jornadaFinalizada.finReal,
          fechaLectura: jornadaFinalizada.finReal,
          tipo: 'FIN_JORNADA',
          jornadaOperativaId: ids.jornadas.finalizada,
          motivo: 'Fin de jornada operativa demo.',
        },
      })

      const fechaNovedad = new Date('2026-09-01T18:30:00.000Z')
      await tx.lecturaKilometraje.upsert({
        where: { id: ids.lecturasJornada.novedad },
        update: {
          fechaLectura: fechaNovedad,
          jornadaOperativaId: ids.jornadas.finalizada,
          kilometrajeAnterior: 44900,
          kilometrajeNuevo: 44980,
          registradoPorId: ids.usuarios.conductor,
          tipo: 'NOVEDAD',
        },
        create: {
          id: ids.lecturasJornada.novedad,
          busId: ids.buses.principal,
          fechaRegistro: fechaNovedad,
          fechaLectura: fechaNovedad,
          jornadaOperativaId: ids.jornadas.finalizada,
          kilometrajeAnterior: 44900,
          kilometrajeNuevo: 44980,
          motivo: 'Kilometraje al reportar la novedad operativa demo.',
          registradoPorId: ids.usuarios.conductor,
          tipo: 'NOVEDAD',
        },
      })

      await tx.jornadaOperativa.upsert({
        where: { id: ids.jornadas.programada },
        update: {},
        create: {
          id: ids.jornadas.programada,
          busId: ids.buses.principal,
          conductorId: ids.usuarios.conductor,
          rutaId: ids.rutas.centroNorte,
          estado: 'PROGRAMADA',
          inicioProgramado: new Date('2026-09-06T12:00:00.000Z'),
          finProgramado: new Date('2026-09-06T20:00:00.000Z'),
          programadaPorId: ids.usuarios.despachador,
        },
      })

      await tx.busEstadoHistorial.upsert({
        where: { id: ids.busEstadoHistorial },
        update: {
          estadoNuevo: 'OPERATIVO',
          cambiadoPorId: ids.usuarios.admin,
        },
        create: {
          id: ids.busEstadoHistorial,
          busId: ids.buses.principal,
          estadoAnterior: null,
          estadoNuevo: 'OPERATIVO',
          cambiadoPorId: ids.usuarios.admin,
          motivo: 'Estado inicial de desarrollo.',
        },
      })

      await tx.novedad.upsert({
        where: { id: ids.novedad },
        update: {
          estado: 'CONVERTIDA_A_ORDEN',
          revisadaPorId: ids.usuarios.admin,
          fechaRevision: now,
          observacionRevision: 'Convertida a orden correctiva demo.',
          jornadaOperativaId: ids.jornadas.finalizada,
          lecturaKilometrajeId: ids.lecturasJornada.novedad,
          fechaOcurrencia: fechaNovedad,
          afectaOperacion: true,
          bloqueaDisponibilidad: true,
        },
        create: {
          id: ids.novedad,
          conductorId: ids.usuarios.conductor,
          busId: ids.buses.principal,
          tipo: 'Falla operacional',
          descripcion: 'Vibracion inusual durante el frenado.',
          clasificacion: 'Sistema de frenos',
          estado: 'CONVERTIDA_A_ORDEN',
          revisadaPorId: ids.usuarios.admin,
          fechaRevision: now,
          observacionRevision: 'Convertida a orden correctiva demo.',
          jornadaOperativaId: ids.jornadas.finalizada,
          lecturaKilometrajeId: ids.lecturasJornada.novedad,
          fechaOcurrencia: fechaNovedad,
          afectaOperacion: true,
          bloqueaDisponibilidad: true,
        },
      })

      await tx.programacionMantenimiento.upsert({
        where: { id: ids.programacion },
        update: {
          criterio: 'FECHA_KILOMETRAJE',
          fechaProgramada: fechaPreventivo,
          kilometrajeObjetivo: 45500,
          activa: true,
        },
        create: {
          id: ids.programacion,
          busId: ids.buses.principal,
          tipo: 'Revision preventiva',
          actividad: 'Revision general de frenos y lubricacion.',
          criterio: 'FECHA_KILOMETRAJE',
          fechaProgramada: fechaPreventivo,
          kilometrajeObjetivo: 45500,
          activa: true,
          creadaPorId: ids.usuarios.admin,
        },
      })

      await tx.planMantenimientoPreventivo.upsert({
        where: { id: ids.planPreventivoRecurrente },
        update: { activo: true },
        create: {
          id: ids.planPreventivoRecurrente,
          activo: true,
          actividad: 'Cambio recurrente de aceite y filtro del motor.',
          anticipacionDias: null,
          anticipacionKm: 500,
          bloqueaAlVencer: true,
          busId: ids.buses.respaldo,
          claveTarea: 'MOTOR.ACEITE.RECURRENTE',
          componente: 'Motor y lubricacion',
          creadoPorId: ids.usuarios.admin,
          criterio: 'KILOMETRAJE',
          intervaloDias: null,
          intervaloKm: 5000,
          modeloBusId: null,
          prioridad: 'ALTA',
          version: 1,
        },
      })

      await tx.programacionMantenimiento.upsert({
        where: { id: ids.programacionRecurrente },
        update: {
          activa: true,
          actividad: 'Cambio recurrente de aceite y filtro del motor.',
          criterio: 'KILOMETRAJE',
          fechaProgramada: null,
          kilometrajeObjetivo: 63750,
          planMantenimientoPreventivoId: ids.planPreventivoRecurrente,
          prioridad: 'ALTA',
          tipo: 'Motor y lubricacion',
        },
        create: {
          id: ids.programacionRecurrente,
          activa: true,
          actividad: 'Cambio recurrente de aceite y filtro del motor.',
          busId: ids.buses.respaldo,
          creadaPorId: ids.usuarios.admin,
          criterio: 'KILOMETRAJE',
          kilometrajeObjetivo: 63750,
          planMantenimientoPreventivoId: ids.planPreventivoRecurrente,
          prioridad: 'ALTA',
          tipo: 'Motor y lubricacion',
        },
      })

      const fechaCorrectivaCreacion = new Date('2026-09-02T12:00:00.000Z')
      const fechaCorrectivaAsignacion = new Date(fechaCorrectivaCreacion.getTime() + 1000)
      const fechaCorrectivaInicio = new Date(fechaCorrectivaCreacion.getTime() + 2000)
      const fechaCorrectivaCompletada = new Date(fechaCorrectivaCreacion.getTime() + 3000)
      const fechaCorrectivaCierre = new Date(fechaCorrectivaCreacion.getTime() + 4000)

      await tx.ordenTrabajo.upsert({
        where: { codigo: 'OT-DEMO-CORR-001' },
        update: {
          cerradaPorId: ids.usuarios.admin,
          disponibilidadAlCierre: true,
          estado: 'CERRADA',
          tecnicoAsignadoId: ids.usuarios.mecanico,
          fechaCreacion: fechaCorrectivaCreacion,
          fechaAsignacion: fechaCorrectivaAsignacion,
          fechaInicioEjecucion: fechaCorrectivaInicio,
          fechaCompletadaTecnico: fechaCorrectivaCompletada,
          fechaCierre: fechaCorrectivaCierre,
          jornadaOperativaId: ids.jornadas.finalizada,
        },
        create: {
          id: ids.ordenes.correctiva,
          codigo: 'OT-DEMO-CORR-001',
          busId: ids.buses.principal,
          tipo: 'CORRECTIVA',
          origen: 'NOVEDAD',
          prioridad: 'ALTA',
          descripcion: 'Revision correctiva por vibracion en frenado.',
          estado: 'EN_EJECUCION',
          tecnicoAsignadoId: ids.usuarios.mecanico,
          creadaPorId: ids.usuarios.admin,
          fechaCreacion: fechaCorrectivaCreacion,
          fechaAsignacion: fechaCorrectivaAsignacion,
          fechaInicioEjecucion: fechaCorrectivaInicio,
          jornadaOperativaId: ids.jornadas.finalizada,
          novedadId: ids.novedad,
        },
      })

      const fechaPreventivaCreacion = new Date('2026-09-02T13:00:00.000Z')
      const fechaPreventivaAsignacion = new Date(fechaPreventivaCreacion.getTime() + 1000)

      await tx.ordenTrabajo.upsert({
        where: { codigo: 'OT-DEMO-PREV-001' },
        update: {
          estado: 'ASIGNADA',
          tecnicoAsignadoId: ids.usuarios.mecanico,
          fechaCreacion: fechaPreventivaCreacion,
          fechaAsignacion: fechaPreventivaAsignacion,
          fechaObjetivoPreventivo: fechaPreventivo,
          kilometrajeObjetivoPreventivo: 45500,
        },
        create: {
          id: ids.ordenes.preventiva,
          codigo: 'OT-DEMO-PREV-001',
          busId: ids.buses.principal,
          tipo: 'PREVENTIVA',
          origen: 'PREVENTIVO',
          prioridad: 'MEDIA',
          descripcion: 'Orden preventiva demo generada desde programacion vigente/proxima.',
          estado: 'ASIGNADA',
          tecnicoAsignadoId: ids.usuarios.mecanico,
          creadaPorId: ids.usuarios.admin,
          fechaCreacion: fechaPreventivaCreacion,
          fechaAsignacion: fechaPreventivaAsignacion,
          programacionMantenimientoId: ids.programacion,
          fechaObjetivoPreventivo: fechaPreventivo,
          kilometrajeObjetivoPreventivo: 45500,
        },
      })

      await tx.intervencion.upsert({
        where: { id: ids.intervencion },
        update: {
          diagnostico: 'Se identifica desgaste en componente de freno.',
          observaciones: 'Trabajo tecnico demo completado.',
          fechaFin: fechaCorrectivaCompletada,
        },
        create: {
          id: ids.intervencion,
          ordenTrabajoId: ids.ordenes.correctiva,
          tecnicoId: ids.usuarios.mecanico,
          fechaInicio: fechaCorrectivaInicio,
          fechaFin: null,
          diagnostico: 'Se identifica desgaste en componente de freno.',
          observaciones: 'Trabajo tecnico demo completado.',
        },
      })

      await tx.actividadOrden.upsert({
        where: { id: ids.actividad },
        update: {
          descripcion: 'Inspeccion, ajuste y prueba de frenado.',
        },
        create: {
          id: ids.actividad,
          intervencionId: ids.intervencion,
          descripcion: 'Inspeccion, ajuste y prueba de frenado.',
          registradaPorId: ids.usuarios.mecanico,
        },
      })

      await tx.lecturaKilometraje.upsert({
        where: { id: ids.lecturasTecnicas.ingreso },
        update: {
          fechaLectura: fechaCorrectivaAsignacion,
          kilometrajeAnterior: 45200,
          kilometrajeNuevo: 45200,
          ordenTrabajoId: ids.ordenes.correctiva,
          registradoPorId: ids.usuarios.mecanico,
          tipo: 'INGRESO_TALLER',
        },
        create: {
          id: ids.lecturasTecnicas.ingreso,
          busId: ids.buses.principal,
          fechaLectura: fechaCorrectivaAsignacion,
          kilometrajeAnterior: 45200,
          kilometrajeNuevo: 45200,
          motivo: 'Ingreso al taller del escenario P7.',
          ordenTrabajoId: ids.ordenes.correctiva,
          registradoPorId: ids.usuarios.mecanico,
          tipo: 'INGRESO_TALLER',
        },
      })

      await tx.lecturaKilometraje.upsert({
        where: { id: ids.lecturasTecnicas.revision },
        update: {
          fechaLectura: new Date(fechaCorrectivaInicio.getTime() + 500),
          intervencionId: ids.intervencion,
          kilometrajeAnterior: 45200,
          kilometrajeNuevo: 45210,
          ordenTrabajoId: ids.ordenes.correctiva,
          registradoPorId: ids.usuarios.mecanico,
          tipo: 'REVISION_TECNICA',
        },
        create: {
          id: ids.lecturasTecnicas.revision,
          busId: ids.buses.principal,
          fechaLectura: new Date(fechaCorrectivaInicio.getTime() + 500),
          intervencionId: ids.intervencion,
          kilometrajeAnterior: 45200,
          kilometrajeNuevo: 45210,
          motivo: 'Revision tecnica durante la intervencion P7.',
          ordenTrabajoId: ids.ordenes.correctiva,
          registradoPorId: ids.usuarios.mecanico,
          tipo: 'REVISION_TECNICA',
        },
      })

      await tx.lecturaKilometraje.upsert({
        where: { id: ids.lecturasTecnicas.cierre },
        update: {
          fechaLectura: fechaCorrectivaCierre,
          kilometrajeAnterior: 45210,
          kilometrajeNuevo: 45210,
          ordenTrabajoId: ids.ordenes.correctiva,
          registradoPorId: ids.usuarios.admin,
          tipo: 'CIERRE_MANTENIMIENTO',
        },
        create: {
          id: ids.lecturasTecnicas.cierre,
          busId: ids.buses.principal,
          fechaLectura: fechaCorrectivaCierre,
          kilometrajeAnterior: 45210,
          kilometrajeNuevo: 45210,
          motivo: 'Lectura administrativa de cierre para el historial P10.',
          ordenTrabajoId: ids.ordenes.correctiva,
          registradoPorId: ids.usuarios.admin,
          tipo: 'CIERRE_MANTENIMIENTO',
        },
      })

      await tx.bus.update({
        where: { id: ids.buses.principal },
        data: { kilometrajeActual: 45210 },
      })

      await tx.repuesto.upsert({
        where: { codigo: 'REP-FRENO-001' },
        update: {
          nombre: 'Pastilla de freno',
          categoria: 'Frenos',
          unidadMedida: 'unidad',
          stockActual: '8',
          stockMinimo: '2',
          costoUnitario: '80000',
          estado: 'ACTIVO',
          dimensiones: { largoMm: 320, anchoMm: 145, altoMm: 18 },
          especificaciones: { material: 'Ceramica reforzada', eje: 'Delantero' },
          fabricante: 'Frenos Andinos',
          numeroParte: 'FA-OF1721-001',
        },
        create: {
          id: ids.repuesto,
          codigo: 'REP-FRENO-001',
          nombre: 'Pastilla de freno',
          categoria: 'Frenos',
          unidadMedida: 'unidad',
          stockActual: '8',
          stockMinimo: '2',
          costoUnitario: '80000',
          estado: 'ACTIVO',
          dimensiones: { largoMm: 320, anchoMm: 145, altoMm: 18 },
          especificaciones: { material: 'Ceramica reforzada', eje: 'Delantero' },
          fabricante: 'Frenos Andinos',
          numeroParte: 'FA-OF1721-001',
        },
      })

      const compatibilityRows = [
        {
          id: ids.compatibilidades.modeloAnterior,
          modeloBusId: ids.modelosBus.principal,
          permitido: false,
          version: 1,
          vigente: false,
          especificacionesValidadas: { homologacion: 'historica', fuente: 'catalogo-2025' },
          condicionUso: 'No usar; version historica.',
        },
        {
          id: ids.compatibilidades.modeloVigente,
          modeloBusId: ids.modelosBus.principal,
          permitido: true,
          version: 2,
          vigente: true,
          especificacionesValidadas: { homologacion: 'OF-1721-Euro-V', fuente: 'fabricante' },
          condicionUso: 'Instalar en eje delantero y verificar desgaste.',
        },
        {
          id: ids.compatibilidades.busAnterior,
          busId: ids.buses.principal,
          permitido: false,
          version: 1,
          vigente: false,
          especificacionesValidadas: { homologacion: 'version anterior', fuente: 'inspeccion' },
          condicionUso: 'No usar; regla reemplazada.',
        },
        {
          id: ids.compatibilidades.busVigente,
          busId: ids.buses.principal,
          permitido: true,
          version: 2,
          vigente: true,
          especificacionesValidadas: { homologacion: 'BUS-001', fuente: 'inspeccion' },
          condicionUso: 'Compatible solo con la configuracion vigente del BUS-001.',
        },
        {
          id: ids.compatibilidades.negativaModelo,
          modeloBusId: ids.modelosBus.respaldo,
          permitido: false,
          version: 1,
          vigente: true,
          especificacionesValidadas: { homologacion: '17-230', fuente: 'fabricante' },
          condicionUso: 'Requiere repuesto alternativo homologado.',
        },
      ]

      for (const row of compatibilityRows) {
        await tx.compatibilidadRepuesto.upsert({
          where: { id: row.id },
          update: {
            busId: row.busId ?? null,
            condicionUso: row.condicionUso,
            definidaPorId: ids.usuarios.admin,
            especificacionesValidadas: row.especificacionesValidadas,
            fechaDefinicion: new Date('2026-08-20T12:00:00.000Z'),
            modeloBusId: row.modeloBusId ?? null,
            permitido: row.permitido,
            repuestoId: ids.repuesto,
            version: row.version,
            vigente: row.vigente,
          },
          create: {
            busId: row.busId ?? null,
            condicionUso: row.condicionUso,
            definidaPorId: ids.usuarios.admin,
            especificacionesValidadas: row.especificacionesValidadas,
            fechaDefinicion: new Date('2026-08-20T12:00:00.000Z'),
            id: row.id,
            modeloBusId: row.modeloBusId ?? null,
            permitido: row.permitido,
            repuestoId: ids.repuesto,
            version: row.version,
            vigente: row.vigente,
          },
        })
      }

      await tx.repuesto.upsert({
        where: { codigo: 'REP-FILTRO-001' },
        update: {
          nombre: 'Filtro de aceite',
          categoria: 'Motor',
          unidadMedida: 'unidad',
          stockActual: '1',
          stockMinimo: '2',
          costoUnitario: '45000',
          estado: 'ACTIVO',
        },
        create: {
          id: ids.repuestosRf05.bajo,
          codigo: 'REP-FILTRO-001',
          nombre: 'Filtro de aceite',
          categoria: 'Motor',
          unidadMedida: 'unidad',
          stockActual: '1',
          stockMinimo: '2',
          costoUnitario: '45000',
          estado: 'ACTIVO',
        },
      })

      await tx.repuesto.upsert({
        where: { codigo: 'REP-ACEITE-001' },
        update: {
          nombre: 'Aceite motor 15W40',
          categoria: 'Lubricantes',
          unidadMedida: 'litro',
          stockActual: '0',
          stockMinimo: '3',
          costoUnitario: '32000',
          estado: 'ACTIVO',
        },
        create: {
          id: ids.repuestosRf05.agotado,
          codigo: 'REP-ACEITE-001',
          nombre: 'Aceite motor 15W40',
          categoria: 'Lubricantes',
          unidadMedida: 'litro',
          stockActual: '0',
          stockMinimo: '3',
          costoUnitario: '32000',
          estado: 'ACTIVO',
        },
      })

      await tx.repuesto.upsert({
        where: { codigo: 'REP-BANDA-001' },
        update: {
          nombre: 'Banda de alternador',
          categoria: 'Motor',
          unidadMedida: 'unidad',
          stockActual: '3',
          stockMinimo: '1',
          costoUnitario: '120000',
          estado: 'INACTIVO',
        },
        create: {
          id: ids.repuestosRf05.inactivo,
          codigo: 'REP-BANDA-001',
          nombre: 'Banda de alternador',
          categoria: 'Motor',
          unidadMedida: 'unidad',
          stockActual: '3',
          stockMinimo: '1',
          costoUnitario: '120000',
          estado: 'INACTIVO',
        },
      })

      await tx.movimientoInventario.upsert({
        where: { id: ids.movimientos.entrada },
        update: {
          cantidad: '10',
          costoUnitario: '80000',
          motivo: 'Entrada inicial de desarrollo.',
        },
        create: {
          id: ids.movimientos.entrada,
          repuestoId: ids.repuesto,
          tipo: 'ENTRADA',
          cantidad: '10',
          costoUnitario: '80000',
          motivo: 'Entrada inicial de desarrollo.',
          responsableId: ids.usuarios.admin,
        },
      })

      await tx.movimientoInventario.upsert({
        where: { id: ids.movimientos.entradaBajo },
        update: {
          cantidad: '2',
          costoUnitario: '45000',
          motivo: 'Entrada inicial RF-05 para evidencia de bajo stock.',
        },
        create: {
          id: ids.movimientos.entradaBajo,
          repuestoId: ids.repuestosRf05.bajo,
          tipo: 'ENTRADA',
          cantidad: '2',
          costoUnitario: '45000',
          motivo: 'Entrada inicial RF-05 para evidencia de bajo stock.',
          responsableId: ids.usuarios.admin,
        },
      })

      await tx.movimientoInventario.upsert({
        where: { id: ids.movimientos.ajusteBajo },
        update: {
          cantidad: '1',
          costoUnitario: '45000',
          motivo: 'Ajuste de salida RF-05 por conteo fisico demo.',
        },
        create: {
          id: ids.movimientos.ajusteBajo,
          repuestoId: ids.repuestosRf05.bajo,
          tipo: 'AJUSTE_SALIDA',
          cantidad: '1',
          costoUnitario: '45000',
          motivo: 'Ajuste de salida RF-05 por conteo fisico demo.',
          responsableId: ids.usuarios.admin,
        },
      })

      await tx.movimientoInventario.upsert({
        where: { id: ids.movimientos.entradaInactivo },
        update: {
          cantidad: '3',
          costoUnitario: '120000',
          motivo: 'Entrada inicial antes de desactivacion demo RF-05.',
        },
        create: {
          id: ids.movimientos.entradaInactivo,
          repuestoId: ids.repuestosRf05.inactivo,
          tipo: 'ENTRADA',
          cantidad: '3',
          costoUnitario: '120000',
          motivo: 'Entrada inicial antes de desactivacion demo RF-05.',
          responsableId: ids.usuarios.admin,
        },
      })

      const seedCompatibilityEvidence = {
        busId: ids.buses.principal,
        condicionUso: 'Compatible solo con la configuracion vigente del BUS-001.',
        destino: 'BUS',
        dimensionesRepuesto: { largoMm: 320, anchoMm: 145, altoMm: 18 },
        evaluadoAt: '2026-09-02T12:00:05.000Z',
        especificacionesRepuesto: { material: 'Ceramica reforzada', eje: 'Delantero' },
        especificacionesValidadas: { homologacion: 'BUS-001', fuente: 'inspeccion' },
        fabricanteRepuesto: 'Frenos Andinos',
        modeloBusId: ids.modelosBus.principal,
        numeroParteRepuesto: 'FA-OF1721-001',
        permitido: true,
        precedencia: 'BUS',
        repuestoId: ids.repuesto,
        reglaId: ids.compatibilidades.busVigente,
        reglaVersion: 2,
        schemaVersion: 1,
      }

      const existingSeedConsumption = await tx.consumoRepuesto.findUnique({
        select: { id: true },
        where: { id: ids.consumo },
      })

      if (!existingSeedConsumption) {
        await tx.consumoRepuesto.create({
          data: {
            id: ids.consumo,
            ordenTrabajoId: ids.ordenes.correctiva,
            repuestoId: ids.repuesto,
            cantidad: '2',
            claveIdempotencia: '95000000-0000-4000-8000-000000000001',
            costoUnitario: '80000',
            subtotal: '160000',
            consumidoPorId: ids.usuarios.mecanico,
            intervencionId: ids.intervencion,
            fechaConsumo: new Date('2026-09-02T12:00:05.000Z'),
            resultadoCompatibilidad: 'COMPATIBLE',
            reglaCompatibilidadId: ids.compatibilidades.busVigente,
            reglaVersion: 2,
            evidenciaCompatibilidad: seedCompatibilityEvidence,
          },
        })
      }

      await tx.autorizacionExcepcionConsumo.upsert({
        where: { id: ids.autorizacionExcepcion },
        update: {
          cantidadMaxima: '1.00',
          estado: 'VIGENTE',
          fechaAutorizacion: new Date('2026-09-02T12:00:10.000Z'),
          fechaExpiracion: new Date('2026-12-31T23:59:59.000Z'),
          intervencionId: ids.intervencion,
          motivo: 'Autorizacion demo para repuesto sin evidencia positiva.',
          ordenTrabajoId: ids.ordenes.correctiva,
          repuestoId: ids.repuestosRf05.bajo,
          autorizadoPorId: ids.usuarios.admin,
        },
        create: {
          id: ids.autorizacionExcepcion,
          cantidadMaxima: '1.00',
          estado: 'VIGENTE',
          fechaAutorizacion: new Date('2026-09-02T12:00:10.000Z'),
          fechaExpiracion: new Date('2026-12-31T23:59:59.000Z'),
          intervencionId: ids.intervencion,
          motivo: 'Autorizacion demo para repuesto sin evidencia positiva.',
          ordenTrabajoId: ids.ordenes.correctiva,
          repuestoId: ids.repuestosRf05.bajo,
          autorizadoPorId: ids.usuarios.admin,
        },
      })

      await tx.movimientoInventario.upsert({
        where: { id: ids.movimientos.consumo },
        update: {
          cantidad: '2',
          costoUnitario: '80000',
          consumoRepuestoId: ids.consumo,
        },
        create: {
          id: ids.movimientos.consumo,
          repuestoId: ids.repuesto,
          tipo: 'CONSUMO',
          cantidad: '2',
          costoUnitario: '80000',
          motivo: 'Consumo asociado a orden correctiva demo.',
          responsableId: ids.usuarios.mecanico,
          consumoRepuestoId: ids.consumo,
        },
      })

      const estadoHistorial = [
        {
          id: ids.estadosOrden.correctivaCreada,
          ordenTrabajoId: ids.ordenes.correctiva,
          estadoAnterior: null,
          estadoNuevo: 'PENDIENTE_ASIGNACION' as const,
          observacion: 'Orden correctiva creada desde novedad.',
        },
        {
          id: ids.estadosOrden.correctivaAsignada,
          ordenTrabajoId: ids.ordenes.correctiva,
          estadoAnterior: 'PENDIENTE_ASIGNACION' as const,
          estadoNuevo: 'ASIGNADA' as const,
          observacion: 'Orden asignada al mecanico demo.',
        },
        {
          id: ids.estadosOrden.correctivaEjecucion,
          ordenTrabajoId: ids.ordenes.correctiva,
          estadoAnterior: 'ASIGNADA' as const,
          estadoNuevo: 'EN_EJECUCION' as const,
          observacion: 'Inicio de ejecucion tecnica demo.',
        },
        {
          id: ids.estadosOrden.correctivaCompletada,
          ordenTrabajoId: ids.ordenes.correctiva,
          estadoAnterior: 'EN_EJECUCION' as const,
          estadoNuevo: 'COMPLETADA_TECNICO' as const,
          observacion: 'Trabajo marcado como completado por tecnico demo.',
        },
        {
          id: ids.estadosOrden.correctivaCerrada,
          ordenTrabajoId: ids.ordenes.correctiva,
          estadoAnterior: 'COMPLETADA_TECNICO' as const,
          estadoNuevo: 'CERRADA' as const,
          observacion: 'Orden validada y cerrada administrativamente para el historial P10.',
        },
        {
          id: ids.estadosOrden.preventivaCreada,
          ordenTrabajoId: ids.ordenes.preventiva,
          estadoAnterior: null,
          estadoNuevo: 'ASIGNADA' as const,
          observacion: 'Orden preventiva demo creada desde programacion.',
        },
      ]

      for (const item of estadoHistorial) {
        await tx.ordenEstadoHistorial.upsert({
          where: { id: item.id },
          update: {
            estadoAnterior: item.estadoAnterior,
            estadoNuevo: item.estadoNuevo,
            observacion: item.observacion,
          },
          create: {
            ...item,
            cambiadoPorId: ids.usuarios.admin,
          },
        })
      }

      await tx.intervencion.update({
        where: { id: ids.intervencion },
        data: { fechaFin: fechaCorrectivaCompletada },
      })
      await tx.ordenTrabajo.update({
        where: { id: ids.ordenes.correctiva },
        data: {
          cerradaPorId: ids.usuarios.admin,
          disponibilidadAlCierre: true,
          estado: 'CERRADA',
          fechaCierre: fechaCorrectivaCierre,
          fechaCompletadaTecnico: fechaCorrectivaCompletada,
        },
      })

      const alertasP9 = [
        {
          claveDeduplicacion: 'seed-p9:novedad-critica:50000000-0000-4000-8000-000000000001',
          contextoEvento: {
            busCodigo: 'BUS-001',
            criticidad: 'CRITICA',
            fechaEvento: '2026-09-02T09:30:00.000Z',
            origen: { novedadId: ids.novedad },
            schemaVersion: 1,
          },
          fechaGeneracion: new Date('2026-09-02T09:30:00.000Z'),
          id: ids.alertas.novedadCritica,
          mensaje: 'La novedad crítica del bus BUS-001 requiere revisión prioritaria.',
          novedadId: ids.novedad,
          prioridad: 'CRITICA' as const,
          tipo: 'NOVEDAD_CRITICA' as const,
          titulo: 'Novedad crítica reportada',
        },
        {
          claveDeduplicacion: 'seed-p9:orden-completada:70000000-0000-4000-8000-000000000001',
          contextoEvento: {
            busCodigo: 'BUS-001',
            estado: 'COMPLETADA_TECNICO',
            fechaEvento: '2026-09-02T12:00:00.000Z',
            origen: { ordenTrabajoId: ids.ordenes.correctiva },
            schemaVersion: 1,
          },
          fechaGeneracion: new Date('2026-09-02T12:00:00.000Z'),
          id: ids.alertas.ordenCompletada,
          mensaje: 'La orden OT-COR-001 fue completada y requiere validación administrativa.',
          ordenTrabajoId: ids.ordenes.correctiva,
          prioridad: 'MEDIA' as const,
          tipo: 'ORDEN_COMPLETADA_TECNICO' as const,
          titulo: 'Orden completada por técnico',
        },
      ]

      for (const alerta of alertasP9) {
        await tx.alertaInterna.upsert({
          where: { claveDeduplicacion: alerta.claveDeduplicacion },
          update: {
            contextoEvento: alerta.contextoEvento,
            fechaGeneracion: alerta.fechaGeneracion,
            mensaje: alerta.mensaje,
            prioridad: alerta.prioridad,
            titulo: alerta.titulo,
          },
          create: alerta,
        })
      }

      const destinatariosP9 = [
        {
          alertaInternaId: ids.alertas.novedadCritica,
          id: ids.alertasDestinatarios.novedadAdmin,
          usuarioId: ids.usuarios.admin,
        },
        {
          alertaInternaId: ids.alertas.novedadCritica,
          id: ids.alertasDestinatarios.novedadDespacho,
          usuarioId: ids.usuarios.despachador,
        },
        {
          alertaInternaId: ids.alertas.ordenCompletada,
          id: ids.alertasDestinatarios.ordenAdmin,
          usuarioId: ids.usuarios.admin,
        },
      ]

      for (const destinatario of destinatariosP9) {
        await tx.alertaDestinatario.upsert({
          where: {
            alertaInternaId_usuarioId: {
              alertaInternaId: destinatario.alertaInternaId,
              usuarioId: destinatario.usuarioId,
            },
          },
          update: {},
          create: { ...destinatario, estado: 'NO_LEIDA' },
        })
      }
    },
    {
      maxWait: 15000,
      timeout: 60000,
    },
  )
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error: unknown) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
