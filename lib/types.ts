// lib/types.ts
export type ExpenseType = 'personal' | 'business'

export type ExpenseCategory =
  | 'Food'
  | 'Travel'
  | 'Utilities'
  | 'Shopping'
  | 'Health'
  | 'Other'

export type User = {
  id: string
  email: string
  name: string
  telegram_chat_id: string | null
  whatsapp_number: string | null
  current_mode: ExpenseType
  pending_mode: ExpenseType | null
  created_at: string
}

export type Expense = {
  id: string
  user_id: string
  amount: number
  item: string
  type: ExpenseType
  category: ExpenseCategory
  note: string | null
  created_at: string
  users?: { name: string }
}

export type Stats = {
  thisMonth: number
  thisYear: number
  topCategory: ExpenseCategory | null
  submittedBy: { name: string; count: number }[]
}
