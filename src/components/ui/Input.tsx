import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from 'react'

const fieldBase =
  'w-full rounded-xl border-0 bg-white px-3.5 py-2.5 text-cocoa-800 ring-1 ring-inset ring-cocoa-200 placeholder:text-cocoa-400 focus:ring-2 focus:ring-inset focus:ring-blush-400 transition'

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-cocoa-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-cocoa-400">{hint}</span>}
    </label>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldBase} ${props.className ?? ''}`} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${fieldBase} ${props.className ?? ''}`} />
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${fieldBase} appearance-none ${props.className ?? ''}`} />
}
