export type PreventiveClassification = 'PROXIMO' | 'VENCIDO' | 'VIGENTE'

export interface PreventiveThresholds {
  soonDays: number
  soonKm: number
  timeZone: string
}

export interface PreventiveClassificationInput {
  fechaProgramada: Date | null
  kilometrajeActual: number
  kilometrajeObjetivo: number | null
  now?: Date
  thresholds: PreventiveThresholds
}

export interface PreventiveCriterionResult {
  estado: PreventiveClassification
  restante: number
}

export interface PreventiveClassificationResult {
  criterios: {
    fecha: PreventiveCriterionResult | null
    kilometraje: PreventiveCriterionResult | null
  }
  diasRestantes: number | null
  estado: PreventiveClassification
  kilometrosRestantes: number | null
}

const millisecondsPerDay = 86_400_000

function zonedDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return {
    day: Number(values.day),
    month: Number(values.month),
    year: Number(values.year),
  }
}

function calendarDayIndexFromZonedDate(date: Date, timeZone: string) {
  const parts = zonedDateParts(date, timeZone)

  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / millisecondsPerDay)
}

function calendarDayIndexFromDateColumn(date: Date) {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / millisecondsPerDay,
  )
}

function classifyDate(daysRemaining: number, soonDays: number): PreventiveClassification {
  if (daysRemaining < 0) {
    return 'VENCIDO'
  }

  if (daysRemaining <= soonDays) {
    return 'PROXIMO'
  }

  return 'VIGENTE'
}

function classifyMileage(kilometersRemaining: number, soonKm: number): PreventiveClassification {
  if (kilometersRemaining <= 0) {
    return 'VENCIDO'
  }

  if (kilometersRemaining <= soonKm) {
    return 'PROXIMO'
  }

  return 'VIGENTE'
}

export function classifyPreventiveSchedule({
  fechaProgramada,
  kilometrajeActual,
  kilometrajeObjetivo,
  now = new Date(),
  thresholds,
}: PreventiveClassificationInput): PreventiveClassificationResult {
  const fecha = fechaProgramada
    ? (() => {
        const daysRemaining =
          calendarDayIndexFromDateColumn(fechaProgramada) -
          calendarDayIndexFromZonedDate(now, thresholds.timeZone)

        return {
          estado: classifyDate(daysRemaining, thresholds.soonDays),
          restante: daysRemaining,
        }
      })()
    : null

  const kilometraje =
    kilometrajeObjetivo !== null
      ? (() => {
          const kilometersRemaining = kilometrajeObjetivo - kilometrajeActual

          return {
            estado: classifyMileage(kilometersRemaining, thresholds.soonKm),
            restante: kilometersRemaining,
          }
        })()
      : null

  const states = [fecha?.estado, kilometraje?.estado].filter(Boolean)
  const estado = states.includes('VENCIDO')
    ? 'VENCIDO'
    : states.includes('PROXIMO')
      ? 'PROXIMO'
      : 'VIGENTE'

  return {
    criterios: {
      fecha,
      kilometraje,
    },
    diasRestantes: fecha?.restante ?? null,
    estado,
    kilometrosRestantes: kilometraje?.restante ?? null,
  }
}
