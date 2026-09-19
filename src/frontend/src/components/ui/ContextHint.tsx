import type { ReactNode } from 'react'

interface ContextHintProps {
  children: ReactNode
  title: string
}

export default function ContextHint({ children, title }: ContextHintProps) {
  return (
    <aside
      aria-label={title}
      className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-3 text-sm leading-6 text-sky-950"
    >
      <p className="font-semibold">{title}</p>
      <div className="mt-1 text-sky-900">{children}</div>
    </aside>
  )
}
