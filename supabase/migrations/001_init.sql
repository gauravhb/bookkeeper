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
