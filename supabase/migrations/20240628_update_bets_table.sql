-- Extend bets table to store aggregated ticket data per user session.

alter table public.bets
    add column if not exists source text not null default 'unknown';

alter table public.bets
    add column if not exists bets jsonb not null default '[]'::jsonb;

alter table public.bets
    add column if not exists image_data text;

-- Optional cached recovery rate to avoid recalculating client-side if desired.
alter table public.bets
    add column if not exists recovery_rate numeric(8,2);

-- Drop defaults after ensuring future inserts always provide values explicitly.
alter table public.bets
    alter column source drop default,
    alter column bets drop default;
