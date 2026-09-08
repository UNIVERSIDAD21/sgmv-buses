import { useId, useRef, type ReactNode } from 'react'

import { X } from './Icons'
import { useDialogFocus } from './useDialogFocus'

interface ModalProps {
  children: ReactNode
  onClose: () => void
  subtitle?: string
  title: string
}

export default function Modal({ children, onClose, subtitle, title }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const titleId = useId()

  useDialogFocus(true, dialogRef, onClose, titleRef)

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center overflow-y-auto bg-slate-950/40 p-3 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="max-h-[calc(100dvh-1.5rem)] w-full max-w-xl overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div className="min-w-0">
            <h2
              className="text-base font-semibold text-slate-900 focus:outline-none"
              id={titleId}
              ref={titleRef}
              tabIndex={-1}
            >
              {title}
            </h2>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button
            aria-label="Cerrar diálogo"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
