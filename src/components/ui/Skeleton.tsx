/** Placeholder blocks shown while data loads, shaped like the content to come. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-56 rounded-4xl" />
      <div className="grid grid-cols-3 gap-2.5">
        <Skeleton className="h-20 rounded-3xl" />
        <Skeleton className="h-20 rounded-3xl" />
        <Skeleton className="h-20 rounded-3xl" />
      </div>
      <Skeleton className="h-12 rounded-2xl" />
      <Skeleton className="h-64 rounded-3xl" />
    </div>
  )
}
