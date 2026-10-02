import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

const fieldBase =
  'w-full rounded-xl border-0 bg-white px-3.5 py-2.5 text-ink-800 ring-1 ring-inset ring-ink-200 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500 transition disabled:bg-ink-50 disabled:text-ink-400'

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink-700">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-ink-400">{hint}</span>}
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
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-semibold text-ink-400">
        J$
      </span>
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        {...props}
        className={`${fieldBase} num pl-10 ${props.className ?? ''}`}
      />
    </div>
  )
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${fieldBase} ${props.className ?? ''}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${fieldBase} appearance-none ${props.className ?? ''}`} />
}

/** Two-or-more option pill switch. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-xl bg-ink-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
            value === o.value ? 'bg-white text-ink-800 shadow-sm' : 'text-ink-500 hover:text-ink-700'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
