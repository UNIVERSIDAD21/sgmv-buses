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
  },
  asignacion: '40000000-0000-4000-8000-000000000001',
  lecturaKilometraje: '41000000-0000-4000-8000-000000000001',
  busEstadoHistorial: '42000000-0000-4000-8000-000000000001',
  novedad: '50000000-0000-4000-8000-000000000001',
  programacion: '60000000-0000-4000-8000-000000000001',
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
    preventivaCreada: '82000000-0000-4000-8000-000000000005',
  },
  repuesto: '90000000-0000-4000-8000-000000000001',
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
          kilometrajeAnterior: 45000,
          kilometrajeNuevo: 45200,
          registradoPorId: ids.usuarios.admin,
        },
        create: {
          id: ids.lecturaKilometraje,
          busId: ids.buses.principal,
          kilometrajeAnterior: 45000,
          kilometrajeNuevo: 45200,
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
          kilometrajeAnterior: 44900,
          kilometrajeNuevo: 45000,
          registradoPorId: ids.usuarios.conductor,
          fechaLectura: jornadaFinalizada.finReal,
        },
        create: {
          id: ids.lecturasJornada.fin,
          busId: ids.buses.principal,
          kilometrajeAnterior: 44900,
          kilometrajeNuevo: 45000,
          registradoPorId: ids.usuarios.conductor,
          fechaRegistro: jornadaFinalizada.finReal,
          fechaLectura: jornadaFinalizada.finReal,
          tipo: 'FIN_JORNADA',
          jornadaOperativaId: ids.jornadas.finalizada,
          motivo: 'Fin de jornada operativa demo.',
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

      const fechaCorrectivaCreacion = new Date()
      const fechaCorrectivaAsignacion = new Date(fechaCorrectivaCreacion.getTime() + 1000)
      const fechaCorrectivaInicio = new Date(fechaCorrectivaCreacion.getTime() + 2000)
      const fechaCorrectivaCompletada = new Date(fechaCorrectivaCreacion.getTime() + 3000)

      await tx.ordenTrabajo.upsert({
        where: { codigo: 'OT-DEMO-CORR-001' },
        update: {
          estado: 'COMPLETADA_TECNICO',
          tecnicoAsignadoId: ids.usuarios.mecanico,
          fechaCreacion: fechaCorrectivaCreacion,
          fechaAsignacion: fechaCorrectivaAsignacion,
          fechaInicioEjecucion: fechaCorrectivaInicio,
          fechaCompletadaTecnico: fechaCorrectivaCompletada,
        },
        create: {
          id: ids.ordenes.correctiva,
          codigo: 'OT-DEMO-CORR-001',
          busId: ids.buses.principal,
          tipo: 'CORRECTIVA',
          origen: 'NOVEDAD',
          prioridad: 'ALTA',
          descripcion: 'Revision correctiva por vibracion en frenado.',
          estado: 'COMPLETADA_TECNICO',
          tecnicoAsignadoId: ids.usuarios.mecanico,
          creadaPorId: ids.usuarios.admin,
          fechaCreacion: fechaCorrectivaCreacion,
          fechaAsignacion: fechaCorrectivaAsignacion,
          fechaInicioEjecucion: fechaCorrectivaInicio,
          fechaCompletadaTecnico: fechaCorrectivaCompletada,
          novedadId: ids.novedad,
        },
      })

      const fechaPreventivaCreacion = new Date()
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
        },
        create: {
          id: ids.intervencion,
          ordenTrabajoId: ids.ordenes.correctiva,
          tecnicoId: ids.usuarios.mecanico,
          fechaInicio: fechaCorrectivaInicio,
          fechaFin: fechaCorrectivaCompletada,
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
        },
      })

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

      await tx.consumoRepuesto.upsert({
        where: { id: ids.consumo },
        update: {
          cantidad: '2',
          costoUnitario: '80000',
          subtotal: '160000',
        },
        create: {
          id: ids.consumo,
          ordenTrabajoId: ids.ordenes.correctiva,
          repuestoId: ids.repuesto,
          cantidad: '2',
          costoUnitario: '80000',
          subtotal: '160000',
          consumidoPorId: ids.usuarios.mecanico,
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
