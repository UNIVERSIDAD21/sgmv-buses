import type { ReactNode } from 'react'

interface PageHeaderProps {
  actions?: ReactNode
  description: string
  eyebrow?: string
  title: string
}

export default function PageHeader({ actions, description, eyebrow, title }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="min-w-0">
        {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
        <h2 className="page-title">{title}</h2>
        <p className="page-description">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  )
}
