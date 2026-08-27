import { Link } from 'react-router-dom'

import { BUS_STATUS_LABELS } from '../../domain/labels'
import Button from '../../components/ui/Button'
import StatePanel from '../../components/ui/StatePanel'

export default function BusFormPage() {
  return (
    <div className="mx-auto max-w-2xl p-4 md:p-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Registro de bus</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Formulario visual preparado. El guardado real queda pendiente hasta implementar RF-01
          completo con validaciones Zod y API.
        </p>

        <form className="mt-6 space-y-5">
          <fieldset>
            <legend className="mb-3 text-xs font-semibold uppercase text-slate-500">
              Identificación
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700">
                Codigo interno
                <input
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                  disabled
                  placeholder="BUS-001"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Placa
                <input
                  className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                  disabled
                  placeholder="ABC123"
                />
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-xs font-semibold uppercase text-slate-500">
              Datos del vehículo
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {['Marca', 'Modelo', 'Año', 'Kilometraje actual'].map((label) => (
                <label className="block text-sm font-medium text-slate-700" key={label}>
                  {label}
                  <input
                    className="mt-1.5 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                    disabled
                  />
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-xs font-semibold uppercase text-slate-500">
              Estado operativo
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(BUS_STATUS_LABELS).map(([value, label]) => (
                <label
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
                  key={value}
                >
                  <input disabled name="estado" type="radio" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <StatePanel
            description="Se evita simular un guardado. La persistencia se habilitará cuando se implemente el endpoint oficial de flota."
            title="Guardado pendiente de RF-01"
            tone="loading"
          />

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              to="/flota"
            >
              Cancelar
            </Link>
            <Button className="flex-1" disabled>
              Guardar
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
