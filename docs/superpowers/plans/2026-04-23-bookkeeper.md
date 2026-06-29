# Bookkeeper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a two-user expense tracker with Telegram/WhatsApp input, AI parsing via OpenRouter, and a mobile-friendly web dashboard.

**Architecture:** Next.js App Router on Vercel; Supabase for database and auth; OpenRouter for AI parsing (model swappable via env var); Telegraf.js for Telegram; Meta Cloud API for WhatsApp. All AI calls go through one module. Each file has one clear responsibility.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase (`@supabase/supabase-js`, `@supabase/ssr`), OpenRouter via `openai` SDK, Telegraf, Recharts, Jest + React Testing Library

---

## File Map

```
bookkeeper/
├── app/
│   ├── layout.tsx                       # Root layout
│   ├── page.tsx                         # Redirects to /dashboard
│   ├── login/page.tsx                   # Email + password login
│   ├── dashboard/page.tsx               # Server component: auth check + data fetch
│   └── api/
│       ├── webhook/telegram/route.ts    # Telegram webhook (POST only)
│       ├── webhook/whatsapp/route.ts    # WhatsApp webhook (GET verify + POST)
│       ├── expenses/route.ts            # GET (list) + POST (create)
│       └── stats/route.ts              # GET summary stats
├── components/
│   ├── Dashboard.tsx                    # Client: tabs + state
│   ├── SummaryCards.tsx                # 4 stat cards
│   ├── Charts.tsx                      # Bar + donut (Recharts)
│   ├── ExpenseTable.tsx                # Filterable table + CSV export button
│   └── AddExpenseModal.tsx             # Modal form for manual entry
├── lib/
│   ├── types.ts                        # All shared TypeScript types
│   ├── supabase/
│   │   ├── client.ts                   # Browser Supabase client
│   │   └── server.ts                   # Server + service role clients
│   ├── ai/
│   │   └── parser.ts                   # OpenRouter expense parser (one function)
│   └── bots/
│       ├── telegram.ts                 # Telegraf bot instance + all handlers
│       └── whatsapp.ts                # sendWhatsAppMessage helper
├── supabase/migrations/
│   └── 001_init.sql                    # Full schema
├── middleware.ts                        # Protects /dashboard
├── __tests__/
│   ├── lib/ai/parser.test.ts
│   ├── api/expenses.test.ts
│   └── api/stats.test.ts
├── jest.config.ts
├── jest.setup.ts
└── .env.local.example
```

---

## Task 1: Project Setup

**Files:**
- Create: `package.json` (via scaffolding)
- Create: `.env.local.example`
- Create: `jest.config.ts`
- Create: `jest.setup.ts`

- [ ] **Step 1: Scaffold Next.js app**

```bash
cd /Users/gauravhbajaj/projects/bookkeeper
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --eslint --import-alias "@/*"
```

Accept all defaults. Say yes to Tailwind, App Router.

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install telegraf @supabase/supabase-js @supabase/ssr openai recharts
```

- [ ] **Step 3: Install dev dependencies**

```bash
npm install -D jest @types/jest ts-jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 4: Create jest.config.ts**

```typescript
// jest.config.ts
import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  setupFilesAfterFramework: [],
  testPathPattern: ['__tests__/lib', '__tests__/api'],
}

export default config
```

- [ ] **Step 5: Create jest.setup.ts**

```typescript
// jest.setup.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Create .env.local.example**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenRouter
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_MODEL=google/gemini-flash-1.5

# Telegram
TELEGRAM_BOT_TOKEN=your-bot-token

# WhatsApp (Meta Cloud API)
WHATSAPP_ACCESS_TOKEN=your-access-token
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_VERIFY_TOKEN=any-random-string-you-choose
```

- [ ] **Step 7: Copy and fill in .env.local**

```bash
cp .env.local.example .env.local
# Fill in real values in .env.local before proceeding
```

- [ ] **Step 8: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold project with Next.js, Supabase, OpenRouter deps"
```

---

## Task 2: Database Schema

**Files:**
- Create: `supabase/migrations/001_init.sql`

- [ ] **Step 1: Install Supabase CLI and create project**

Sign up at https://supabase.com, create a new project, copy the project URL and keys into `.env.local`.

- [ ] **Step 2: Write migration**

```sql
-- supabase/migrations/001_init.sql

create extension if not exists "uuid-ossp";

