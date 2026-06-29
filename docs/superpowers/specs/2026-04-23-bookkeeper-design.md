# Bookkeeper — Design Spec
**Date:** 2026-04-23

## Overview

A two-user expense tracking app for Gaurav and his spouse. Expenses are submitted via Telegram and WhatsApp using natural language messages. A mobile-friendly web dashboard provides summary cards, charts, filtering, and CSV export. The API is designed to support a future mobile app without changes.

---

## Users & Authentication

- Two users: Gaurav and spouse
- Auth via Supabase (JWT-based, works for web and future mobile)
- Each user is linked to their Telegram chat ID and WhatsApp number
- The submitter is recorded on every expense

**`users` table**
| field | type | notes |
|---|---|---|
| id | uuid | Supabase auth user ID |
| name | text | "Gaurav" / "Spouse" |
| telegram_chat_id | text | links Telegram identity |
| whatsapp_number | text | links WhatsApp identity |
| current_mode | enum | `personal` \| `business`, default `personal` |

---

## Expense Input — Telegram & WhatsApp

### Channels
- **Telegram**: Telegraf.js (official Bot API, free)
- **WhatsApp**: Meta WhatsApp Cloud API (free tier, up to 1,000 conversations/month)

### Session Mode
- Default mode: `personal`
- Send `/business` → bot asks "Switch to Business mode?" → user confirms → mode persists for all future expenses
- Send `/personal` → same confirmation flow to switch back
- Mode is stored per user in the database (`current_mode`)

### Submitting an Expense
User sends a natural language message:
```
"Coffee 5.50"
"Electricity bill 2100 - paid online"
"Grabbed groceries 1450"
```

### Parsing Flow
1. Message received at webhook (`/api/webhook/telegram` or `/api/webhook/whatsapp`)
2. User identified by chat ID / phone number
3. AI (via OpenRouter — model configurable via `OPENROUTER_MODEL` env var, default: `google/gemini-flash-1.5`) extracts structured data:
   - `amount` — numeric value
   - `item` — what the expense was for
   - `category` — inferred from item (Food, Travel, Utilities, Shopping, Health, Other)
   - `note` — optional, anything that reads as context (e.g. "paid online", "client meeting")
4. `type` (personal/business) is taken from the user's current session mode — AI does NOT determine this
5. Expense saved to database
6. Bot replies: `"✓ Coffee ₹5.50 (Personal · Food) logged!"`
7. If AI cannot extract a valid amount, bot replies: `"Couldn't understand that. Try: Coffee 5.50"`

### Bot Commands
| command | action |
|---|---|
| `/business` | confirm then switch mode to business |
| `/personal` | confirm then switch mode to personal |
| `/status` | show current mode and last 3 expenses |

---

## Data Model

**`expenses` table**
| field | type | notes |
|---|---|---|
| id | uuid | |
| user_id | uuid | who submitted |
| amount | decimal | |
| item | text | e.g. "Coffee" |
| type | enum | `personal` \| `business` |
| category | enum | Food, Travel, Utilities, Shopping, Health, Other |
| note | text | optional |
| created_at | timestamp | defaults to now |

**`categories`** — seeded enum: Food, Travel, Utilities, Shopping, Health, Other. Expandable in future.

---

## Architecture

```
Telegram / WhatsApp
       ↓
   Bot Webhook (Next.js API route)
       ↓
   AI Parser (Claude API) — extracts item, amount, category, note
       ↓
   REST API (/api/expenses, /api/users, /api/stats)
       ↓
   Supabase (PostgreSQL + Auth)
       ↑
   Web Dashboard (Next.js — mobile responsive)
       ↑
   Future Mobile App (React Native / Flutter)
```

### Tech Stack
| layer | technology |
|---|---|
| Framework | Next.js (App Router) |
| Hosting | Vercel |
| Database + Auth | Supabase (PostgreSQL + JWT) |
| Telegram bot | Telegraf.js |
| WhatsApp | Meta WhatsApp Cloud API |
| AI parsing | OpenRouter (model-agnostic, OpenAI-compatible API) |
| Charts | Recharts |

### API Design (mobile-ready REST)
- `POST /api/webhook/telegram` — Telegram webhook
- `POST /api/webhook/whatsapp` — WhatsApp webhook
- `GET /api/expenses` — list expenses (filterable by type, category, date range)
- `POST /api/expenses` — create expense (for future manual entry)
- `GET /api/stats` — summary totals for dashboard cards

All endpoints use JWT auth (Bearer token) — consumable by web and mobile clients.

### AI Abstraction
All AI calls go through a single `lib/ai/parser.ts` module. It uses OpenRouter's OpenAI-compatible API, so switching models requires only changing the `OPENROUTER_MODEL` environment variable (e.g. `google/gemini-flash-1.5`, `anthropic/claude-3-haiku`, `openai/gpt-4o-mini`). No code changes needed to swap models.

---

## Web Dashboard

### Layout
- Light mode, mobile-responsive
- Two tabs: **Personal** and **Business** (each fully independent view)

### Per Tab
1. **Summary cards** — This Month total, This Year total, Top Category, Submitted By breakdown
2. **Charts** — Monthly bar chart (last 6 months) + Category donut chart
3. **Expense table** — Item, Category badge, Date, Amount, Submitter name
   - Filter buttons by category
   - Export to CSV button
4. **Add Expense button** — opens a simple form: Item, Amount, Category (dropdown), Note (optional). Type is pre-set to the active tab (personal/business).

---

## Phase 2 (Future)
- Small business accounting: invoices, ledgers, reports
- Mobile app (React Native or Flutter) — API is already compatible
- Additional WhatsApp features as Meta API usage grows

---

## Out of Scope (v1)
- Budget limits or alerts
- Multi-currency
- Receipt photo uploads
