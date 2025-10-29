-- Track monthly OCR usage per user and enforce consumption helpers

create table if not exists public.ocr_usage_monthly (
    user_id uuid not null references public.profiles(id) on delete cascade,
    usage_month date not null,
    usage_count integer not null default 0,
    updated_at timestamptz not null default timezone('utc', now()),
    primary key (user_id, usage_month)
);

alter table public.ocr_usage_monthly enable row level security;

create policy "Users can read own ocr usage"
    on public.ocr_usage_monthly
    for select
    using (auth.uid() = user_id or public.is_admin());

create policy "Users can upsert own ocr usage"
    on public.ocr_usage_monthly
    for insert
    with check (auth.uid() = user_id or public.is_admin());

create policy "Users can update own ocr usage"
    on public.ocr_usage_monthly
    for update
    using (auth.uid() = user_id or public.is_admin())
    with check (auth.uid() = user_id or public.is_admin());

create policy "Admins can delete ocr usage"
    on public.ocr_usage_monthly
    for delete
    using (public.is_admin());

drop trigger if exists ocr_usage_monthly_set_updated_at on public.ocr_usage_monthly;
create trigger ocr_usage_monthly_set_updated_at
before update on public.ocr_usage_monthly
for each row
execute function public.set_updated_at();

create or replace function public.consume_ocr_credit(target_month date, usage_limit integer default 10)
returns table(success boolean, usage_count integer)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    current_count integer;
begin
    if usage_limit is null or usage_limit <= 0 then
        return query select true as success, usage_limit as usage_count;
    end if;

    insert into public.ocr_usage_monthly (user_id, usage_month, usage_count)
    values (auth.uid(), target_month, 0)
    on conflict (user_id, usage_month) do nothing;

    select usage_count into current_count
      from public.ocr_usage_monthly
     where user_id = auth.uid()
       and usage_month = target_month
     for update;

    if current_count >= usage_limit then
        return query select false as success, current_count as usage_count;
    end if;

    update public.ocr_usage_monthly
       set usage_count = usage_count + 1,
           updated_at = timezone('utc', now())
     where user_id = auth.uid()
       and usage_month = target_month;

    select usage_count into current_count
      from public.ocr_usage_monthly
     where user_id = auth.uid()
       and usage_month = target_month;

    return query select true as success, current_count as usage_count;
end;
$$;
