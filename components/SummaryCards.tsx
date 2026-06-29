import type { Expense, ExpenseCategory } from '@/lib/types'

type Props = { expenses: Expense[] }

function formatINR(amount: number) {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export default function SummaryCards({ expenses }: Props) {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const thisMonth = expenses
    .filter(e => new Date(e.created_at) >= startOfMonth)
    .reduce((sum, e) => sum + Number(e.amount), 0)

  const thisYear = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  const categoryCounts: Record<string, number> = {}
  for (const e of expenses) {
    categoryCounts[e.category] = (categoryCounts[e.category] ?? 0) + Number(e.amount)
  }
  const topCategory = (Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—') as ExpenseCategory | '—'

  const submitterCounts: Record<string, number> = {}
  for (const e of expenses) {
    const name = e.users?.name ?? 'Unknown'
    submitterCounts[name] = (submitterCounts[name] ?? 0) + 1
  }
  const total = Object.values(submitterCounts).reduce((s, v) => s + v, 0)
  const submitterText = Object.entries(submitterCounts)
    .map(([name, count]) => `${name} ${total > 0 ? Math.round((count / total) * 100) : 0}%`)
    .join(' · ')

  const cards = [
    { label: 'This Month', value: formatINR(thisMonth) },
    { label: 'This Year', value: formatINR(thisYear) },
    { label: 'Top Category', value: topCategory },
    { label: 'Submitted By', value: submitterText || '—' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map(card => (
        <div key={card.label} className="border border-zinc-100 rounded-lg p-3 bg-zinc-50">
          <p className="text-xs text-zinc-400">{card.label}</p>
          <p className="text-lg font-semibold text-zinc-900 mt-1 truncate">{card.value}</p>
        </div>
      ))}
    </div>
  )
}
