import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

const ids = {
  roles: {
    admin: '10000000-0000-4000-8000-000000000001',
    mecanico: '10000000-0000-4000-8000-000000000002',
    conductor: '10000000-0000-4000-8000-000000000003',
  },
  usuarios: {
    admin: '20000000-0000-4000-8000-000000000001',
    mecanico: '20000000-0000-4000-8000-000000000002',
    conductor: '20000000-0000-4000-8000-000000000003',
  },
  buses: {
    principal: '30000000-0000-4000-8000-000000000001',
    respaldo: '30000000-0000-4000-8000-000000000002',
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
  consumo: '91000000-0000-4000-8000-000000000001',
  movimientos: {
    entrada: '92000000-0000-4000-8000-000000000001',
    consumo: '92000000-0000-4000-8000-000000000002',
  },
}

async function main() {
  const demoPassword = process.env.SEED_USER_PASSWORD ?? 'SgmvDemo2026!'
  const contrasenaHash = await hash(demoPassword, 10)
  const now = new Date()
  const fechaPreventivo = new Date(Date.UTC(2026, 8, 2))

  await prisma.$transaction(
    async (tx) => {
      await tx.rol.upsert({
        where: { codigo: 'ADMIN_SUPERVISOR' },
        update: {
          nombre: 'Administrador / Supervisor',
          descripcion: 'Gestiona flota, novedades, preventivos, ordenes, repuestos e informes.',
        },
        create: {
          id: ids.roles.admin,
          codigo: 'ADMIN_SUPERVISOR',
          nombre: 'Administrador / Supervisor',
          descripcion: 'Gestiona flota, novedades, preventivos, ordenes, repuestos e informes.',
        },
      })

      await tx.rol.upsert({
        where: { codigo: 'MECANICO' },
        update: {
          nombre: 'Personal Tecnico / Mecanico',
          descripcion: 'Ejecuta ordenes asignadas y registra actividades y consumos autorizados.',
        },
        create: {
          id: ids.roles.mecanico,
          codigo: 'MECANICO',
          nombre: 'Personal Tecnico / Mecanico',
          descripcion: 'Ejecuta ordenes asignadas y registra actividades y consumos autorizados.',
        },
      })

      await tx.rol.upsert({
        where: { codigo: 'CONDUCTOR_OPERADOR' },
        update: {
          nombre: 'Conductor / Operador',
          descripcion: 'Consulta su bus asignado y registra novedades operativas.',
        },
        create: {
          id: ids.roles.conductor,
          codigo: 'CONDUCTOR_OPERADOR',
          nombre: 'Conductor / Operador',
          descripcion: 'Consulta su bus asignado y registra novedades operativas.',
        },
      })

      await tx.usuario.upsert({
        where: { email: 'supervisor.demo@sgmv.local' },
        update: {
          nombre: 'Supervisor Demo',
          contrasenaHash,
          estado: 'ACTIVO',
          rolId: ids.roles.admin,
        },
        create: {
          id: ids.usuarios.admin,
          nombre: 'Supervisor Demo',
          email: 'supervisor.demo@sgmv.local',
          telefono: '3000000001',
          contrasenaHash,
          estado: 'ACTIVO',
          rolId: ids.roles.admin,
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

      await tx.bus.upsert({
        where: { codigoInterno: 'BUS-001' },
        update: {
          placa: 'SGM001',
          marca: 'Mercedes-Benz',
          modelo: 'OF-1721',
          anio: 2020,
          kilometrajeActual: 45200,
          estadoOperativo: 'OPERATIVO',
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

      await tx.ordenTrabajo.upsert({
        where: { codigo: 'OT-DEMO-CORR-001' },
        update: {
          estado: 'COMPLETADA_TECNICO',
          tecnicoAsignadoId: ids.usuarios.mecanico,
          fechaInicioEjecucion: now,
          fechaCompletadaTecnico: now,
          costoTotal: '160000',
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
          fechaAsignacion: now,
          fechaInicioEjecucion: now,
          fechaCompletadaTecnico: now,
          novedadId: ids.novedad,
          costoTotal: '160000',
        },
      })

      await tx.ordenTrabajo.upsert({
        where: { codigo: 'OT-DEMO-PREV-001' },
        update: {
          estado: 'ASIGNADA',
          tecnicoAsignadoId: ids.usuarios.mecanico,
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
          fechaAsignacion: now,
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
          fechaInicio: now,
          fechaFin: now,
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
