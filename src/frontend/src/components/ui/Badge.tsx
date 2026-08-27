interface BadgeProps {
  children: string
  tone?: 'amber' | 'emerald' | 'red' | 'slate' | 'teal'
}

const toneClasses: Record<NonNullable<BadgeProps['tone']>, string> = {
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  red: 'border-red-200 bg-red-50 text-red-700',
  slate: 'border-slate-200 bg-slate-100 text-slate-600',
  teal: 'border-cyan-200 bg-cyan-50 text-cyan-700',
}

export default function Badge({ children, tone = 'slate' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${toneClasses[tone]}`}
    >
      {children}
    </span>
  )
}
