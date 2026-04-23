import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import type { ExpenseCategory, ExpenseType } from '@/lib/types'

export async function GET(request: Request) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') as ExpenseType

  if (!type) return NextResponse.json({ error: 'Missing type parameter' }, { status: 400 })

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString()

  const { data: expenses } = await supabase
    .from('expenses')
    .select('amount, category, created_at, users(name)')
    .eq('type', type)
    .gte('created_at', startOfYear)

  if (!expenses) return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })

  const thisMonth = expenses
    .filter(e => e.created_at >= startOfMonth)
    .reduce((sum, e) => sum + Number(e.amount), 0)

  const thisYear = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  const categoryCounts: Record<string, number> = {}
  for (const e of expenses) {
    categoryCounts[e.category] = (categoryCounts[e.category] ?? 0) + Number(e.amount)
  }
  const topCategory = (Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null) as ExpenseCategory | null

  const submitterCounts: Record<string, number> = {}
  for (const e of expenses) {
    const name = (e.users as unknown as { name: string } | null)?.name ?? 'Unknown'
    submitterCounts[name] = (submitterCounts[name] ?? 0) + 1
  }
  const submittedBy = Object.entries(submitterCounts).map(([name, count]) => ({ name, count }))

  return NextResponse.json({ thisMonth, thisYear, topCategory, submittedBy })
}
