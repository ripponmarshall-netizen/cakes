export type FeeType = 'flat' | 'percent'
export type PaymentMethod = 'cash' | 'transfer' | 'lynk' | 'deduction' | 'other'
export type PayoutMethod = Exclude<PaymentMethod, 'deduction'>
export type PayoutKind = 'draw' | 'refund'
export type TransferMode = 'buyout' | 'refund'

export interface Profile {
  id: string
  display_name: string
  created_at: string
}

export interface Partner {
  id: string
  name: string
  hand_amount: number
  start_date: string // YYYY-MM-DD
  term_months: number
  fee_type: FeeType
  fee_value: number
  /**
   * One entry per draw, in order: "id" = a full hand, "id|id" = one draw shared
   * by two half hands, "id|" = a half hand still waiting for a partner.
   * Reconciled client-side when members or hands change.
   */
  draw_order: string[]
  /** Whether members' statement links show the whole draw order, with names. */
  share_schedule: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Member {
  id: string
  partner_id: string
  name: string
  phone: string | null
  /** A multiple of 0.5: ½, 1, 1½, 2, … */
  hands: number
  notes: string | null
  share_token: string
  /** Set when someone else took over this member's hands. */
  replaced_by: string | null
  left_on: string | null
  transfer_mode: TransferMode | null
  created_at: string
}

interface Voidable {
  voided_at: string | null
  voided_by: string | null
  void_reason: string | null
}

export interface Contribution extends Voidable {
  id: string
  partner_id: string
  member_id: string
  period: number
  amount: number
  paid_on: string
  method: PaymentMethod
  ref: string | null
  note: string | null
  created_at: string
}

export interface Payout extends Voidable {
  id: string
  partner_id: string
  member_id: string
  period: number
  gross: number
  fee: number
  net: number
  kind: PayoutKind
  method: PayoutMethod
  ref: string | null
  paid_on: string
  note: string | null
  created_at: string
}

export interface AuditEntry {
  id: number
  at: string
  actor: string | null
  partner_id: string | null
  table_name: 'partners' | 'members' | 'contributions' | 'payouts'
  row_id: string | null
  action: 'insert' | 'update' | 'delete' | 'void'
  old_row: Record<string, unknown> | null
  new_row: Record<string, unknown> | null
}
