export type PaymentStatus = 'unpaid' | 'deposit' | 'paid_in_full'

export interface Profile {
  id: string
  display_name: string
  created_at: string
}

export interface CakeItem {
  id: string
  name: string
  description: string | null
  includes: string[]
  price: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  cake_item_id: string | null
  cake_name_snapshot: string | null
  customer_name: string
  payment_status: PaymentStatus
  deposit_amount: number
  total_amount: number
  notes: string | null
  created_by: string | null
  created_at: string
  // Joined from profiles for display
  created_by_profile?: { display_name: string } | null
}

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  deposit: 'Deposit',
  paid_in_full: 'Paid in full',
}
