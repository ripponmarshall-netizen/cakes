export type FeeType = 'flat' | 'percent'

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
  draw_order: string[]
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Member {
  id: string
  partner_id: string
  name: string
  phone: string | null
  hands: number
  notes: string | null
  created_at: string
}

export interface Contribution {
  id: string
  partner_id: string
  member_id: string
  period: number
  amount: number
  paid_on: string
  note: string | null
  created_at: string
}

export interface Payout {
  id: string
  partner_id: string
  member_id: string
  period: number
  gross: number
  fee: number
  net: number
  paid_on: string
  note: string | null
  created_at: string
}
