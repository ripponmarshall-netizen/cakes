import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'
import { useLast } from '../../hooks/usePresence'

interface ConfirmOptions {
  title: string
  message: ReactNode
  confirmLabel?: string
  danger?: boolean
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | undefined>(undefined)

/** Promise-based confirm dialog: `if (await confirm({...})) doIt()`. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<(ok: boolean) => void>()

  const confirm = useCallback<ConfirmFn>((o) => {
    setOpts(o)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const close = useCallback((ok: boolean) => {
    resolver.current?.(ok)
    resolver.current = undefined
    setOpts(null)
  }, [])

  // Keep showing the last dialog's text while it animates out.
  const shown = useLast(opts)

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!opts}
        onClose={() => close(false)}
        title={shown?.title ?? ''}
        footer={
          <div className="flex gap-2.5">
            <Button variant="secondary" className="flex-1" onClick={() => close(false)} autoFocus={!!shown?.danger}>
              Cancel
            </Button>
            <Button variant={shown?.danger ? 'danger' : 'primary'} className="flex-1" onClick={() => close(true)} autoFocus={!shown?.danger}>
              {shown?.confirmLabel ?? 'Confirm'}
            </Button>
          </div>
        }
      >
        <div className="pb-2 text-[15px] leading-relaxed text-ink-600">{shown?.message}</div>
      </Modal>
    </ConfirmContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider')
  return ctx
}
