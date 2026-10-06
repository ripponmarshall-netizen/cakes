import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * What gets printed while this is mounted: its content, rendered straight
 * under <body>, with everything else hidden from the printer. Rendering it
 * outside the page (and any open dialog) means nothing scrolled, clipped or
 * stacked above it can push it onto a later page or cut it off.
 */
export function PrintRoot({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.body.classList.add('has-print-root')
    return () => document.body.classList.remove('has-print-root')
  }, [])
  return createPortal(<div className="print-root">{children}</div>, document.body)
}
