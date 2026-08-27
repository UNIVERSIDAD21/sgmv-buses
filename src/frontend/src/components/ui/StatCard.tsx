import type { ReactNode } from 'react'

interface StatCardProps {
  icon?: ReactNode
  label: string
  note?: string
  value: number | string
}

export default function StatCard({ icon, label, note, value }: StatCardProps) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4">
      {icon && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-2xl font-semibold leading-none text-slate-900">{value}</p>
        <p className="mt-1 text-xs font-medium text-slate-500">{label}</p>
        {note && <p className="mt-1 text-xs text-slate-400">{note}</p>}
      </div>
    </div>
  )
}
