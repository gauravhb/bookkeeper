'use client'
import { useState } from 'react'
import type { Expense, ExpenseCategory, ExpenseType } from '@/lib/types'

const CATEGORIES: ExpenseCategory[] = ['Food', 'Travel', 'Utilities', 'Shopping', 'Health', 'Other']

type Props = {
  type: ExpenseType
  onClose: () => void
  onSaved: (expense: Expense) => void
}

export default function AddExpenseModal({ type, onClose, onSaved }: Props) {
  const [item, setItem] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('Food')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!item || !amount) return setError('Item and amount are required.')
    setError('')
    setLoading(true)

    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item, amount: Number(amount), type, category, note: note || null }),
    })

    setLoading(false)
    if (!res.ok) return setError('Failed to save. Try again.')

    const expense: Expense = await res.json()
    onSaved(expense)
  }

  const inputClass = 'w-full border border-zinc-300 rounded-lg px-3 py-2.5 text-[16px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent'

  return (
    <div className="fixed inset-0 bg-black/30 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-sm p-6">
        <h2 className="text-base font-semibold text-zinc-900 mb-4">
          Add {type === 'personal' ? 'Personal' : 'Business'} Expense
        </h2>
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            placeholder="Item (e.g. Coffee)"
            value={item}
            onChange={e => setItem(e.target.value)}
            className={inputClass}
            required
          />
          <input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            min="0"
            step="0.01"
            className={inputClass}
            required
          />
          <select
            value={category}
            onChange={e => setCategory(e.target.value as ExpenseCategory)}
            className={inputClass}
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            placeholder="Note (optional)"
            value={note}
            onChange={e => setNote(e.target.value)}
            className={inputClass}
          />
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-zinc-300 text-zinc-600 rounded-lg py-2.5 text-sm font-medium hover:bg-zinc-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
