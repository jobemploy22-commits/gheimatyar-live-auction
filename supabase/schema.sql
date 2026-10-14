-- Gheimatyar Phase 1 (Postgres + Supabase Auth + RLS)
-- Run once with the Supabase migration tool. No secret key belongs in frontend.
create table if not exists public.market_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 80),
  city text not null default 'ایران' check (char_length(btrim(city)) between 2 and 80),
  role text not null check (role in ('buyer','seller')),
  created_at timestamptz not null default now()
);
create table if not exists public.market_requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.market_profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 4 and 110),
  category text not null check (category in ('digital','car','gold','property','construction','service')),
  city text not null check (char_length(btrim(city)) between 2 and 80),
  description text not null check (char_length(btrim(description)) between 8 and 1500),
  budget bigint not null check (budget between 1000 and 1000000000000000),
  deadline timestamptz not null,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  constraint valid_deadline check (deadline > created_at)
);
create index if not exists market_requests_open_idx on public.market_requests(status, deadline, created_at desc);
create index if not exists market_requests_buyer_idx on public.market_requests(buyer_id, created_at desc);
create table if not exists public.market_offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.market_requests(id) on delete cascade,
  seller_id uuid not null references public.market_profiles(id) on delete cascade,
  seller_name text not null default '',
  seller_city text not null default '',
  price bigint not null check (price between 1000 and 1000000000000000),
  delivery_days integer not null check (delivery_days between 0 and 180),
  notes text not null default '' check (char_length(notes) <= 750),
  created_at timestamptz not null default now(),
  unique (request_id, seller_id)
);
create index if not exists market_offers_request_idx on public.market_offers(request_id, price);
create index if not exists market_offers_seller_idx on public.market_offers(seller_id, created_at desc);

create or replace function public.market_create_profile()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  n text;
  c text;
  selected_role text;
begin
  n := nullif(btrim(left(coalesce(new.raw_user_meta_data ->> 'name',''),80)), '');
  c := nullif(btrim(left(coalesce(new.raw_user_meta_data ->> 'city',''),80)), '');
  selected_role := case when new.raw_user_meta_data ->> 'role' = 'seller' then 'seller' else 'buyer' end;
  insert into public.market_profiles(id,display_name,city,role)
  values(new.id,
         case when char_length(coalesce(n,''))>=2 then n else 'کاربر قیمت‌یار' end,
         case when char_length(coalesce(c,''))>=2 then c else 'ایران' end,
         selected_role)
  on conflict(id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_market_auth_user_created on auth.users;
create trigger on_market_auth_user_created after insert on auth.users
for each row execute function public.market_create_profile();

create or replace function public.market_validate_request()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.deadline <= now() or new.deadline > now() + interval '30 days' then
    raise exception 'Deadline must be within 30 days';
  end if;
  if new.status <> 'open' then raise exception 'New requests must be open'; end if;
  return new;
end;
$$;
drop trigger if exists market_validate_request_insert on public.market_requests;
create trigger market_validate_request_insert before insert on public.market_requests
for each row execute function public.market_validate_request();

create or replace function public.market_validate_offer()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  s public.market_profiles%rowtype;
  r public.market_requests%rowtype;
begin
  if auth.uid() is null or new.seller_id <> auth.uid() then
    raise exception 'Sign in as the seller';
  end if;
  select * into s from public.market_profiles where id = auth.uid();
  if not found or s.role <> 'seller' then raise exception 'Seller account required'; end if;
  select * into r from public.market_requests where id = new.request_id for update;
  if not found or r.status <> 'open' or r.deadline <= now() then
    raise exception 'Request no longer accepting offers';
  end if;
  if r.buyer_id = auth.uid() then raise exception 'Cannot bid on own request'; end if;
  new.seller_name := s.display_name;
  new.seller_city := s.city;
  return new;
end;
$$;
drop trigger if exists market_validate_offer_insert on public.market_offers;
create trigger market_validate_offer_insert before insert on public.market_offers
for each row execute function public.market_validate_offer();

alter table public.market_profiles enable row level security;
alter table public.market_requests enable row level security;
alter table public.market_offers enable row level security;
drop policy if exists market_profiles_self_read on public.market_profiles;
create policy market_profiles_self_read on public.market_profiles
for select to authenticated using(id = (select auth.uid()));
drop policy if exists market_requests_open_or_owner on public.market_requests;
create policy market_requests_open_or_owner on public.market_requests
for select to anon,authenticated
using((status='open' and deadline>now()) or buyer_id = (select auth.uid()));
drop policy if exists market_requests_buyer_insert on public.market_requests;
create policy market_requests_buyer_insert on public.market_requests
for insert to authenticated with check(
  buyer_id=(select auth.uid()) and status='open'
  and exists(select 1 from public.market_profiles p where p.id=(select auth.uid()) and p.role='buyer')
);
drop policy if exists market_offers_seller_or_buyer_read on public.market_offers;
create policy market_offers_seller_or_buyer_read on public.market_offers
for select to authenticated using(
  seller_id=(select auth.uid()) or
  exists(select 1 from public.market_requests r where r.id=request_id and r.buyer_id=(select auth.uid()))
);
drop policy if exists market_offers_seller_insert on public.market_offers;
create policy market_offers_seller_insert on public.market_offers
for insert to authenticated with check(
  seller_id=(select auth.uid())
  and exists(select 1 from public.market_profiles p where p.id=(select auth.uid()) and p.role='seller')
  and exists(select 1 from public.market_requests r where r.id=request_id and r.status='open'
             and r.deadline>now() and r.buyer_id<>(select auth.uid()))
);

revoke all on public.market_profiles from anon,authenticated;
revoke all on public.market_requests from anon,authenticated;
revoke all on public.market_offers from anon,authenticated;
grant select on public.market_profiles to authenticated;
grant select on public.market_requests to anon,authenticated;
grant insert on public.market_requests to authenticated;
grant select on public.market_offers to authenticated;
grant insert (request_id,seller_id,price,delivery_days,notes) on public.market_offers to authenticated;

create or replace function public.market_close_request(p_request_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.market_requests set status='closed'
  where id=p_request_id and buyer_id=auth.uid() and status='open';
  if not found then raise exception 'Open owned request not found'; end if;
end;
$$;
revoke all on function public.market_close_request(uuid) from public,anon;
grant execute on function public.market_close_request(uuid) to authenticated;

-- Realtime only exposes changes allowed by RLS.
do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
                  and schemaname='public' and tablename='market_requests') then
      alter publication supabase_realtime add table public.market_requests;
    end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
                  and schemaname='public' and tablename='market_offers') then
      alter publication supabase_realtime add table public.market_offers;
    end if;
  end if;
end;
$$;