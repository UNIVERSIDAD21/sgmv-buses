/** Segmenta el horizonte por meses calendario. No crea ni atribuye turnos empresariales. */
export function buildMonthlyHorizon(fechaInicio: string, fechaFin: string) {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Indique fechas ISO')
    const date = new Date(`${value}T00:00:00Z`)
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value)
      throw new Error('La fecha no existe')
    return date
  }
  let cursor = parse(fechaInicio)
  const last = parse(fechaFin)
  if (last < cursor) throw new Error('El fin debe ser posterior al inicio')
  if (last.getTime() - cursor.getTime() > 366 * 86_400_000)
    throw new Error('El horizonte de planificación no debe exceder un año')
  const months = []
  while (cursor <= last) {
    const monthEnd = new Date(cursor)
    monthEnd.setUTCMonth(cursor.getUTCMonth() + 1, 0)
    const end = monthEnd < last ? monthEnd : last
    months.push({
      mes: cursor.toISOString().slice(0, 7),
      fechaInicio: cursor.toISOString().slice(0, 10),
      fechaFin: end.toISOString().slice(0, 10),
      dias: (end.getTime() - cursor.getTime()) / 86_400_000 + 1,
    })
    cursor = new Date(end.getTime() + 86_400_000)
  }
  return months
}