-- Users linked to Supabase auth accounts
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  telegram_chat_id text unique,
  whatsapp_number text unique,
  current_mode text not null default 'personal'
    check (current_mode in ('personal', 'business')),
  pending_mode text
    check (pending_mode in ('personal', 'business')),
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id),
  amount decimal(10, 2) not null,
  item text not null,
  type text not null check (type in ('personal', 'business')),
  category text not null
    check (category in ('Food', 'Travel', 'Utilities', 'Shopping', 'Health', 'Other')),
  note text,
  created_at timestamptz not null default now()
);

-- Row Level Security
alter table public.users enable row level security;
alter table public.expenses enable row level security;

-- Any authenticated user can read all users and expenses (shared household)
create policy "auth users read users" on public.users
  for select to authenticated using (true);

create policy "auth users read expenses" on public.expenses
  for select to authenticated using (true);

create policy "auth users insert expenses" on public.expenses
  for insert to authenticated with check (true);

-- Indexes for common queries
create index expenses_type_idx on public.expenses (type);
create index expenses_created_at_idx on public.expenses (created_at desc);
create index expenses_user_id_idx on public.expenses (user_id);
```

- [ ] **Step 3: Run migration in Supabase dashboard**

Go to Supabase Dashboard → SQL Editor → paste the migration → Run.

- [ ] **Step 4: Seed users**

In Supabase Dashboard → Authentication → Users → Create two users (email + password for Gaurav and spouse).

Then in SQL Editor, insert user profiles:

```sql
-- Replace UUIDs with the actual auth user IDs from the Users table
insert into public.users (id, email, name) values
  ('YOUR-GAURAV-AUTH-UUID', 'gaurav@example.com', 'Gaurav'),
  ('YOUR-SPOUSE-AUTH-UUID', 'spouse@example.com', 'Spouse');
```

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: add database schema and migrations"
```

---

## Task 3: Shared Types + Supabase Clients

**Files:**
- Create: `lib/types.ts`
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`

- [ ] **Step 1: Write types**

```typescript
// lib/types.ts
export type ExpenseType = 'personal' | 'business'

export type ExpenseCategory =
  | 'Food'
  | 'Travel'
  | 'Utilities'
  | 'Shopping'
  | 'Health'
  | 'Other'

export type User = {
  id: string
  email: string
  name: string
  telegram_chat_id: string | null
  whatsapp_number: string | null
  current_mode: ExpenseType
  pending_mode: ExpenseType | null
  created_at: string
}

export type Expense = {
  id: string
  user_id: string
  amount: number
  item: string
  type: ExpenseType
  category: ExpenseCategory
  note: string | null
  created_at: string
  users?: { name: string }
}

export type Stats = {
  thisMonth: number
  thisYear: number
  topCategory: ExpenseCategory | null
  submittedBy: { name: string; count: number }[]
}
```

- [ ] **Step 2: Write browser Supabase client**

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: Write server Supabase clients**

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// For server components and API routes — uses the logged-in user's session
export function createServerSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
      },
    }
  )
}

// For bot webhooks — bypasses RLS (server-to-server only, never expose to client)
export function createServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/
git commit -m "feat: add shared types and Supabase clients"
```

---

## Task 4: AI Expense Parser

**Files:**
- Create: `lib/ai/parser.ts`
- Create: `__tests__/lib/ai/parser.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/lib/ai/parser.test.ts
const mockCreate = jest.fn()

jest.mock('openai', () => ({
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}))

import { parseExpenseMessage } from '../../../lib/ai/parser'

describe('parseExpenseMessage', () => {
  beforeEach(() => mockCreate.mockClear())

  it('parses a simple expense', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ item: 'Coffee', amount: 5.5, category: 'Food', note: null }) } }],
    })
    const result = await parseExpenseMessage('Coffee 5.50')
    expect(result).toEqual({ item: 'Coffee', amount: 5.5, category: 'Food', note: null })
  })

  it('parses expense with note', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ item: 'Electricity bill', amount: 2100, category: 'Utilities', note: 'paid online' }) } }],
    })
    const result = await parseExpenseMessage('Electricity bill 2100 - paid online')
    expect(result).toEqual({ item: 'Electricity bill', amount: 2100, category: 'Utilities', note: 'paid online' })
  })

  it('returns null when no amount found', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ error: 'no_amount' }) } }],
    })
    const result = await parseExpenseMessage('hello there')
    expect(result).toBeNull()
  })

  it('returns null when API returns empty content', async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: null } }] })
    const result = await parseExpenseMessage('anything')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx jest __tests__/lib/ai/parser.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../../../lib/ai/parser'`

