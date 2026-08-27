import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'danger' | 'ghost' | 'outline' | 'primary' | 'secondary'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode
  loading?: boolean
  size?: Size
  variant?: Variant
}

const variantClasses: Record<Variant, string> = {
  danger: 'border-red-600 bg-red-600 text-white hover:bg-red-700',
  ghost: 'border-transparent bg-transparent text-slate-600 hover:bg-slate-100',
  outline: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
  primary: 'border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800',
  secondary: 'border-cyan-700 bg-cyan-700 text-white hover:bg-cyan-800',
}

const sizeClasses: Record<Size, string> = {
  lg: 'min-h-11 px-5 text-sm',
  md: 'min-h-10 px-4 text-sm',
  sm: 'min-h-9 px-3 text-xs',
}

export default function Button({
  children,
  className = '',
  disabled,
  icon,
  loading = false,
  size = 'md',
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      disabled={disabled || loading}
      type={type}
      {...props}
    >
      {loading ? (
        <svg
          aria-hidden="true"
          className="animate-spin"
          fill="none"
          height="15"
          viewBox="0 0 24 24"
          width="15"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" stroke="currentColor" strokeWidth="2" />
        </svg>
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      {children}
    </button>
  )
}
