/* eslint-disable react-refresh/only-export-components -- Los conversores mantienen el formulario controlado y su contrato de prueba en un único módulo. */
import Button from './Button'

export interface KeyValueEntry {
  campo: string
  valor: string
}

export function recordToKeyValueEntries(value?: Record<string, unknown> | null): KeyValueEntry[] {
  if (!value) return []

  return Object.entries(value).map(([campo, valor]) => ({
    campo,
    valor:
      typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean'
        ? String(valor)
        : JSON.stringify(valor),
  }))
}

export function keyValueEntriesToRecord(entries: KeyValueEntry[]): {
  error?: string
  value?: Record<string, string>
} {
  const value: Record<string, string> = {}

  for (const entry of entries) {
    const campo = entry.campo.trim()
    const valor = entry.valor.trim()

    if (!campo && !valor) continue
    if (!campo || !valor) {
      return { error: 'Complete el nombre y el valor de cada dato técnico.' }
    }
    if (Object.hasOwn(value, campo)) {
      return { error: `El dato “${campo}” está repetido.` }
    }
    value[campo] = valor
  }

  return Object.keys(value).length > 0 ? { value } : {}
}

export default function KeyValueFields({
  addLabel = 'Agregar dato',
  entries,
  help,
  label,
  onChange,
}: {
  addLabel?: string
  entries: KeyValueEntry[]
  help?: string
  label: string
  onChange: (entries: KeyValueEntry[]) => void
}) {
  function update(index: number, field: keyof KeyValueEntry, value: string) {
    onChange(
      entries.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, [field]: value } : entry,
      ),
    )
  }

  function remove(index: number) {
    onChange(entries.filter((_, entryIndex) => entryIndex !== index))
  }

  return (
    <fieldset className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <legend className="px-1 text-sm font-medium text-slate-700">{label}</legend>
      {help && <p className="mb-3 text-xs leading-5 text-slate-500">{help}</p>}
      <div className="space-y-2">
        {entries.map((entry, index) => (
          <div
            className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
            key={`${index}-${entry.campo}`}
          >
            <label className="sr-only" htmlFor={`${label}-campo-${index}`}>
              Nombre del dato {index + 1}
            </label>
            <input
              className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              id={`${label}-campo-${index}`}
              onChange={(event) => update(index, 'campo', event.target.value)}
              placeholder="Dato, por ejemplo: Voltaje"
              value={entry.campo}
            />
            <label className="sr-only" htmlFor={`${label}-valor-${index}`}>
              Valor del dato {index + 1}
            </label>
            <input
              className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              id={`${label}-valor-${index}`}
              onChange={(event) => update(index, 'valor', event.target.value)}
              placeholder="Valor, por ejemplo: 24 V"
              value={entry.valor}
            />
            <Button
              aria-label={`Quitar dato ${index + 1}`}
              onClick={() => remove(index)}
              size="sm"
              variant="ghost"
            >
              Quitar
            </Button>
          </div>
        ))}
      </div>
      <Button
        className="mt-3"
        onClick={() => onChange([...entries, { campo: '', valor: '' }])}
        size="sm"
        variant="outline"
      >
        {addLabel}
      </Button>
    </fieldset>
  )
}