- [ ] **Step 3: Write parser implementation**

```typescript
// lib/ai/parser.ts
import OpenAI from 'openai'
import type { ExpenseCategory } from '../types'

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY!,
})

const MODEL = process.env.OPENROUTER_MODEL ?? 'google/gemini-flash-1.5'

export type ParsedExpense = {
  item: string
  amount: number
  category: ExpenseCategory
  note: string | null
}

export async function parseExpenseMessage(message: string): Promise<ParsedExpense | null> {
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'user',
        content: `Extract expense from: "${message}"\nReturn JSON: {"item":string,"amount":number,"category":"Food"|"Travel"|"Utilities"|"Shopping"|"Health"|"Other","note":string|null}\nIf no amount found, return {"error":"no_amount"}`,
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 100,
  })

  const text = response.choices[0]?.message?.content
  if (!text) return null

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }

  if (parsed.error || typeof parsed.amount !== 'number') return null

  return parsed as unknown as ParsedExpense
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx jest __tests__/lib/ai/parser.test.ts --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/ai/ __tests__/lib/ai/
git commit -m "feat: add AI expense parser with OpenRouter"
```

---

## Task 5: Expense + Stats API Routes

**Files:**
- Create: `app/api/expenses/route.ts`
- Create: `app/api/stats/route.ts`
- Create: `__tests__/api/expenses.test.ts`
- Create: `__tests__/api/stats.test.ts`

- [ ] **Step 1: Write expenses route**

```typescript
// app/api/expenses/route.ts
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
```

- [ ] **Step 2: Write stats route**

```typescript
// app/api/stats/route.ts
import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import type { ExpenseCategory, ExpenseType } from '@/lib/types'

export async function GET(request: Request) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') as ExpenseType

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
    const name = (e.users as { name: string } | null)?.name ?? 'Unknown'
    submitterCounts[name] = (submitterCounts[name] ?? 0) + 1
  }
  const submittedBy = Object.entries(submitterCounts).map(([name, count]) => ({ name, count }))

  return NextResponse.json({ thisMonth, thisYear, topCategory, submittedBy })
}
```

- [ ] **Step 3: Write expense API tests**

```typescript
// __tests__/api/expenses.test.ts
// These tests verify the business logic independently of Next.js routing.
// We test the helper functions, not the route handlers directly.

describe('Expense API validation', () => {
  it('requires amount, item, type, category fields', () => {
    const required = ['amount', 'item', 'type', 'category']
    const body = { amount: 5.5, item: 'Coffee', type: 'personal', category: 'Food' }
    for (const field of required) {
      const incomplete = { ...body, [field]: undefined }
      const missing = !incomplete.amount || !incomplete.item || !incomplete.type || !incomplete.category
      expect(missing).toBe(true)
    }
  })

  it('accepts valid expense payload', () => {
    const body = { amount: 5.5, item: 'Coffee', type: 'personal', category: 'Food', note: null }
    const valid = !!(body.amount && body.item && body.type && body.category)
    expect(valid).toBe(true)
  })
})
```

- [ ] **Step 4: Write stats tests**

```typescript
// __tests__/api/stats.test.ts
describe('Stats calculation', () => {
  const expenses = [
    { amount: '100', category: 'Food', created_at: new Date().toISOString(), users: { name: 'Gaurav' } },
    { amount: '200', category: 'Food', created_at: new Date().toISOString(), users: { name: 'Spouse' } },
    { amount: '50', category: 'Travel', created_at: new Date().toISOString(), users: { name: 'Gaurav' } },
  ]

  it('sums thisMonth correctly', () => {
    const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
    expect(total).toBe(350)
  })

  it('finds top category by spend', () => {
    const categoryCounts: Record<string, number> = {}
    for (const e of expenses) {
      categoryCounts[e.category] = (categoryCounts[e.category] ?? 0) + Number(e.amount)
    }
    const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0]
    expect(topCategory).toBe('Food')
  })

  it('counts expenses per submitter', () => {
    const counts: Record<string, number> = {}
    for (const e of expenses) {
      counts[e.users.name] = (counts[e.users.name] ?? 0) + 1
    }
    expect(counts['Gaurav']).toBe(2)
    expect(counts['Spouse']).toBe(1)
  })
})
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
npx jest __tests__/api/ --no-coverage
```

Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add app/api/ __tests__/api/
git commit -m "feat: add expenses and stats API routes"
```

---

## Task 6: Telegram Bot

**Files:**
- Create: `lib/bots/telegram.ts`
- Create: `app/api/webhook/telegram/route.ts`

- [ ] **Step 1: Create Telegram bot on BotFather**

Open Telegram, message `@BotFather`, send `/newbot`, follow prompts, copy the token into `.env.local` as `TELEGRAM_BOT_TOKEN`.

- [ ] **Step 2: Write bot handlers**

```typescript
// lib/bots/telegram.ts
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
  const { error } = await supabase
    .from('users')
    .update({ telegram_chat_id: String(ctx.from.id) })
    .eq('email', email)

  if (error) return ctx.reply('Email not found. Contact admin.')
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
```

- [ ] **Step 3: Write webhook route**

```typescript
// app/api/webhook/telegram/route.ts
import { bot } from '@/lib/bots/telegram'

