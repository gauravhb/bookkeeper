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
            className={`px-3 py-1 rounded-full text-xs border ${
              activeCategory === cat
                ? 'border-violet-500 text-violet-600 bg-violet-50'
                : 'border-gray-300 text-gray-500 bg-white'
            }`}
          >
            {cat}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <button
            onClick={handleExport}
            className="px-3 py-1 rounded border border-violet-500 text-violet-600 text-xs hover:bg-violet-50"
          >
            ⬇ Export CSV
          </button>
          <button
            onClick={onAddClick}
            className="px-3 py-1 rounded bg-violet-600 text-white text-xs hover:bg-violet-700"
          >
            + Add Expense
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2">Item</th>
              <th className="text-left px-4 py-2">Category</th>
              <th className="text-left px-4 py-2">Date</th>
              <th className="text-right px-4 py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center text-gray-400 py-8">No expenses yet</td>
              </tr>
            ) : (
              filtered.map(e => (
                <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-800">
                    {e.item}
                    {e.users?.name && (
                      <span className="ml-2 text-xs text-gray-400">· {e.users.name}</span>
                    )}
                    {e.note && (
                      <span className="ml-1 text-xs text-gray-400 italic">{e.note}</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-violet-50 text-violet-600">
                      {e.category}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-400 text-xs">
                    {new Date(e.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold text-violet-600">
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
