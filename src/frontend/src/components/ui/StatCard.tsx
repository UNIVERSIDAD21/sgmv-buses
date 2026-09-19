import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Skeleton from './Skeleton'

type StatCardPriority = 'attention' | 'critical' | 'default'

interface StatCardProps {
  actionLabel?: string
  description?: string
  icon?: ReactNode
  label: string
  note?: string
  priority?: StatCardPriority
  to?: string
  value: number | string | null
}

const priorityClassName: Record<StatCardPriority, string> = {
  attention: 'border-amber-200 hover:border-amber-400',
  critical: 'border-red-200 hover:border-red-400',
  default: 'border-slate-200 hover:border-emerald-400',
}

export default function StatCard({
  actionLabel,
  description,
  icon,
  label,
  note,
  priority = 'default',
  to,
  value,
}: StatCardProps) {
  const content = (
    <>
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
        {description && (
          <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{description}</p>
        )}
        {note && <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{note}</p>}
        {actionLabel && (
          <p className="mt-2 text-xs font-semibold text-emerald-800 underline-offset-2 group-hover:underline group-focus-visible:underline">
            {actionLabel}
          </p>
        )}
      </div>
    </>
  )

  const className = `group flex min-h-[94px] items-start gap-3 rounded-xl border bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-colors ${priorityClassName[priority]}`

  if (to) {
    return (
      <Link
        aria-label={`${label}${value === null ? '' : `: ${value}`}. ${actionLabel ?? 'Ver detalle'}`}
        className={className}
        to={to}
      >
        {content}
      </Link>
    )
  }

  return <div className={className}>{content}</div>
}
