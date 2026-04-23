'use client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import type { Expense, ExpenseCategory } from '@/lib/types'

type Props = { expenses: Expense[] }

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Food: '#7c6af7',
  Travel: '#f7a06a',
  Utilities: '#34c98a',
  Shopping: '#f7d06a',
  Health: '#f76a6a',
  Other: '#aaaaaa',
}

function getMonthlyData(expenses: Expense[]) {
  const months: Record<string, number> = {}
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = d.toLocaleString('default', { month: 'short' })
    months[key] = 0
  }
  for (const e of expenses) {
    const d = new Date(e.created_at)
    const key = d.toLocaleString('default', { month: 'short' })
    if (key in months) months[key] += Number(e.amount)
  }
  return Object.entries(months).map(([month, amount]) => ({ month, amount }))
}

function getCategoryData(expenses: Expense[]) {
  const counts: Record<string, number> = {}
  for (const e of expenses) {
    counts[e.category] = (counts[e.category] ?? 0) + Number(e.amount)
  }
  return Object.entries(counts).map(([name, value]) => ({ name, value }))
}

export default function Charts({ expenses }: Props) {
  const monthly = getMonthlyData(expenses)
  const byCategory = getCategoryData(expenses)

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="md:col-span-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Monthly Spend</p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={monthly} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: number) => [`₹${v.toLocaleString('en-IN')}`, 'Spent']} />
            <Bar dataKey="amount" fill="#7c6af7" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">By Category</p>
        {byCategory.length === 0 ? (
          <p className="text-sm text-gray-400 text-center mt-8">No data</p>
        ) : (
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={byCategory} innerRadius={35} outerRadius={55} dataKey="value" nameKey="name">
                {byCategory.map(entry => (
                  <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name as ExpenseCategory] ?? '#aaa'} />
                ))}
              </Pie>
              <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
