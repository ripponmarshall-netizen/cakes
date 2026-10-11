import { useEffect, useLayoutEffect, useRef, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Icon, type IconName } from './Icon'

const fieldBase =
  'w-full rounded-2xl border-0 bg-ink-50 px-3.5 py-3 text-[15px] text-ink-900 ring-1 ring-inset ring-line placeholder:text-ink-300 transition duration-200 hover:ring-ink-300 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent-500/70 disabled:text-ink-400'

/**
 * A labelled form control. Pass `group` when the child is a set of buttons
 * (Segmented): a <label> would pass taps on its text to the first button.
 */
export function Field({ label, hint, group, children }: { label: string; hint?: ReactNode; group?: boolean; children: ReactNode }) {
  const Tag = group ? 'div' : 'label'
  return (
    <Tag className="block" {...(group ? { role: 'group', 'aria-label': label } : {})}>
      <span className="mb-1.5 block text-[12.5px] font-medium text-ink-500">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs leading-relaxed text-ink-400">{hint}</span>}
    </Tag>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldBase} h-12 ${props.className ?? ''}`} />
}

/** Number input with a "J$" prefix. */
export function MoneyInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-sm font-bold text-ink-400">J$</span>
      <input type="number" inputMode="decimal" step="0.01" min="0" {...props} className={`${fieldBase} num h-12 pl-11 font-semibold ${props.className ?? ''}`} />
    </div>
  )
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${fieldBase} resize-none ${props.className ?? ''}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={`${fieldBase} h-12 appearance-none py-0 pr-10 ${props.className ?? ''}`} />
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
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-ink-50 p-4 ring-1 ring-inset ring-line-soft transition hover:ring-line">
      <span className="min-w-0 flex-1 text-sm">
        <span className="block font-semibold text-ink-800">{title}</span>
        {children && <span className="mt-0.5 block text-xs leading-relaxed text-ink-500">{children}</span>}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className={`relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors duration-300 peer-focus-visible:ring-2 peer-focus-visible:ring-accent-500/70 ${
          checked ? 'bg-accent-600' : 'bg-ink-200'
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-surface shadow-sm transition-transform duration-300 ease-spring ${checked ? 'translate-x-4' : ''}`}
        />
      </span>
    </label>
  )
}

/**
 * The calculator's segmented control: one pill glides (with a little spring)
 * to the chosen option. Small choices get an ink pill; `lg` is the partner
 * tab bar, styled like the calculator's dock with an accent-tinted pill.
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
  const tabs = size === 'lg'
  // The pill only glides once it's in place, so it doesn't slide in from the edge on mount.
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    if (!pill || settled) return
    const raf = requestAnimationFrame(() => setSettled(true))
    return () => cancelAnimationFrame(raf)
  }, [pill, settled])

  useLayoutEffect(() => {
    const measure = () => {
      const el = wrap.current?.children[index + 1] as HTMLElement | undefined
      setPill(el ? { left: el.offsetLeft, width: el.offsetWidth } : null)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (wrap.current) ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [index, options.length])

  return (
    <div
      ref={wrap}
      role="tablist"
      className={`relative isolate flex ${
        tabs
          ? 'gap-1 rounded-[20px] bg-surface/90 p-[5px] shadow-float ring-1 ring-line backdrop-blur-xl backdrop-saturate-150'
          : 'gap-0.5 rounded-xl bg-ink-50 p-[3px] ring-1 ring-inset ring-line'
      }`}
    >
      {/* Always the first child: the buttons are found as children[i + 1]. */}
      <span
        aria-hidden
        className={`${settled ? 'seg-pill' : ''} absolute left-0 -z-10 ${tabs ? 'inset-y-[5px] rounded-[15px] bg-accent-500/15' : 'inset-y-[3px] rounded-lg bg-ink-900'}`}
        style={pill ? { width: pill.width, transform: `translateX(${pill.left}px)` } : { opacity: 0 }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          tabIndex={value === o.value ? 0 : -1}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
            if (!step) return
            e.preventDefault()
            const next = options[(index + step + options.length) % options.length]
            onChange(next.value)
            ;(wrap.current?.children[options.indexOf(next) + 1] as HTMLElement | undefined)?.focus()
          }}
          className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/70 min-[360px]:px-3 ${
            tabs ? 'rounded-[15px] py-2.5 text-[13px]' : 'rounded-lg py-[7px] text-[13px]'
          } ${
            value !== o.value
              ? 'font-medium text-ink-500 hover:text-ink-800'
              : tabs
                ? 'font-semibold text-accent-600'
                : `font-semibold text-canvas ${pill ? '' : 'bg-ink-900'}` // until the pill is measured, paint the choice directly
          }`}
        >
          {/* Icons give way on the narrowest phones (320px) so the labels fit. */}
          {o.icon && <Icon name={o.icon} size={16} className="shrink-0 max-[359px]:hidden" />}
          {o.label}
          {!!o.badge && (
            <span key={o.badge} className="num min-w-[1.25rem] animate-pop rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-[1.15rem] text-white">
              {o.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
