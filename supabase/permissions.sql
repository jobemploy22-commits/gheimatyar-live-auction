-- Harden trigger-only security definer functions
revoke execute on function public.market_create_profile() from public, anon, authenticated;
revoke execute on function public.market_validate_request() from public, anon, authenticated;
revoke execute on function public.market_validate_offer() from public, anon, authenticated;
-- market_close_request is intentionally callable only by signed-in users.
