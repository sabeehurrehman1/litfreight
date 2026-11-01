-- LITFREIGHT initial production schema for Supabase (PostgreSQL)
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  business_name text,
  phone text,
  country text,
  account_type text default 'Buyer and Seller',
  role text not null default 'customer' check (role in ('customer','seller','admin')),
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,full_name,business_name,phone,country,account_type)
  values(new.id,new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'business_name',new.raw_user_meta_data->>'phone',new.raw_user_meta_data->>'country',coalesce(new.raw_user_meta_data->>'account_type','Buyer and Seller'))
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create table if not exists public.buying_requests (
  id uuid primary key default gen_random_uuid(), name text not null, email text not null, phone text not null,
  country text not null, product text not null, category text, quantity text, target_price text,
  destination text, details text, status text not null default 'pending' check(status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
create table if not exists public.freight_quotes (
  id uuid primary key default gen_random_uuid(), name text not null, email text not null, origin text not null,
  destination text not null, freight_mode text, weight text, details text,
  status text not null default 'pending', created_at timestamptz not null default now()
);
create table if not exists public.product_enquiries (
  id uuid primary key default gen_random_uuid(), name text not null, email text not null,
  message text not null, product_reference text, status text not null default 'new', created_at timestamptz not null default now()
);
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(), seller_id uuid references auth.users(id) on delete set null,
  name text not null, category text, moq text, price text, description text,
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);
create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(), tracking_no text not null unique,
  status text not null default 'Booked' check(status in ('Booked','Processing','Dispatched','In Transit','Out for Delivery','Delivered','On Hold')),
  origin text, destination text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.shipment_events (
  id uuid primary key default gen_random_uuid(), shipment_id uuid not null references public.shipments(id) on delete cascade,
  status text not null, location text, note text, created_at timestamptz not null default now()
);
create index if not exists shipment_events_shipment_created_idx on public.shipment_events(shipment_id,created_at desc);

-- Keep the public tracking response limited to tracking number, route, status and event history.
create or replace function public.track_litfreight_shipment(p_tracking_no text)
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'tracking_no',s.tracking_no,'status',s.status,'origin',s.origin,'destination',s.destination,
    'events',coalesce((select jsonb_agg(jsonb_build_object('status',e.status,'location',e.location,'note',e.note,'created_at',e.created_at) order by e.created_at desc)
      from public.shipment_events e where e.shipment_id=s.id),'[]'::jsonb)
  ) from public.shipments s where upper(s.tracking_no)=upper(trim(p_tracking_no)) limit 1;
$$;
revoke all on function public.track_litfreight_shipment(text) from public;
grant execute on function public.track_litfreight_shipment(text) to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.buying_requests enable row level security;
alter table public.freight_quotes enable row level security;
alter table public.product_enquiries enable row level security;
alter table public.products enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_events enable row level security;

-- Helper: only a profile with role=admin can manage operational records.
create or replace function public.is_litfreight_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='admin');
$$;

 drop policy if exists "profile owner reads own profile" on public.profiles;
create policy "profile owner reads own profile" on public.profiles for select to authenticated using (id=auth.uid() or public.is_litfreight_admin());
drop policy if exists "profile owner updates own profile" on public.profiles;
create policy "profile owner updates own profile" on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid() and role='customer');
drop policy if exists "admin manages profiles" on public.profiles;
create policy "admin manages profiles" on public.profiles for all to authenticated using (public.is_litfreight_admin()) with check (public.is_litfreight_admin());

 drop policy if exists "guest can submit buying requests" on public.buying_requests;
create policy "guest can submit buying requests" on public.buying_requests for insert to anon,authenticated with check (status='pending');
drop policy if exists "admin manages buying requests" on public.buying_requests;
create policy "admin manages buying requests" on public.buying_requests for all to authenticated using (public.is_litfreight_admin()) with check (public.is_litfreight_admin());
drop policy if exists "guest can submit freight quotes" on public.freight_quotes;
create policy "guest can submit freight quotes" on public.freight_quotes for insert to anon,authenticated with check (status='pending');
drop policy if exists "admin manages freight quotes" on public.freight_quotes;
create policy "admin manages freight quotes" on public.freight_quotes for all to authenticated using (public.is_litfreight_admin()) with check (public.is_litfreight_admin());
drop policy if exists "guest can submit product enquiries" on public.product_enquiries;
create policy "guest can submit product enquiries" on public.product_enquiries for insert to anon,authenticated with check (status='new');
drop policy if exists "admin manages product enquiries" on public.product_enquiries;
create policy "admin manages product enquiries" on public.product_enquiries for all to authenticated using (public.is_litfreight_admin()) with check (public.is_litfreight_admin());

drop policy if exists "public reads approved products" on public.products;
create policy "public reads approved products" on public.products for select to anon,authenticated using (status='approved');
drop policy if exists "seller submits own products" on public.products;
create policy "seller submits own products" on public.products for insert to authenticated with check (seller_id=auth.uid() and status='pending');
drop policy if exists "seller reads own products" on public.products;
create policy "seller reads own products" on public.products for select to authenticated using (seller_id=auth.uid() or public.is_litfreight_admin());
drop policy if exists "admin manages products" on public.products;
create policy "admin manages products" on public.products for all to authenticated using (public.is_litfreight_admin()) with check (public.is_litfreight_admin());

drop policy if exists "admin manages shipments" on public.shipments;
create policy "admin manages shipments" on public.shipments for all to authenticated using (public.is_litfreight_admin()) with check (public.is_litfreight_admin());
drop policy if exists "admin manages shipment events" on public.shipment_events;
create policy "admin manages shipment events" on public.shipment_events for all to authenticated using (public.is_litfreight_admin()) with check (public.is_litfreight_admin());

-- Example shipment setup (run only after replacing the reference):
-- insert into public.shipments(tracking_no,status,origin,destination) values ('LIT-2026-0001','Booked','Lahore, Pakistan','London, UK');
-- insert into public.shipment_events(shipment_id,status,location,note)
-- select id,'Booked','Lahore, Pakistan','Shipment record created' from public.shipments where tracking_no='LIT-2026-0001';
