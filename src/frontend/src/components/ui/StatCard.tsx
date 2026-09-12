import type { ReactNode } from 'react'
import Skeleton from './Skeleton'

interface StatCardProps {
  icon?: ReactNode
  label: string
  note?: string
  value: number | string | null
}

export default function StatCard({ icon, label, note, value }: StatCardProps) {
  return (
    <div className="flex min-h-[94px] items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      {icon && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        {value === null ? (
          <Skeleton className="h-6 w-12" />
        ) : (
          <p className="text-xl font-semibold leading-none tabular-nums text-slate-950">{value}</p>
        )}
        <p className="mt-1.5 text-xs font-semibold leading-4 text-slate-700">{label}</p>
        {note && <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{note}</p>}
      </div>
    </div>
  )
}
