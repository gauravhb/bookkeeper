import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import type { ExpenseCategory, ExpenseType } from '@/lib/types'

export async function GET(request: Request) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') as ExpenseType | null
  const category = searchParams.get('category') as ExpenseCategory | null

  let query = supabase
    .from('expenses')
    .select('*, users(name)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (type) query = query.eq('type', type)
  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { amount, item, type, category, note } = body

  if (!amount || !item || !type || !category) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('expenses')
    .insert({ user_id: user.id, amount, item, type, category, note: note || null })
    .select('*, users(name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}