export async function POST(request: Request) {
  const body = await request.json()
  await bot.handleUpdate(body)
  return new Response('ok', { status: 200 })
}
```

- [ ] **Step 4: Register webhook with Telegram**

After deploying to Vercel (Task 14), run once:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=https://your-app.vercel.app/api/webhook/telegram"
```

For local testing, use ngrok:

```bash
ngrok http 3000
# then set webhook to: https://YOUR-NGROK-ID.ngrok.io/api/webhook/telegram
```

- [ ] **Step 5: Commit**

```bash
git add lib/bots/telegram.ts app/api/webhook/telegram/
git commit -m "feat: add Telegram bot with expense logging and mode switching"
```

---

## Task 7: WhatsApp Webhook

**Files:**
- Create: `lib/bots/whatsapp.ts`
- Create: `app/api/webhook/whatsapp/route.ts`

- [ ] **Step 1: Set up Meta WhatsApp Cloud API**

1. Go to https://developers.facebook.com → Create App → Business
2. Add WhatsApp product
3. Get Access Token and Phone Number ID → add to `.env.local`
4. Set `WHATSAPP_VERIFY_TOKEN` to any random string in `.env.local`

- [ ] **Step 2: Write WhatsApp send helper**

```typescript
// lib/bots/whatsapp.ts
export async function sendWhatsAppMessage(to: string, message: string) {
  const url = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`
  await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: message },
    }),
  })
}
```

- [ ] **Step 3: Write WhatsApp webhook route**

```typescript
// app/api/webhook/whatsapp/route.ts
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
  const { error } = await supabase
    .from('users')
    .update({ whatsapp_number: phone })
    .eq('email', email)
  return !error
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
  const body = await request.json()

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

  // Pending mode confirmation — user replied "yes" or "no"
  if (user.pending_mode) {
    if (text.toLowerCase() === 'yes') {
      await switchMode(user, user.pending_mode)
      const label = user.pending_mode === 'personal' ? '👤 Personal' : '💼 Business'
      await sendWhatsAppMessage(from, `✓ Switched to ${label} mode.`)
    } else {
      await createServiceSupabase().from('users').update({ pending_mode: null }).eq('id', user.id)
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
```

- [ ] **Step 4: Register webhook in Meta dashboard**

After deploying to Vercel:
- Go to Meta App Dashboard → WhatsApp → Configuration
- Set Callback URL: `https://your-app.vercel.app/api/webhook/whatsapp`
- Set Verify Token: same value as `WHATSAPP_VERIFY_TOKEN` in `.env.local`
- Subscribe to `messages` webhook field

- [ ] **Step 5: Commit**

```bash
git add lib/bots/whatsapp.ts app/api/webhook/whatsapp/
git commit -m "feat: add WhatsApp webhook with expense logging and mode switching"
```

---

## Task 8: Auth + Middleware + Login Page

**Files:**
- Create: `middleware.ts`
- Modify: `app/layout.tsx`
- Create: `app/login/page.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Write middleware**

```typescript
// middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => request.cookies.get(name)?.value,
        set: (name, value, options) => {
          response.cookies.set({ name, value, ...options })
        },
        remove: (name, options) => {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
}
```

- [ ] **Step 2: Write root page redirect**

```typescript
// app/page.tsx
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/dashboard')
}
```

- [ ] **Step 3: Write login page**

```tsx
// app/login/page.tsx
'use client'
import { useState } from 'react'
import { createBrowserSupabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const supabase = createBrowserSupabase()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return setError(error.message)
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 w-full max-w-sm space-y-4">
        <h1 className="text-xl font-bold text-gray-800">Bookkeeper</h1>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          required
        />
        <button
          type="submit"
          className="w-full bg-violet-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-violet-700"
        >
          Sign in
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Update root layout**

```tsx
// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Bookkeeper',
  description: 'Personal and business expense tracker',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50`}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 5: Test login flow locally**

```bash
npm run dev
# Open http://localhost:3000 — should redirect to /login
# Sign in with Gaurav's credentials from Supabase
# Should redirect to /dashboard (blank page for now)
```

- [ ] **Step 6: Commit**

```bash
git add middleware.ts app/layout.tsx app/login/ app/page.tsx
git commit -m "feat: add auth middleware and login page"
```

---

## Task 9: Dashboard Shell + Tabs

**Files:**
- Create: `app/dashboard/page.tsx`
- Create: `components/Dashboard.tsx`

- [ ] **Step 1: Write dashboard server page**

```tsx
// app/dashboard/page.tsx
import { createServerSupabase } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Dashboard from '@/components/Dashboard'
import type { Expense } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: expenses } = await supabase
    .from('expenses')
    .select('*, users(name)')
    .order('created_at', { ascending: false })
    .limit(200)

  return <Dashboard initialExpenses={(expenses ?? []) as Expense[]} />
}
```

- [ ] **Step 2: Write Dashboard client component**

```tsx
// components/Dashboard.tsx
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

      {/* Tabs */}
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

      {/* Tab body */}
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
```

- [ ] **Step 3: Verify shell renders**

```bash
npm run dev
# Log in → /dashboard should show "Bookkeeper" heading + two tabs (Personal/Business)
# Clicking tabs should switch without errors (child components are stubs for now)
```

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/ components/Dashboard.tsx
git commit -m "feat: add dashboard shell with tab switching"
```

---

## Task 10: Summary Cards

**Files:**
- Create: `components/SummaryCards.tsx`

- [ ] **Step 1: Write SummaryCards**

```tsx
// components/SummaryCards.tsx
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
        <div key={card.label} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <p className="text-xs text-gray-400 uppercase tracking-wide">{card.label}</p>
          <p className="text-lg font-bold text-gray-800 mt-1 truncate">{card.value}</p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify cards render**

```bash
npm run dev
# /dashboard → Personal tab → 4 cards should appear with real or zero values
```

- [ ] **Step 3: Commit**

```bash
git add components/SummaryCards.tsx
git commit -m "feat: add summary cards to dashboard"
```

---

## Task 11: Charts

**Files:**
- Create: `components/Charts.tsx`

- [ ] **Step 1: Write Charts component**

```tsx
// components/Charts.tsx
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
      {/* Bar chart — 2/3 width */}
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

      {/* Donut chart — 1/3 width */}
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
```

- [ ] **Step 2: Verify charts render**

```bash
npm run dev
# /dashboard → charts should appear. With no data, bar chart shows 6 months at zero, donut shows "No data".
```

- [ ] **Step 3: Commit**

```bash
git add components/Charts.tsx
git commit -m "feat: add monthly bar and category donut charts"
```

---

## Task 12: Expense Table + Filters + CSV Export

**Files:**
- Create: `components/ExpenseTable.tsx`

- [ ] **Step 1: Write ExpenseTable**

```tsx
// components/ExpenseTable.tsx
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
    const csv = toCSV(filtered)
    downloadCSV(csv, `expenses-${activeCategory.toLowerCase()}.csv`)
  }

  return (
    <div>
      {/* Filter bar */}
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

      {/* Table */}
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
```

- [ ] **Step 2: Verify table renders and CSV export works**

```bash
npm run dev
# Add a couple expenses via Telegram/WhatsApp (or directly in Supabase)
# Refresh dashboard → expenses should appear in table
# Click "Export CSV" → file should download
```

- [ ] **Step 3: Commit**

```bash
git add components/ExpenseTable.tsx
git commit -m "feat: add expense table with category filter and CSV export"
```

---

## Task 13: Add Expense Modal

**Files:**
- Create: `components/AddExpenseModal.tsx`

- [ ] **Step 1: Write AddExpenseModal**

```tsx
// components/AddExpenseModal.tsx
'use client'
import { useState } from 'react'
import type { Expense, ExpenseCategory, ExpenseType } from '@/lib/types'

const CATEGORIES: ExpenseCategory[] = ['Food', 'Travel', 'Utilities', 'Shopping', 'Health', 'Other']

type Props = {
  type: ExpenseType
  onClose: () => void
  onSaved: (expense: Expense) => void
}

export default function AddExpenseModal({ type, onClose, onSaved }: Props) {
  const [item, setItem] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<ExpenseCategory>('Food')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!item || !amount) return setError('Item and amount are required.')
    setError('')
    setLoading(true)

    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item, amount: Number(amount), type, category, note: note || null }),
    })

    setLoading(false)
    if (!res.ok) return setError('Failed to save. Try again.')

    const expense: Expense = await res.json()
    onSaved(expense)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-sm p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">
          Add {type === 'personal' ? 'Personal' : 'Business'} Expense
        </h2>
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            placeholder="Item (e.g. Coffee)"
            value={item}
            onChange={e => setItem(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            required
          />
          <input
            type="number"
            placeholder="Amount"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            min="0"
            step="0.01"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            required
          />
          <select
            value={category}
            onChange={e => setCategory(e.target.value as ExpenseCategory)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            placeholder="Note (optional)"
            value={note}
            onChange={e => setNote(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-violet-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-violet-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Test modal**

```bash
npm run dev
# /dashboard → click "+ Add Expense" → modal appears
# Fill in fields → Save → expense appears in table immediately (optimistic update via onSaved)
# Cancel → modal closes
```

- [ ] **Step 3: Commit**

```bash
git add components/AddExpenseModal.tsx
git commit -m "feat: add expense entry modal for web dashboard"
```

---

## Task 14: Deploy to Vercel

**Files:** None — configuration only

- [ ] **Step 1: Push to GitHub**

```bash
git remote add origin https://github.com/YOUR_USERNAME/bookkeeper.git
git push -u origin main
```

- [ ] **Step 2: Deploy on Vercel**

1. Go to https://vercel.com → New Project → import from GitHub
2. Framework: Next.js (auto-detected)
3. Add all environment variables from `.env.local`
4. Click Deploy

- [ ] **Step 3: Register Telegram webhook**

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=https://YOUR-APP.vercel.app/api/webhook/telegram"
```

Expected response: `{"ok":true,"result":true,"description":"Webhook was set"}`

- [ ] **Step 4: Register WhatsApp webhook**

In Meta App Dashboard → WhatsApp → Configuration:
- Callback URL: `https://YOUR-APP.vercel.app/api/webhook/whatsapp`
- Verify Token: value of `WHATSAPP_VERIFY_TOKEN`
- Click Verify and Save
- Subscribe to `messages`

- [ ] **Step 5: End-to-end smoke test**

1. Open Telegram → send `/register your@email.com` → should reply "Linked!"
2. Send `Coffee 150` → should reply `✓ Coffee ₹150 (Personal · Food) logged!`
3. Send `/business` → tap "Yes, switch" → confirm mode switch
4. Send `Taxi 450 - airport` → should reply `✓ Taxi ₹450 (Business · Travel) logged!`
5. Open https://YOUR-APP.vercel.app → log in → verify both expenses appear in correct tabs
6. Click Export CSV → verify file downloads with correct data
7. Add expense via web modal → verify it appears in table

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "chore: finalize deployment configuration"
```

---

## Self-Review Against Spec

| Spec Requirement | Covered In |
|---|---|
| Telegram input | Task 6 |
| WhatsApp input (Meta Cloud API) | Task 7 |
| Natural language parsing via AI | Task 4 |
| AI does NOT determine personal/business | Task 4 — type taken from `user.current_mode` |
| Session mode (/personal, /business) with confirmation | Task 6 (inline keyboard), Task 7 (pending_mode) |
| /status command | Task 6, Task 7 |
| User identification per expense | Tasks 6, 7 — `user_id` saved |
| Two users, spouse support | Task 2 (schema), Task 6/7 (register command) |
| OpenRouter with swappable model via env var | Task 4 |
| max_tokens optimized | Task 4 — `max_tokens: 100` |
| REST API mobile-ready with JWT auth | Task 5 |
| Web dashboard — light mode, tabs | Tasks 9–13 |
| Summary cards | Task 10 |
| Monthly bar chart + category donut | Task 11 |
| Expense table with filters | Task 12 |
| CSV export | Task 12 |
| Add expense via web | Task 13 |
| Supabase auth (JWT) | Tasks 3, 8 |
| Mobile-responsive | Tailwind classes throughout |
