export function Spinner({ fullScreen = false }: { fullScreen?: boolean }) {
  const dot = <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-brand-100 border-t-brand-600" />
  return fullScreen ? (
    <div className="flex min-h-screen items-center justify-center">{dot}</div>
  ) : (
    <div className="flex justify-center py-16">{dot}</div>
  )
}
