import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPlan } from './plan.mjs'
const cutoff = '2026-11-09T18:04:05.991Z'
function fixture() {
  const slugs = [
    'UNITRANSA',
    'TRANSCOLOMBIA',
    'COTRANDER',
    'TRANSGIRON',
    'ORIENTAL',
    'COOTRAGAS',
    'LUSITANIA',
    'METROPOLITANA',
    'SANJUAN',
    'PIEDECUESTA',
    'VILLASANCARLOS',
  ]
  const s = {
    buses: [],
    plans: [],
    schedules: [],
    orders: [],
    journeys: [],
    users: [],
    parts: [],
    rules: [],
    protected: { fixture: 'sin-datos-reales' },
    migrations: 50,
  }
  let uid = 1
  const user = (email, rol) => {
    const id = uid++
    s.users.push({ id, email, rol, estado: 'ACTIVO' })
    return id
  }
  user('administrador.amb.demo@sgmv.local', 'ADMINISTRADOR')
  user('despachador.amb.demo@sgmv.local', 'DESPACHADOR')
  slugs.forEach((slug, index) => {
    const tech = user(`mecanico.${slug.toLowerCase()}.demo@sgmv.local`, 'MECANICO')
    const drivers = ['am', 'pm'].map((shift) =>
      user(`conductor.${slug.toLowerCase()}.${shift}.demo@sgmv.local`, 'CONDUCTOR'),
    )
    for (let busIndex = 0; busIndex < 2; busIndex++) {
      const id = 109 + index * 2 + busIndex
      s.buses.push({
        id,
        codigo_interno: `SIM-${slug}-0${busIndex + 1}`,
        kilometraje_actual: 40000 + index * 1000,
      })
      for (let routine = 0; routine < 2; routine++) {
        const planId = 1030 + (index * 2 + busIndex) * 2 + routine,
          scheduleId = planId + 2
        s.plans.push({
          id: planId,
          bus_id: id,
          clave_tarea: routine ? 'SIM.AMB.REVISION30' : 'SIM.AMB.INSPECCION',
          activo: true,
          intervalo_dias: routine ? 30 : 7,
        })
        s.schedules.push({
          id: scheduleId,
          bus_id: id,
          plan_mantenimiento_preventivo_id: planId,
          activa: true,
          fecha_programada: routine ? '2026-11-13' : '2026-10-21',
        })
        if (id === 130 && !routine)
          s.orders.push({
            id: 81,
            bus_id: id,
            programacion_mantenimiento_id: scheduleId,
            estado: 'ASIGNADA',
            tecnico_asignado_id: tech,
            fecha_creacion: '2026-11-03T14:10:19.769Z',
            fecha_asignacion: '2026-11-03T14:10:57.909Z',
          })
      }
    }
    for (
      let ms = Date.parse('2026-10-15T00:00:00Z');
      ms <= Date.parse('2027-01-31T00:00:00Z');
      ms += 86400000
    ) {
      const dt = new Date(ms)
      if (dt.getUTCDay() === 0) continue
      const date = dt.toISOString().slice(0, 10)
      for (let shift = 0; shift < 2; shift++)
        s.journeys.push({
          id: s.journeys.length + 1,
          bus_id: 109 + index * 2,
          conductor_id: drivers[shift],
          estado: 'PROGRAMADA',
          inicio_real: null,
          inicio_programado: new Date(
            `${date}T${shift ? '12:00' : '05:30'}:00-05:00`,
          ).toISOString(),
          fin_programado: new Date(`${date}T${shift ? '17:00' : '11:30'}:00-05:00`).toISOString(),
          km_proyectados_demo: 100,
        })
    }
  })
  for (let i = 0; i < 4; i++)
    s.parts.push({ id: 30 + i, unidad_medida: i === 1 ? 'LITRO' : 'UNIDAD' })
  return s
}
test('recupera el horizonte transcurrido completo sin ejecutar jornadas futuras', () => {
  const plan = buildPlan(fixture(), cutoff)
  assert.equal(plan.summary.JOURNEY_END, 473)
  assert.equal(plan.summary.JOURNEY_START, 484)
  assert.equal(plan.summary.REASSIGN, 14)
  assert.ok(plan.events.every((e) => Date.parse(e.time) <= Date.parse(cutoff)))
  assert.ok(
    plan.events.every((e, i) => !i || Date.parse(e.time) >= Date.parse(plan.events[i - 1].time)),
  )
})
test('conserva los datos de entrada y la creación/asignación de la orden manual previa', () => {
  const source = fixture(),
    copy = structuredClone(source),
    plan = buildPlan(source, cutoff)
  assert.deepEqual(source, copy)
  const original = plan.events.find((e) => e.kind === 'ORDER_CREATE' && e.payload.existingId === 81)
  assert.equal(original.time, '2026-11-03T14:10:19.769Z')
  const start = plan.events.find(
    (e) => e.kind === 'ORDER_START' && e.payload.key === original.payload.key,
  )
  assert.ok(Date.parse(start.time) > Date.parse(source.orders[0].fecha_asignacion))
})
test('atiende cada ciclo semanal vencido, sin saltarlo a la fecha actual', () => {
  const plan = buildPlan(fixture(), cutoff),
    cycles = plan.events.filter((e) => e.kind === 'ORDER_CREATE' && e.payload.target)
  assert.equal(cycles.length, 66)
  assert.deepEqual([...new Set(cycles.map((e) => e.payload.target.date))].sort(), [
    '2026-10-21',
    '2026-10-28',
    '2026-11-04',
  ])
  assert.equal(plan.summary.ORDER_CLOSE, 77)
  assert.equal(plan.summary.NOVELTY, 26)
})
test('rechaza una ejecución ya iniciada en vez de sobrescribirla', () => {
  const source = fixture()
  source.journeys[0].estado = 'EN_CURSO'
  assert.throws(() => buildPlan(source, cutoff), /reconciliar/)
})
test('rechaza cuentas inactivas sin reactivarlas', () => {
  const source = fixture()
  source.users[0].estado = 'INACTIVO'
  assert.throws(() => buildPlan(source, cutoff), /Cuenta del escenario/)
  assert.equal(source.users[0].estado, 'INACTIVO')
})
test('rechaza cohortes incompletas y cortes futuros', () => {
  const source = fixture()
  source.buses.pop()
  assert.throws(() => buildPlan(source, cutoff), /Cohorte/)
  assert.throws(
    () => buildPlan(fixture(), new Date(Date.now() + 86400000).toISOString()),
    /no futuro/,
  )
})
