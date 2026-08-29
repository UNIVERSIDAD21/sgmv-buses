import { z } from 'zod'

const optionalTrimmedText = (max = 500) =>
  z.preprocess((value) => {
    if (typeof value === 'string' && value.trim() === '') {
      return undefined
    }

    return value
  }, z.string().trim().max(max).optional())

const trimmedText = (min: number, max: number) => z.string().trim().min(min).max(max)

const decimalText = ({ allowZero }: { allowZero: boolean }) =>
  z.union([z.string(), z.number()]).transform((value, context) => {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      context.addIssue({
        code: 'custom',
        message: 'El numero debe ser finito',
      })

      return z.NEVER
    }

    const text = String(value).trim().replace(',', '.')

    if (!/^\d{1,10}(\.\d{1,2})?$/.test(text)) {
      context.addIssue({
        code: 'custom',
        message: 'Use un numero valido con maximo dos decimales',
      })

      return z.NEVER
    }

    const numeric = Number(text)

    if (allowZero ? numeric < 0 : numeric <= 0) {
      context.addIssue({
        code: 'custom',
        message: allowZero ? 'El valor no puede ser negativo' : 'El valor debe ser mayor que cero',
      })

      return z.NEVER
    }

    return text
  })

export const sparePartIdParamSchema = z.object({
  repuestoId: z.uuid(),
})

export const createSparePartSchema = z
  .object({
    categoria: optionalTrimmedText(120),
    claveIdempotencia: z.uuid().optional(),
    codigo: trimmedText(1, 80),
    costoUnitario: decimalText({ allowZero: true }).default('0'),
    motivoStockInicial: optionalTrimmedText(1000),
    nombre: trimmedText(2, 160),
    stockInicial: decimalText({ allowZero: true }).default('0'),
    stockMinimo: decimalText({ allowZero: true }).default('0'),
    unidadMedida: trimmedText(1, 40),
  })
  .strict()
  .superRefine((input, context) => {
    if (Number(input.stockInicial) > 0 && !input.claveIdempotencia) {
      context.addIssue({
        code: 'custom',
        message: 'La clave de idempotencia es obligatoria cuando hay stock inicial',
        path: ['claveIdempotencia'],
      })
    }
  })

export const updateSparePartSchema = z
  .object({
    categoria: optionalTrimmedText(120),
    codigo: trimmedText(1, 80).optional(),
    costoUnitario: decimalText({ allowZero: true }).optional(),
    nombre: trimmedText(2, 160).optional(),
    stockMinimo: decimalText({ allowZero: true }).optional(),
    unidadMedida: trimmedText(1, 40).optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: 'Debe enviar al menos un campo editable',
  })

export const stockEntrySchema = z
  .object({
    cantidad: decimalText({ allowZero: false }),
    claveIdempotencia: z.uuid(),
    costoUnitario: decimalText({ allowZero: true }).optional(),
    motivo: trimmedText(3, 1000),
  })
  .strict()

export const stockAdjustmentSchema = z
  .object({
    cantidad: decimalText({ allowZero: false }),
    claveIdempotencia: z.uuid(),
    direccion: z.enum(['DISMINUCION', 'INCREMENTO']),
    motivo: trimmedText(3, 1000),
  })
  .strict()

export const listSparePartsQuerySchema = z.object({
  busqueda: optionalTrimmedText(120),
  categoria: optionalTrimmedText(120),
  direccion: z.enum(['asc', 'desc']).default('asc'),
  disponibilidad: z.enum(['AGOTADO', 'BAJO', 'DISPONIBLE', 'INACTIVO']).optional(),
  estado: z.enum(['ACTIVO', 'INACTIVO']).optional(),
  limite: z.coerce.number().int().min(1).max(100).default(10),
  ordenarPor: z
    .enum([
      'categoria',
      'codigo',
      'costoUnitario',
      'createdAt',
      'nombre',
      'stockActual',
      'stockMinimo',
      'updatedAt',
    ])
    .default('codigo'),
  pagina: z.coerce.number().int().min(1).default(1),
})

export const listInventoryMovementsQuerySchema = z
  .object({
    busqueda: optionalTrimmedText(120),
    direccion: z.enum(['asc', 'desc']).default('desc'),
    fechaDesde: z.iso.date().optional(),
    fechaHasta: z.iso.date().optional(),
    limite: z.coerce.number().int().min(1).max(100).default(10),
    ordenarPor: z
      .enum(['cantidad', 'codigo', 'fechaMovimiento', 'tipo'])
      .default('fechaMovimiento'),
    pagina: z.coerce.number().int().min(1).default(1),
    responsableId: z.uuid().optional(),
    tipo: z.enum(['AJUSTE_ENTRADA', 'AJUSTE_SALIDA', 'CONSUMO', 'ENTRADA']).optional(),
  })
  .strict()

export type CreateSparePartInput = z.infer<typeof createSparePartSchema>
export type ListInventoryMovementsQuery = z.infer<typeof listInventoryMovementsQuerySchema>
export type ListSparePartsQuery = z.infer<typeof listSparePartsQuerySchema>
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>
export type StockEntryInput = z.infer<typeof stockEntrySchema>
export type UpdateSparePartInput = z.infer<typeof updateSparePartSchema>
