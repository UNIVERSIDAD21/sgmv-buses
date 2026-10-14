/** Intervalo de un mes; el mes en curso empieza mañana para no crear salidas pasadas. */
export function getMonthlyPeriod(month: string, firstFutureDate: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null
  const monthStart = `${month}-01`
  const end = new Date(`${monthStart}T00:00:00Z`)
  end.setUTCMonth(end.getUTCMonth() + 1, 0)
  const lastDay = end.toISOString().slice(0, 10)
  if (lastDay < firstFutureDate) return null
  return {
    fechaInicio: monthStart < firstFutureDate ? firstFutureDate : monthStart,
    fechaFin: lastDay,
  }
}
