-- Supabase schema initialization for keiba-ocr
-- Run this script via Supabase CLI (`supabase db push`) or SQL Editor.

-- Required extension for UUID generation
create extension if not exists "pgcrypto" with schema public;

-- Profiles -------------------------------------------------------------------
create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text,
    created_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
    on public.profiles
    for select
    using (auth.uid() = id);

create policy "Users can update own profile"
    on public.profiles
    for update
    using (auth.uid() = id)
    with check (auth.uid() = id);

-- Automatically provision profile rows when a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Shared updated_at trigger ---------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- Bets -----------------------------------------------------------------------
create table if not exists public.bets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    race_date date not null,
    race_name text not null,
    track text,
    ticket_type text not null,
    amount_bet integer not null check (amount_bet >= 0),
    amount_returned integer check (amount_returned >= 0),
    memo text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

alter table public.bets enable row level security;

create policy "Users can read own bets"
    on public.bets
    for select
    using (auth.uid() = user_id);

create policy "Users can insert own bets"
    on public.bets
    for insert
    with check (auth.uid() = user_id);

create policy "Users can update own bets"
    on public.bets
    for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

create policy "Users can delete own bets"
    on public.bets
    for delete
    using (auth.uid() = user_id);

drop trigger if exists bets_set_updated_at on public.bets;
create trigger bets_set_updated_at
before update on public.bets
for each row
execute function public.set_updated_at();

-- Tickets --------------------------------------------------------------------
create table if not exists public.tickets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    bet_id uuid references public.bets(id) on delete cascade,
    image_path text not null,
    ocr_payload jsonb,
    created_at timestamptz not null default timezone('utc', now())
);

alter table public.tickets enable row level security;

create policy "Users can read own tickets"
    on public.tickets
    for select
    using (auth.uid() = user_id);

create policy "Users can insert own tickets"
    on public.tickets
    for insert
    with check (auth.uid() = user_id);

create policy "Users can manage own tickets"
    on public.tickets
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Stats cache ----------------------------------------------------------------
create table if not exists public.stats_cache (
    user_id uuid not null references public.profiles(id) on delete cascade,
    snapshot_date date not null default (timezone('utc', now()))::date,
    stats jsonb not null,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    primary key (user_id, snapshot_date)
);

alter table public.stats_cache enable row level security;

create policy "Users can read own stats cache"
    on public.stats_cache
    for select
    using (auth.uid() = user_id);

create policy "Users can upsert own stats cache"
    on public.stats_cache
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop trigger if exists stats_cache_set_updated_at on public.stats_cache;
create trigger stats_cache_set_updated_at
before update on public.stats_cache
for each row
execute function public.set_updated_at();
