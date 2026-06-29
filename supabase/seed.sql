-- supabase/seed.sql
-- Run this AFTER applying 001_init.sql AND after creating auth users in Supabase Dashboard.
-- Replace the UUIDs below with the actual auth user IDs from Dashboard → Authentication → Users.

insert into public.users (id, email, name) values
  ('38400b58-c128-4f20-a7c9-94a4b728e7fe', 'epiphanytechconsulting@gmail.com', 'Gaurav'),
  ('db6ac79e-f193-432f-93c9-0c1096ee2a72', 'bajaj.poonamg@gmail.com', 'Poonam');
