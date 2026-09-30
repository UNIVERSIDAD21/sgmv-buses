export interface JourneyPeriodPattern {
  fechaInicio: string
  fechaFin: string
  diasSemana: number[]
  horaInicio: string
  horaFin: string
}

export interface JourneyPeriodSlot {
  fecha: string
  inicioProgramado: Date
  finProgramado: Date
}

const dayMs = 86_400_000

export function buildJourneyPeriodSlots(input: JourneyPeriodPattern): JourneyPeriodSlot[] {
  const firstDay = Date.parse(`${input.fechaInicio}T00:00:00.000Z`)
  const lastDay = Date.parse(`${input.fechaFin}T00:00:00.000Z`)
  const crossesMidnight = input.horaFin <= input.horaInicio
  const weekdays = new Set(input.diasSemana)
  const slots: JourneyPeriodSlot[] = []

  for (let day = firstDay; day <= lastDay; day += dayMs) {
    const date = new Date(day)
    const weekday = date.getUTCDay() || 7
    if (!weekdays.has(weekday)) continue
    const fecha = date.toISOString().slice(0, 10)
    const endDate = crossesMidnight ? new Date(day + dayMs).toISOString().slice(0, 10) : fecha
    slots.push({
      fecha,
      inicioProgramado: new Date(`${fecha}T${input.horaInicio}:00-05:00`),
      finProgramado: new Date(`${endDate}T${input.horaFin}:00-05:00`),
    })
  }
  return slots
}
