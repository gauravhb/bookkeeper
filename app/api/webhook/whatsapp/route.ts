import { NextResponse } from 'next/server'
import { parseExpenseMessage } from '@/lib/ai/parser'
import { createServiceSupabase } from '@/lib/supabase/server'
import { sendWhatsAppMessage } from '@/lib/bots/whatsapp'
import type { User } from '@/lib/types'

// Meta verification handshake
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }
  return new Response('Forbidden', { status: 403 })
}

async function findUserByPhone(phone: string): Promise<User | null> {
  const supabase = createServiceSupabase()
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('whatsapp_number', phone)
    .single()
  return data
}

async function linkUserByEmail(phone: string, email: string): Promise<boolean> {
  const supabase = createServiceSupabase()
  const { data, error } = await supabase
    .from('users')
    .update({ whatsapp_number: phone })
    .eq('email', email)
    .select('id')
  return !error && data != null && data.length > 0
}

async function switchMode(user: User, mode: 'personal' | 'business') {
  const supabase = createServiceSupabase()
  await supabase
    .from('users')
    .update({ current_mode: mode, pending_mode: null })
    .eq('id', user.id)
}

async function setPendingMode(user: User, mode: 'personal' | 'business') {
  const supabase = createServiceSupabase()
  await supabase
    .from('users')
    .update({ pending_mode: mode })
    .eq('id', user.id)
}

export async function POST(request: Request) {
  const rawBody = await request.text()

  const signature = request.headers.get('x-hub-signature-256')
  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (appSecret) {
    const crypto = await import('crypto')
    const expected = `sha256=${crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')}`
    if (signature !== expected) return new Response('Forbidden', { status: 403 })
  }

  const body = JSON.parse(rawBody)

  // Extract message from Meta payload
  const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]
  if (!message || message.type !== 'text') return NextResponse.json({ ok: true })

  const from: string = message.from
  const text: string = message.text.body.trim()

  // Registration
  if (text.toLowerCase().startsWith('register ')) {
    const email = text.split(' ')[1]?.trim()
    if (!email) {
      await sendWhatsAppMessage(from, 'Usage: register your@email.com')
      return NextResponse.json({ ok: true })
    }
    const ok = await linkUserByEmail(from, email)
    await sendWhatsAppMessage(from, ok ? 'Linked! You can now log expenses.' : 'Email not found. Contact admin.')
    return NextResponse.json({ ok: true })
  }

  const user = await findUserByPhone(from)
  if (!user) {
    await sendWhatsAppMessage(from, 'Not registered. Send: register your@email.com')
    return NextResponse.json({ ok: true })
  }

  // Pending mode confirmation
  if (user.pending_mode) {
    if (text.toLowerCase() === 'yes') {
      await switchMode(user, user.pending_mode)
      const label = user.pending_mode === 'personal' ? '👤 Personal' : '💼 Business'
      await sendWhatsAppMessage(from, `✓ Switched to ${label} mode.`)
    } else {
      const supabase = createServiceSupabase()
      await supabase.from('users').update({ pending_mode: null }).eq('id', user.id)
      await sendWhatsAppMessage(from, 'Cancelled.')
    }
    return NextResponse.json({ ok: true })
  }

  // Mode switch commands
  if (text === '/business' || text === '/personal') {
    const target = text.slice(1) as 'personal' | 'business'
    if (user.current_mode === target) {
      await sendWhatsAppMessage(from, `Already in ${target} mode.`)
      return NextResponse.json({ ok: true })
    }
    await setPendingMode(user, target)
    await sendWhatsAppMessage(from, `Switch to ${target} mode? Reply yes to confirm, or no to cancel.`)
    return NextResponse.json({ ok: true })
  }

  if (text === '/status') {
    const supabase = createServiceSupabase()
    const { data: recent } = await supabase
      .from('expenses')
      .select('item, amount, type')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3)
    const lines = recent?.map(e => `• ${e.item} ₹${e.amount} (${e.type})`) ?? []
    await sendWhatsAppMessage(from, `Mode: ${user.current_mode}\n\nLast 3:\n${lines.join('\n') || 'None yet'}`)
    return NextResponse.json({ ok: true })
  }

  // Expense message
  const parsed = await parseExpenseMessage(text)
  if (!parsed) {
    await sendWhatsAppMessage(from, "Couldn't understand that. Try: Coffee 5.50")
    return NextResponse.json({ ok: true })
  }

  const supabase = createServiceSupabase()
  await supabase.from('expenses').insert({
    user_id: user.id,
    amount: parsed.amount,
    item: parsed.item,
    type: user.current_mode,
    category: parsed.category,
    note: parsed.note,
  })

  const modeLabel = user.current_mode === 'personal' ? 'Personal' : 'Business'
  await sendWhatsAppMessage(from, `✓ ${parsed.item} ₹${parsed.amount} (${modeLabel} · ${parsed.category}) logged!`)
  return NextResponse.json({ ok: true })
}
