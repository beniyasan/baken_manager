-- Add user roles and supporting helpers for plan-based access control

-- 1. enum type and column ------------------------------------------------------
create type if not exists public.user_role as enum ('free', 'premium', 'admin');

alter table public.profiles
    add column if not exists user_role public.user_role not null default 'free';

update public.profiles
   set user_role = 'free'
 where user_role is null;

-- 2. helper functions ----------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and user_role = 'admin'
  );
$$;

create or replace function public.has_premium()
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and user_role in ('premium', 'admin')
  );
$$;

-- 3. trigger update ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (id, display_name, user_role)
  values (new.id, new.raw_user_meta_data->>'display_name', 'free')
  on conflict (id) do update
    set display_name = excluded.display_name,
        user_role = excluded.user_role;
  return new;
end;
$$;

-- 4. RLS policies --------------------------------------------------------------
-- Profiles
alter policy "Users can view own profile"
    on public.profiles
    using (auth.uid() = id or public.is_admin());

alter policy "Users can update own profile"
    on public.profiles
    using (auth.uid() = id or public.is_admin())
    with check (auth.uid() = id or public.is_admin());

-- Bets
alter policy "Users can read own bets"
    on public.bets
    using (auth.uid() = user_id or public.is_admin());

alter policy "Users can insert own bets"
    on public.bets
    with check (auth.uid() = user_id or public.is_admin());

alter policy "Users can update own bets"
    on public.bets
    using (auth.uid() = user_id or public.is_admin())
    with check (auth.uid() = user_id or public.is_admin());

alter policy "Users can delete own bets"
    on public.bets
    using (auth.uid() = user_id or public.is_admin());

-- Tickets
alter policy "Users can read own tickets"
    on public.tickets
    using (auth.uid() = user_id or public.is_admin());

alter policy "Users can insert own tickets"
    on public.tickets
    with check (auth.uid() = user_id or public.is_admin());

alter policy "Users can manage own tickets"
    on public.tickets
    using (auth.uid() = user_id or public.is_admin())
    with check (auth.uid() = user_id or public.is_admin());

-- Stats cache
alter policy "Users can read own stats cache"
    on public.stats_cache
    using (auth.uid() = user_id or public.is_admin());

alter policy "Users can upsert own stats cache"
    on public.stats_cache
    using (auth.uid() = user_id or public.is_admin())
    with check (auth.uid() = user_id or public.is_admin());
