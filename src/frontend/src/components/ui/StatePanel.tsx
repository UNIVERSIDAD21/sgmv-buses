import type { ReactNode } from 'react'

import { AlertTriangle, CheckCircle, Construction, SearchX } from './Icons'

type Tone = 'empty' | 'error' | 'loading' | 'success'

interface StatePanelProps {
  action?: ReactNode
  description?: string
  title: string
  tone?: Tone
}

const iconByTone: Record<Tone, ReactNode> = {
  empty: <SearchX size={22} />,
  error: <AlertTriangle size={22} />,
  loading: <Construction size={22} />,
  success: <CheckCircle size={22} />,
}

const toneClasses: Record<Tone, string> = {
  empty: 'bg-slate-100 text-slate-400',
  error: 'bg-red-50 text-red-600',
  loading: 'bg-cyan-50 text-cyan-700',
  success: 'bg-emerald-50 text-emerald-700',
}

export default function StatePanel({
  action,
  description,
  title,
  tone = 'empty',
}: StatePanelProps) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-slate-200 bg-white px-6 py-10 text-center">
      <div
        className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg ${toneClasses[tone]}`}
      >
        {iconByTone[tone]}
      </div>
      <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      {description && (
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
