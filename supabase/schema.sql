-- Run once in your FREE Supabase project's SQL Editor. Safe to run again.
create table if not exists public.approval_rooms (
  id text primary key check (id ~ '^[a-f0-9]{36}$'),
  version integer not null default 0 check (version >= 0),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  created_at timestamptz not null default now(),
  constraint matching_version check ((state->>'version')::integer = version)
);

alter table public.approval_rooms enable row level security;
-- No browser/public policies. Only the backend service-role credential can access rows.
revoke all on table public.approval_rooms from public, anon, authenticated;
grant select, insert, update on table public.approval_rooms to service_role;
