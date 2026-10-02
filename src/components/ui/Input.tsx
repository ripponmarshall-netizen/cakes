import { useLayoutEffect, useRef, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Icon, type IconName } from './Icon'

const fieldBase =
  'w-full rounded-2xl border-0 bg-ink-50/70 px-4 py-3 text-[15px] text-ink-900 ring-1 ring-inset ring-ink-200/80 placeholder:text-ink-300 transition duration-200 hover:ring-ink-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500 disabled:bg-ink-50 disabled:text-ink-400'

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-semibold text-ink-600">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs leading-relaxed text-ink-400">{hint}</span>}
    </label>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldBase} ${props.className ?? ''}`} />
}

/** Number input with a "J$" prefix. */
export function MoneyInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm font-bold text-ink-400">J$</span>
      <input type="number" inputMode="decimal" step="0.01" min="0" {...props} className={`${fieldBase} num pl-11 font-semibold ${props.className ?? ''}`} />
    </div>
  )
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${fieldBase} resize-none ${props.className ?? ''}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={`${fieldBase} appearance-none pr-10 ${props.className ?? ''}`} />
      <Icon name="chevron-down" size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
    </div>
  )
}

/** A checkbox laid out as a tappable card row. */
export function Toggle({
  checked,
  onChange,
  title,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  title: ReactNode
  children?: ReactNode
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-ink-50/70 p-4 ring-1 ring-inset ring-ink-200/60 transition hover:ring-ink-300">
      <span className="min-w-0 flex-1 text-sm">
        <span className="block font-semibold text-ink-800">{title}</span>
        {children && <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">{children}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className={`relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors duration-300 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-300 ${
          checked ? 'bg-brand-600' : 'bg-ink-200'
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-300 ease-spring ${checked ? 'translate-x-4' : ''}`}
        />
      </span>
    </label>
  )
}

/**
 * Pill switch with a highlight that slides to the chosen option. Used for
 * small choices in forms and as the tab bar on a partner.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T
  options: { value: T; label: string; icon?: IconName; badge?: number }[]
  onChange: (v: T) => void
  size?: 'md' | 'lg'
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null)
  const index = options.findIndex((o) => o.value === value)

  useLayoutEffect(() => {
    const measure = () => {
      const el = wrap.current?.children[index + 1] as HTMLElement | undefined
      if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (wrap.current) ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [index, options.length])

  return (
    <div ref={wrap} role="tablist" className={`relative flex rounded-2xl bg-ink-900/[0.05] p-1 ${size === 'lg' ? 'p-1.5' : ''}`}>
      <span
        aria-hidden
        className="absolute bottom-1 top-1 rounded-xl bg-white shadow-[0_1px_2px_rgba(24,24,21,0.06),0_4px_12px_-4px_rgba(24,24,21,0.12)] transition-all duration-300 ease-out"
        style={pill ? { left: pill.left, width: pill.width, top: size === 'lg' ? 6 : 4, bottom: size === 'lg' ? 6 : 4 } : { opacity: 0 }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 ${
            size === 'lg' ? 'py-2.5 text-sm' : 'py-2 text-[13px]'
          } ${value === o.value ? 'text-ink-900' : 'text-ink-500 hover:text-ink-700'}`}
        >
          {o.icon && <Icon name={o.icon} size={16} className={value === o.value ? 'text-brand-600' : ''} />}
          {o.label}
          {!!o.badge && (
            <span className="num min-w-[1.25rem] rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-[1.15rem] text-white">{o.badge}</span>
          )}
        </button>
      ))}
    </div>
  )
}
