import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Dashboard from '@/components/Dashboard'
import type { Expense } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: expenses } = await supabase
    .from('expenses')
    .select('*, users(name)')
    .order('created_at', { ascending: false })
    .limit(200)

  return <Dashboard initialExpenses={(expenses ?? []) as Expense[]} />
}
