-- supabase/seed.sql
-- Run this AFTER applying 001_init.sql AND after creating auth users in Supabase Dashboard.
-- Replace the UUIDs below with the actual auth user IDs from Dashboard → Authentication → Users.

insert into public.users (id, email, name) values
  ('REPLACE-WITH-GAURAV-AUTH-UUID', 'gaurav@example.com', 'Gaurav'),
  ('REPLACE-WITH-SPOUSE-AUTH-UUID', 'spouse@example.com', 'Spouse');
