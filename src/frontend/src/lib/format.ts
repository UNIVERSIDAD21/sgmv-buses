export const formatDateTime = (date = new Date()) =>
  new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(date)

export const formatNumber = (value: number) => new Intl.NumberFormat('es-CO').format(value)
