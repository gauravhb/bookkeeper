'use client'
import { useState } from 'react'
import type { Expense, ExpenseType } from '@/lib/types'
import SummaryCards from './SummaryCards'
import Charts from './Charts'
import ExpenseTable from './ExpenseTable'
import AddExpenseModal from './AddExpenseModal'

type Props = { initialExpenses: Expense[] }

export default function Dashboard({ initialExpenses }: Props) {
  const [activeTab, setActiveTab] = useState<ExpenseType>('personal')
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [showAddModal, setShowAddModal] = useState(false)

  const filtered = expenses.filter(e => e.type === activeTab)

  function handleExpenseAdded(expense: Expense) {
    setExpenses(prev => [expense, ...prev])
    setShowAddModal(false)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">Bookkeeper</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Expense tracker</p>
      </div>

      <div className="flex gap-1 mb-0 border-b border-zinc-200">
        {(['personal', 'business'] as ExpenseType[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors -mb-px ${
              activeTab === tab
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-zinc-500 hover:text-zinc-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="bg-white border border-zinc-200 border-t-0 rounded-b-xl rounded-tr-xl p-4 md:p-6 space-y-6">
        <SummaryCards expenses={filtered} />
        <Charts expenses={filtered} />
        <ExpenseTable
          expenses={filtered}
          onAddClick={() => setShowAddModal(true)}
        />
      </div>

      {showAddModal && (
        <AddExpenseModal
          type={activeTab}
          onClose={() => setShowAddModal(false)}
          onSaved={handleExpenseAdded}
        />
      )}
    </div>
  )
}
