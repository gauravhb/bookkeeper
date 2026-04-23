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
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Bookkeeper</h1>

      <div className="flex">
        {(['personal', 'business'] as ExpenseType[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2 capitalize text-sm font-medium rounded-t-lg border ${
              activeTab === tab
                ? 'bg-white text-violet-600 border-violet-500 border-b-white'
                : 'bg-gray-100 text-gray-500 border-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="bg-white border border-violet-500 rounded-b-lg rounded-tr-lg p-4 space-y-4">
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
