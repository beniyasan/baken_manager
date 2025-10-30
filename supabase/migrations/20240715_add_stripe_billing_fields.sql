alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text,
  add column if not exists subscription_status text,
  add column if not exists current_period_end timestamptz,
  add column if not exists cancel_at_period_end boolean default false;

create table if not exists public.stripe_event_log (
  event_id text primary key,
  type text not null,
  received_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz,
  ok boolean,
  note text
);
