import { Logo } from '../Logo'

export function Spinner({ fullScreen = false }: { fullScreen?: boolean }) {
  if (fullScreen) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5">
        <div className="animate-pop-in">
          <Logo size={52} />
        </div>
        <div className="h-1 w-24 overflow-hidden rounded-full bg-ink-200/70">
          <div className="skeleton h-full w-full !rounded-full !bg-[linear-gradient(90deg,transparent,#2f7259,transparent)]" />
        </div>
      </div>
    )
  }
  return (
    <div className="flex justify-center py-16">
      <div className="h-7 w-7 animate-spin rounded-full border-[2.5px] border-brand-100 border-t-brand-600" />
    </div>
  )
}
