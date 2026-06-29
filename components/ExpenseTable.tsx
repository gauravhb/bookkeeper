'use client'
import { useState } from 'react'
import type { Expense, ExpenseCategory } from '@/lib/types'

const CATEGORIES: ExpenseCategory[] = ['Food', 'Travel', 'Utilities', 'Shopping', 'Health', 'Other']

type Props = {
  expenses: Expense[]
  onAddClick: () => void
}

function toCSV(expenses: Expense[]): string {
  const header = 'Date,Item,Category,Amount,Note,Submitted By'
  const rows = expenses.map(e =>
    [
      new Date(e.created_at).toLocaleDateString('en-IN'),
      `"${e.item}"`,
      e.category,
      e.amount,
      `"${e.note ?? ''}"`,
      e.users?.name ?? '',
    ].join(',')
  )
  return [header, ...rows].join('\n')
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ExpenseTable({ expenses, onAddClick }: Props) {
  const [activeCategory, setActiveCategory] = useState<ExpenseCategory | 'All'>('All')

  const filtered = activeCategory === 'All'
    ? expenses
    : expenses.filter(e => e.category === activeCategory)

  function handleExport() {
    downloadCSV(toCSV(filtered), `expenses-${activeCategory.toLowerCase()}.csv`)
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        {(['All', ...CATEGORIES] as (ExpenseCategory | 'All')[]).map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
              activeCategory === cat
                ? 'border-indigo-500 text-indigo-600 bg-indigo-50'
                : 'border-zinc-200 text-zinc-500 bg-white hover:border-zinc-300'
            }`}
          >
            {cat}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <button
            onClick={handleExport}
            className="px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-600 text-xs hover:bg-zinc-50 transition-colors"
          >
            Export CSV
          </button>
          <button
            onClick={onAddClick}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors"
          >
            + Add
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-400">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Item</th>
              <th className="text-left px-4 py-2.5 font-medium">Category</th>
              <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Date</th>
              <th className="text-right px-4 py-2.5 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-zinc-400 py-10 text-sm">No expenses yet</td>
              </tr>
            ) : (
              filtered.map(e => (
                <tr key={e.id} className="border-t border-zinc-100 hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 text-zinc-800">
                    <span className="font-medium">{e.item}</span>
                    {e.users?.name && (
                      <span className="ml-2 text-xs text-zinc-400">· {e.users.name}</span>
                    )}
                    {e.note && (
                      <span className="ml-1 text-xs text-zinc-400 italic">{e.note}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-zinc-100 text-zinc-600">
                      {e.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs hidden sm:table-cell">
                    {new Date(e.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                    ₹{Number(e.amount).toLocaleString('en-IN')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
