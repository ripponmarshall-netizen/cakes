import type { ReactNode } from 'react'

export function EmptyState({
  emoji,
  title,
  children,
}: {
  emoji: string
  title: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-blush-200 bg-white/50 px-6 py-14 text-center">
      <div className="mb-3 text-4xl">{emoji}</div>
      <h3 className="text-lg font-bold text-cocoa-700">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm text-cocoa-500">{children}</p>}
    </div>
  )
}
