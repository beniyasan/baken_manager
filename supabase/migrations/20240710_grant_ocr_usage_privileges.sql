-- Ensure authenticated users can read their OCR usage records
grant usage on schema public to authenticated;

grant select on table public.ocr_usage_monthly to authenticated;
