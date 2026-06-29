import { Telegraf } from 'telegraf'
import { parseExpenseMessage } from '../ai/parser'
import { createServiceSupabase } from '../supabase/server'
import type { User } from '../types'

export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!)

async function findUserByChatId(chatId: string): Promise<User | null> {
  const supabase = createServiceSupabase()
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_chat_id', chatId)
    .single()
  return data
}

async function saveExpense(user: User, parsed: Awaited<ReturnType<typeof parseExpenseMessage>>) {
  if (!parsed) return null
  const supabase = createServiceSupabase()
  const { data } = await supabase
    .from('expenses')
    .insert({
      user_id: user.id,
      amount: parsed.amount,
      item: parsed.item,
      type: user.current_mode,
      category: parsed.category,
      note: parsed.note,
    })
    .select()
    .single()
  return data
}

// /start — welcome message
bot.command('start', async (ctx) => {
  await ctx.reply('Welcome to Bookkeeper!\nSend /register your@email.com to link your account.')
})

// /register email — links Telegram chat ID to user
bot.command('register', async (ctx) => {
  const email = ctx.message.text.split(' ')[1]?.trim()
  if (!email) return ctx.reply('Usage: /register your@email.com')

  const supabase = createServiceSupabase()
  const { data, error } = await supabase
    .from('users')
    .update({ telegram_chat_id: String(ctx.from.id) })
    .eq('email', email)
    .select('id')

  if (error) return ctx.reply(`DB error: ${error.message}`)
  if (!data || data.length === 0) return ctx.reply('Email not found. Contact admin.')
  await ctx.reply('Linked! You can now log expenses.\nDefault mode: Personal. Send /business to switch.')
})

// /status — current mode + last 3 expenses
bot.command('status', async (ctx) => {
  const user = await findUserByChatId(String(ctx.from.id))
  if (!user) return ctx.reply('Not registered. Send /register your@email.com')

  const supabase = createServiceSupabase()
  const { data: recent } = await supabase
    .from('expenses')
    .select('item, amount, type')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(3)

  const lines = recent?.map(e => `• ${e.item} ₹${e.amount} (${e.type})`) ?? []
  await ctx.reply(
    `Mode: ${user.current_mode === 'personal' ? '👤 Personal' : '💼 Business'}\n\nLast 3 expenses:\n${lines.join('\n') || 'None yet'}`
  )
})

// /business — confirm then switch to business mode
bot.command('business', async (ctx) => {
  const user = await findUserByChatId(String(ctx.from.id))
  if (!user) return ctx.reply('Not registered. Send /register your@email.com')
  if (user.current_mode === 'business') return ctx.reply('Already in Business mode.')

  await ctx.reply('Switch to Business mode?', {
    reply_markup: {
      inline_keyboard: [[
        { text: '✓ Yes, switch', callback_data: 'mode:business' },
        { text: '✗ Cancel', callback_data: 'mode:cancel' },
      ]],
    },
  })
})

// /personal — confirm then switch to personal mode
bot.command('personal', async (ctx) => {
  const user = await findUserByChatId(String(ctx.from.id))
  if (!user) return ctx.reply('Not registered. Send /register your@email.com')
  if (user.current_mode === 'personal') return ctx.reply('Already in Personal mode.')

  await ctx.reply('Switch to Personal mode?', {
    reply_markup: {
      inline_keyboard: [[
        { text: '✓ Yes, switch', callback_data: 'mode:personal' },
        { text: '✗ Cancel', callback_data: 'mode:cancel' },
      ]],
    },
  })
})

// Inline button callback for mode switching
bot.action(/^mode:(.+)$/, async (ctx) => {
  await ctx.answerCbQuery()
  const target = ctx.match[1]

  if (target === 'cancel') {
    await ctx.editMessageText('Cancelled.')
    return
  }

  const user = await findUserByChatId(String(ctx.from!.id))
  if (!user) return

  const supabase = createServiceSupabase()
  await supabase.from('users').update({ current_mode: target }).eq('id', user.id)

  const label = target === 'personal' ? '👤 Personal' : '💼 Business'
  await ctx.editMessageText(`✓ Switched to ${label} mode.`)
})

// All other text messages — treat as expense
bot.on('text', async (ctx) => {
  const user = await findUserByChatId(String(ctx.from.id))
  if (!user) return ctx.reply('Not registered. Send /register your@email.com')

  const parsed = await parseExpenseMessage(ctx.message.text)
  if (!parsed) return ctx.reply("Couldn't understand that. Try: Coffee 5.50")

  await saveExpense(user, parsed)

  const modeLabel = user.current_mode === 'personal' ? 'Personal' : 'Business'
  await ctx.reply(`✓ ${parsed.item} ₹${parsed.amount} (${modeLabel} · ${parsed.category}) logged!`)
})
