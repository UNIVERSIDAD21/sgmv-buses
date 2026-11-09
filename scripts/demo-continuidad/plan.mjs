import crypto from 'node:crypto'

export const marker = 'SIMULADO_SGMV · continuidad 2026-11-09'
export const runId = 'cc261109-0000-4000-8000-000000000001'
const day = 86400000,
  minute = 60000
const at = (date, hour) => new Date(`${date}T${hour}:00-05:00`).toISOString()
const iso = (t) => new Date(t).toISOString()
const add = (t, m) => iso(Date.parse(t) + m * minute)
const date = (t) => new Date(t).toISOString().slice(0, 10)
export function fingerprint(s) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify(
        Object.fromEntries(
          [
            'buses',
            'journeys',
            'plans',
            'schedules',
            'orders',
            'users',
            'parts',
            'rules',
            'migrations',
          ].map((k) => [k, s[k]]),
        ),
      ),
    )
    .digest('hex')
}
export function buildPlan(s, cutoff) {
  const end = Date.parse(cutoff)
  if (!Number.isFinite(end) || end > Date.now()) throw Error('El corte debe ser válido y no futuro')
  if (s.buses?.length !== 22 || s.plans?.length !== 44 || s.migrations !== 50)
    throw Error('Cohorte o esquema inesperados')
  if (s.journeys.some((j) => j.inicio_real || j.estado !== 'PROGRAMADA'))
    throw Error('Hay jornadas ya intervenidas: se requiere reconciliar, no sobrescribir')
  const account = (email) => {
    const u = s.users.find((u) => u.email === email)
    if (!u || u.estado !== 'ACTIVO') throw Error('Cuenta del escenario no disponible: ' + email)
    return u.id
  }
  const admin = account('administrador.amb.demo@sgmv.local'),
    dispatcher = account('despachador.amb.demo@sgmv.local')
  const buses = [...s.buses].sort((a, b) => a.id - b.id),
    principals = buses.filter((b) => b.codigo_interno.endsWith('-01'))
  const events = [],
    reassign = new Map(),
    cases = []
  const push = (kind, time, payload) => {
    if (Date.parse(time) <= end) events.push({ kind, time, payload })
  }
  const mechanic = (b) =>
    account(`mecanico.${b.codigo_interno.slice(4, -3).toLowerCase()}.demo@sgmv.local`)
  const journey = (bus, dt, pm = false) =>
    s.journeys.find(
      (j) =>
        j.bus_id === bus.id &&
        date(j.inicio_programado) === dt &&
        new Date(j.inicio_programado).getUTCHours() === (pm ? 17 : 10),
    )
  function replace(original, reserve, time, reason) {
    if (!original) throw Error('No existe jornada a relevar')
    const key = 'successor:' + original.id
    reassign.set(original.id, { key, busId: reserve.id })
    push('REASSIGN', time, {
      id: original.id,
      key,
      busId: reserve.id,
      actor: dispatcher,
      reason: `${marker}: ${reason}`,
    })
    return key
  }
  function order({
    key,
    bus,
    tech = mechanic(bus),
    create,
    start,
    complete,
    close,
    schedule = null,
    target = null,
    existing = null,
    novelty = null,
    journeyKey = null,
    part = null,
  }) {
    push('ORDER_CREATE', create, {
      key,
      busId: bus.id,
      actor: admin,
      tech,
      description: `${marker}: ${schedule ? 'inspección preventiva semanal' : 'diagnóstico y corrección de novedad'}`,
      scheduleId: schedule?.id || null,
      scheduleKey: typeof schedule === 'string' ? schedule : null,
      target,
      planId: schedule?.plan_mantenimiento_preventivo_id || target?.planId || null,
      existingId: existing?.id || null,
      noveltyKey: novelty,
      journeyKey,
      code: `SIM261109-${key}`.slice(0, 50),
    })
    const assigned = existing?.fecha_asignacion || add(create, 1)
    if (!existing || existing.estado === 'PENDIENTE_ASIGNACION')
      push('ORDER_ASSIGN', assigned, { key, tech, actor: admin })
    if (start) {
      push('ORDER_START', start, { key, tech, actor: tech, busId: bus.id })
      push('ORDER_ACTIVITY', add(start, 8), {
        key,
        actor: tech,
        text: `${marker}: inspección, diagnóstico y verificación funcional según caso académico.`,
      })
      if (part)
        push('CONSUME', add(start, 12), {
          key,
          actor: tech,
          partId: part.id,
          quantity: part.unidad_medida === 'LITRO' ? 4 : 1,
        })
    }
    if (complete) push('ORDER_COMPLETE', complete, { key, actor: tech, busId: bus.id })
    if (close) push('ORDER_CLOSE', close, { key, actor: admin, busId: bus.id })
    return close
  }
  // Advance every due weekly target individually; retain the existing manual order.
  for (const b of buses) {
    const plan = s.plans.find(
      (p) => p.bus_id === b.id && p.clave_tarea === 'SIM.AMB.INSPECCION' && p.activo,
    )
    const original = s.schedules.find(
      (p) => p.bus_id === b.id && p.plan_mantenimiento_preventivo_id === plan.id && p.activa,
    )
    if (!original) throw Error('Obligación semanal faltante')
    let targetDate = original.fecha_programada,
      previousEnd = null,
      schedule = original,
      step = 0
    while (Date.parse(at(targetDate, '04:00')) <= end) {
      const existing =
        step === 0
          ? s.orders.find(
              (o) =>
                o.programacion_mantenimiento_id === original.id &&
                !['CERRADA', 'ANULADA'].includes(o.estado),
            )
          : null
      if (existing && !['PENDIENTE_ASIGNACION', 'ASIGNADA'].includes(existing.estado))
        throw Error('Orden existente con ejecución: revisar antes de importar')
      let start = at(targetDate, b.codigo_interno.endsWith('-01') ? '02:00' : '03:30')
      if (existing)
        start = iso(
          Math.max(
            Date.parse(start),
            Date.parse(existing.fecha_asignacion || existing.fecha_creacion) + 5 * minute,
          ),
        )
      if (previousEnd)
        start = iso(Math.max(Date.parse(start), Date.parse(previousEnd) + 20 * minute))
      if (Date.parse(add(start, 55)) > end) break
      const create = existing?.fecha_creacion || add(start, -3),
        key = `P-${b.id}-${targetDate}`
      const target = {
        date: targetDate,
        planId: plan.id,
        nextDate: iso(Date.parse(targetDate + 'T00:00:00Z') + plan.intervalo_dias * day).slice(
          0,
          10,
        ),
      }
      previousEnd = order({
        key,
        bus: b,
        tech: existing?.tecnico_asignado_id || mechanic(b),
        create,
        start,
        complete: add(start, 45),
        close: add(start, 55),
        schedule,
        target,
        existing,
      })
      schedule = 'schedule:' + key
      targetDate = target.nextDate
      step++
      if (step > 20) throw Error('Horizonte preventivo excesivo')
    }
  }
  const incidentDates = [
    '2026-10-22',
    '2026-10-23',
    '2026-10-24',
    '2026-10-26',
    '2026-10-27',
    '2026-10-28',
    '2026-10-29',
    '2026-10-30',
    '2026-11-02',
    '2026-11-05',
    '2026-11-06',
  ]
  const descriptions = [
    'vibración en correa auxiliar',
    'ruido de freno en retorno a patio',
    'revisión por pérdida menor de fluido',
    'ajuste de soporte y reapriete',
    'testigo intermitente de tablero',
    'revisión de tensión de banda',
    'sustitución de filtro académico',
    'ruido en articulación auxiliar',
    'ajuste de mecanismo de puerta',
    'revisión de conexiones',
    'inspección por vibración de cabina',
  ]
  principals.forEach((b, index) => {
    const reserve = buses.find((x) => x.codigo_interno === b.codigo_interno.replace(/01$/, '02'))
    const dt = incidentDates[index],
      am = journey(b, dt),
      pm = journey(b, dt, true)
    if (!am || !pm) throw Error('Falta el día de demostración')
    const key = `N-H-${b.id}`
    push('NOVELTY', at(dt, '11:20'), {
      key,
      journeyKey: String(am.id),
      actor: am.conductor_id,
      busId: b.id,
      description: `${marker}: ${descriptions[index]} observada en el tramo final; coordinación revisa al retorno.`,
      blocking: true,
      review: at(dt, '11:33'),
    })
    replace(
      pm,
      reserve,
      at(dt, '11:34'),
      'reserva durante corrección técnica de la unidad principal',
    )
    order({
      key: `C-H-${b.id}`,
      bus: b,
      create: at(dt, '11:35'),
      start: at(dt, '11:40'),
      complete: at(dt, '15:45'),
      close: at(dt, '16:00'),
      novelty: key,
      journeyKey: String(am.id),
      part: s.parts[index % 4],
    })
    cases.push({ bus: b.codigo_interno, date: dt, kind: 'correctivo cerrado y relevo a reserva' })
    // A second, minor observation exercises resolution without creating an order.
    const minor = `N-M-${b.id}`
    push('NOVELTY', at('2026-11-07', '11:15'), {
      key: minor,
      journeyKey: String(journey(b, '2026-11-07').id),
      actor: journey(b, '2026-11-07').conductor_id,
      busId: b.id,
      description: `${marker}: observación menor de limpieza y fijación de elemento interior.`,
      blocking: false,
      review: at('2026-11-07', '11:40'),
      resolved: true,
    })
  })
  // Current, unfinished examples are intentional: normal operation is not all green.
  principals.slice(0, 3).forEach((b, index) => {
    const dt = '2026-11-09',
      am = journey(b, dt),
      pm = journey(b, dt, true),
      key = `N-A-${b.id}`
    const reserve = buses.find((x) => x.codigo_interno === b.codigo_interno.replace(/01$/, '02'))
    push('NOVELTY', at(dt, '11:20'), {
      key,
      journeyKey: String(am.id),
      actor: am.conductor_id,
      busId: b.id,
      description: `${marker}: ${['ruido auxiliar en diagnóstico', 'revisión pendiente de técnico asignado', 'corrección terminada, pendiente validación administrativa'][index]}.`,
      blocking: true,
      review: at(dt, '11:33'),
    })
    replace(pm, reserve, at(dt, '11:34'), 'reserva por atención de novedad actual')
    order({
      key: `C-A-${b.id}`,
      bus: b,
      create: at(dt, '11:35'),
      start: index === 1 ? null : at(dt, '11:40'),
      complete: index === 2 ? at(dt, '11:55') : null,
      close: null,
      novelty: key,
      journeyKey: String(am.id),
      part: index === 1 ? null : s.parts[index],
    })
    cases.push({
      bus: b.codigo_interno,
      date: dt,
      kind: ['EN_EJECUCION', 'ASIGNADA', 'COMPLETADA_TECNICO'][index],
    })
  })
  const pending = principals[3],
    pendingJourney = journey(pending, '2026-11-09')
  push('NOVELTY', at('2026-11-09', '11:21'), {
    key: 'N-PENDIENTE',
    journeyKey: String(pendingJourney.id),
    actor: pendingJourney.conductor_id,
    busId: pending.id,
    description: `${marker}: observación de sonido interior pendiente de revisión de coordinación.`,
    blocking: false,
  })
  for (const [index, p] of s.parts.slice(0, 2).entries())
    push('STOCK_ENTRY', at(index ? '2026-11-02' : '2026-10-26', '08:00'), {
      partId: p.id,
      quantity: 10,
      actor: admin,
    })
  for (const j of s.journeys) {
    if (Date.parse(j.inicio_programado) > end) continue
    const replacement = reassign.get(j.id),
      key = replacement?.key || String(j.id),
      busId = replacement?.busId || j.bus_id
    const start = add(j.inicio_programado, j.id % 3),
      finish = add(j.fin_programado, -(j.id % 2))
    const distance = Math.max(
      1,
      Math.round(Number(j.km_proyectados_demo) * (0.985 + (j.id % 7) * 0.005)),
    )
    push('JOURNEY_START', start, { key, busId, actor: j.conductor_id, originalId: j.id, distance })
    push('JOURNEY_END', finish, { key, busId, actor: j.conductor_id, distance })
  }
  events.sort((a, b) => Date.parse(a.time) - Date.parse(b.time) || a.kind.localeCompare(b.kind))
  return {
    version: 1,
    runId,
    marker,
    cutoff: iso(end),
    createdAt: new Date().toISOString(),
    sourceFingerprint: fingerprint(s),
    protected: s.protected,
    admin,
    dispatcher,
    busIds: buses.map((b) => b.id),
    sourceBuses: buses,
    sourceJourneys: s.journeys,
    plans: s.plans,
    parts: s.parts,
    rules: s.rules || [],
    events,
    cases,
    summary: Object.fromEntries(
      [...new Set(events.map((e) => e.kind))].map((kind) => [
        kind,
        events.filter((e) => e.kind === kind).length,
      ]),
    ),
  }
}
