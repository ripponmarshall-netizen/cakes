import { methodLabels, pickableMethods } from '../../lib/format'
import type { PayoutMethod } from '../../lib/types'
import { Field, Input, Select } from '../ui/Input'

/** Payment method + reference (bank or Lynk reference) side by side. */
export function MethodPicker({
  method,
  onMethod,
  reference,
  onReference,
}: {
  method: PayoutMethod
  onMethod: (m: PayoutMethod) => void
  reference: string
  onReference: (r: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Paid by">
        <Select value={method} onChange={(e) => onMethod(e.target.value as PayoutMethod)}>
          {pickableMethods.map((m) => (
            <option key={m} value={m}>
              {methodLabels[m]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Reference (optional)">
        <Input
          value={reference}
          onChange={(e) => onReference(e.target.value)}
          placeholder={method === 'cash' ? 'Receipt no.' : 'Transaction ref'}
          maxLength={80}
        />
      </Field>
    </div>
  )
}
