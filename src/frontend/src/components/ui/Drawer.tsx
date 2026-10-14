import { useId, useRef, type ReactNode } from 'react'

import { X } from './Icons'
import { useDialogFocus } from './useDialogFocus'

interface DrawerProps {
  children: ReactNode
  onClose: () => void
  open: boolean
  subtitle?: string
  title: string
}

export default function Drawer({ children, onClose, open, subtitle, title }: DrawerProps) {
  const drawerRef = useRef<HTMLElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const titleId = useId()

  useDialogFocus(open, drawerRef, onClose, titleRef)

  if (!open) {
    return null
  }

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-slate-950/30 transition-opacity md:hidden"
        onClick={onClose}
      />
      <aside
        aria-labelledby={titleId}
        aria-modal="true"
        className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl transition-transform md:absolute md:bottom-auto md:top-0 md:h-full md:shadow-none"
        ref={drawerRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div>
            <h2
              className="text-base font-semibold text-slate-900 focus:outline-hidden"
              id={titleId}
              ref={titleRef}
              tabIndex={-1}
            >
              {title}
            </h2>
            {subtitle && <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p>}
          </div>
          <button
            aria-label="Cerrar panel"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </>
  )
}
