import { useEffect, useState, type ReactNode } from 'react'

import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import StatePanel from '../../components/ui/StatePanel'
import { ORDER_STATUS_LABELS } from '../../domain/labels'
import { ApiError } from '../../lib/api'
import { formatCurrency, formatNumber } from '../../lib/format'
import {
  getCostReport,
  getMaintenanceReport,
  getPartsReport,
  type HistoryFilters,
} from './history.api'
import type { CostReportDto, MaintenanceReportDto, PartsReportDto } from './history.types'

export type AdminReportKind = 'maintenance' | 'parts' | 'costs'
type Report =
  | { kind: 'maintenance'; data: MaintenanceReportDto }
  | { kind: 'parts'; data: PartsReportDto }
  | { kind: 'costs'; data: CostReportDto }

const titles: Record<AdminReportKind, string> = {
  maintenance: 'Informe de mantenimiento',
  parts: 'Informe de repuestos utilizados',
  costs: 'Informe de costos por bus',
}

function tableData(report: Report): {
  columns: string[]
  rows: { id: number; cells: ReactNode[] }[]
} {
  if (report.kind === 'maintenance') {
    return {
      columns: ['Orden', 'Bus', 'Tipo', 'Estado', 'Técnico', 'Costo total'],
      rows: report.data.registros.map((row) => ({
        id: row.id,
        cells: [
          row.codigo,
          row.bus,
          row.tipo === 'PREVENTIVA' ? 'Preventiva' : 'Correctiva',
          ORDER_STATUS_LABELS[row.estado] ?? row.estado,
          row.tecnico ?? 'Sin asignar',
          formatCurrency(row.costoTotal),
        ],
      })),
    }
  }
  if (report.kind === 'parts') {
    return {
      columns: ['Código', 'Repuesto', 'Cantidad', 'Órdenes', 'Costo total'],
      rows: report.data.registros.map((row) => ({
        id: row.id,
        cells: [
          row.codigo,
          row.nombre,
          `${formatNumber(Number(row.cantidad))} ${row.unidadMedida}`,
          formatNumber(row.ordenes),
          formatCurrency(row.costoTotal),
        ],
      })),
    }
  }
  return {
    columns: ['Bus', 'Órdenes', 'Cerradas', 'Costo promedio', 'Costo total'],
    rows: report.data.registros.map((row) => ({
      id: row.busId,
      cells: [
        row.bus,
        formatNumber(row.ordenes),
        formatNumber(row.cerradas),
        formatCurrency(row.costoPromedio),
        formatCurrency(row.costoTotal),
      ],
    })),
  }
}

export default function AdminReportDetails({
  filters,
  kind,
  onClose,
}: {
  filters: HistoryFilters
  kind: AdminReportKind
  onClose: () => void
}) {
  const [page, setPage] = useState(1)
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    async function load() {
      await Promise.resolve()
      if (!active) return
      setLoading(true)
      setError(null)
      try {
        const query = { ...filters, pagina: page, limite: 10 }
        const response: Report =
          kind === 'maintenance'
            ? { kind, data: await getMaintenanceReport(query) }
            : kind === 'parts'
              ? { kind, data: await getPartsReport(query) }
              : { kind, data: await getCostReport(query) }
        if (active) setReport(response)
      } catch (requestError) {
        if (active)
          setError(
            requestError instanceof ApiError
              ? requestError.message
              : 'No se pudo cargar el informe.',
          )
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [filters, kind, page, retry])

  const table = report ? tableData(report) : null
  const pagination = report?.data.paginacion
  return (
    <Modal
      onClose={onClose}
      size="wide"
      subtitle="Consulta completa con los filtros aplicados; diez registros por página."
      title={titles[kind]}
    >
      <div className="space-y-4 p-4">
        {loading && (
          <StatePanel
            title="Cargando informe"
            description="Consultando los registros de esta página."
            tone="loading"
          />
        )}
        {!loading && error && (
          <StatePanel
            title="No se pudo consultar el informe"
            description={error}
            tone="error"
            action={<Button onClick={() => setRetry((value) => value + 1)}>Reintentar</Button>}
          />
        )}
        {!loading && !error && report && pagination && table && (
          <>
            <p className="text-sm text-slate-700">
              {formatNumber(pagination.total)} registros · Costo total filtrado:{' '}
              <strong>{formatCurrency(report.data.costoTotal)}</strong>
            </p>
            {table.rows.length === 0 ? (
              <StatePanel
                title="Sin registros"
                description="No hay resultados para los filtros aplicados."
              />
            ) : (
              <div className="overflow-x-auto">
                <table aria-label={titles[kind]} className="data-table min-w-[650px]">
                  <thead>
                    <tr>
                      {table.columns.map((column) => (
                        <th className="px-3 py-2" key={column} scope="col">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row) => (
                      <tr key={row.id}>
                        {row.cells.map((cell, index) => (
                          <td
                            className="px-3 py-2 text-sm text-slate-700"
                            key={table.columns[index]}
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <nav
              aria-label="Paginación del informe"
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <p aria-live="polite" className="text-xs text-slate-600">
                Página {pagination.pagina} de {Math.max(1, pagination.totalPaginas)}
              </p>
              <div className="flex gap-2">
                <Button
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                  size="sm"
                  variant="outline"
                >
                  Anterior
                </Button>
                <Button
                  disabled={page >= pagination.totalPaginas}
                  onClick={() => setPage((value) => value + 1)}
                  size="sm"
                  variant="outline"
                >
                  Siguiente
                </Button>
              </div>
            </nav>
          </>
        )}
      </div>
    </Modal>
  )
}
