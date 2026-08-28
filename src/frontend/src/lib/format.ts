export const formatDateTime = (date = new Date()) =>
  new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(date)

export const formatNumber = (value: number) => new Intl.NumberFormat('es-CO').format(value)

export const formatCurrency = (value: number | string) =>
  new Intl.NumberFormat('es-CO', {
    currency: 'COP',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
    style: 'currency',
  }).format(Number(value))
