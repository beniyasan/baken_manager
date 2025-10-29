-- Ensure authenticated users can consume OCR credits via RPC
grant execute on function public.consume_ocr_credit(target_month date, usage_limit integer) to authenticated;
grant execute on function public.consume_ocr_credit(target_month date, usage_limit integer) to service_role;
