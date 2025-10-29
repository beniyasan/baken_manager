-- Redefine consume_ocr_credit to accept an explicit target user and support service role execution
-- while keeping per-user limits enforced.
drop function if exists public.consume_ocr_credit(target_month date, usage_limit integer);

do $$
begin
  if not exists (
    select 1
      from pg_proc
     where proname = 'consume_ocr_credit'
       and pronamespace = 'public'::regnamespace
       and oidvectortypes(proargtypes) = 'uuid, date, integer'
  ) then
    -- noop; just here to avoid errors if the function already matches the new signature
    null;
  end if;
end;
$$;

create or replace function public.consume_ocr_credit(
  target_user uuid,
  target_month date,
  usage_limit integer default 10
)
returns table(success boolean, usage_count integer)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
    requester uuid := auth.uid();
    requester_role text := current_setting('request.jwt.claim.role', true);
    effective_user uuid := target_user;
    current_count integer;
begin
    if usage_limit is null or usage_limit <= 0 then
        return query select true as success, coalesce(usage_limit, 0) as usage_count;
    end if;

    if effective_user is null then
        raise exception 'target_user is required';
    end if;

    if requester is not null then
        if requester <> effective_user and not public.is_admin() then
            raise exception 'insufficient privileges to consume OCR credits for another user';
        end if;
    elsif coalesce(requester_role, '') <> 'service_role' then
        raise exception 'auth.uid() is not available for consume_ocr_credit';
    end if;

    insert into public.ocr_usage_monthly (user_id, usage_month, usage_count)
    values (effective_user, target_month, 0)
    on conflict (user_id, usage_month) do nothing;

    select usage_count into current_count
      from public.ocr_usage_monthly
     where user_id = effective_user
       and usage_month = target_month
     for update;

    if current_count >= usage_limit then
        return query select false as success, current_count as usage_count;
    end if;

    update public.ocr_usage_monthly
       set usage_count = usage_count + 1,
           updated_at = timezone('utc', now())
     where user_id = effective_user
       and usage_month = target_month;

    select usage_count into current_count
      from public.ocr_usage_monthly
     where user_id = effective_user
       and usage_month = target_month;

    return query select true as success, current_count as usage_count;
end;
$$;

grant execute on function public.consume_ocr_credit(target_user uuid, target_month date, usage_limit integer) to authenticated;
grant execute on function public.consume_ocr_credit(target_user uuid, target_month date, usage_limit integer) to service_role;
