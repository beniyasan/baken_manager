-- Redefine consume_ocr_credit to rely on auth.uid() and enforce per-role limits
-- while keeping row level security policies intact.
drop function if exists public.consume_ocr_credit(target_user uuid, target_month date, usage_limit integer);

drop function if exists public.get_auth_uid_or_null();

drop function if exists public.consume_ocr_credit();

create or replace function public.consume_ocr_credit()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_month date := date_trunc('month', now())::date;
  v_limit int;
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select user_role into v_role
    from public.profiles
   where id = auth.uid();

  if v_role is null then
    raise exception 'profile not found for current user';
  end if;

  v_limit := case v_role
               when 'free'    then 50
               when 'premium' then 1000
               when 'admin'   then 100000000
             end;

  insert into public.ocr_usage_monthly(user_id, usage_month, usage_count)
  values (auth.uid(), v_month, 0)
  on conflict (user_id, usage_month) do nothing;

  select usage_count
    into v_count
    from public.ocr_usage_monthly
   where user_id = auth.uid()
     and usage_month = v_month
   for update;

  if v_count >= v_limit then
    return false;
  end if;

  update public.ocr_usage_monthly
     set usage_count = v_count + 1,
         updated_at = now()
   where user_id = auth.uid()
     and usage_month = v_month;

  return true;
end
$$;

grant execute on function public.consume_ocr_credit() to authenticated;

grant execute on function public.consume_ocr_credit() to service_role;

create or replace function public.get_auth_uid_or_null()
returns uuid
language sql
stable
as $$
  select auth.uid()
$$;

grant execute on function public.get_auth_uid_or_null() to authenticated;

grant execute on function public.get_auth_uid_or_null() to service_role;
