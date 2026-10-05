create table if not exists public.service_types (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 60),
  icon text not null default '🚕' check (char_length(icon) between 1 and 12),
  description text not null default '' check (char_length(description) <= 180),
  base_fare numeric(10,2) not null default 0 check (base_fare >= 0),
  per_km numeric(10,2) not null default 0 check (per_km >= 0),
  per_minute numeric(10,2) not null default 0 check (per_minute >= 0),
  minimum_fare numeric(10,2) not null default 0 check (minimum_fare >= 0),
  active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists service_types_name_unique
  on public.service_types (lower(btrim(name)));

create index if not exists service_types_active_sort_idx
  on public.service_types (active, sort_order, name);

alter table public.service_types enable row level security;

revoke all on table public.service_types from anon;
grant select, insert, update, delete on table public.service_types to authenticated;
grant select, insert, update, delete on table public.service_types to service_role;

drop policy if exists service_types_read on public.service_types;
create policy service_types_read
  on public.service_types
  for select
  to authenticated
  using (active or (select private.is_admin()));

drop policy if exists service_types_admin_insert on public.service_types;
create policy service_types_admin_insert
  on public.service_types
  for insert
  to authenticated
  with check ((select private.is_admin()));

drop policy if exists service_types_admin_update on public.service_types;
create policy service_types_admin_update
  on public.service_types
  for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

drop policy if exists service_types_admin_delete on public.service_types;
create policy service_types_admin_delete
  on public.service_types
  for delete
  to authenticated
  using ((select private.is_admin()));

alter table public.trips
  add column if not exists service_type_id uuid references public.service_types(id) on delete set null,
  add column if not exists service_name text not null default 'Taxi' check (char_length(service_name) between 2 and 60),
  add column if not exists service_icon text not null default '🚕' check (char_length(service_icon) between 1 and 12);

create index if not exists trips_service_type_id_idx on public.trips(service_type_id);

insert into public.service_types
  (name, icon, description, base_fare, per_km, per_minute, minimum_fare, active, sort_order)
values
  ('Taxi', '🚕', 'Servicio de auto para pasajeros', 3.00, 1.60, 0.12, 5.00, true, 10),
  ('Mototaxi', '🛺', 'Servicio de mototaxi para recorridos urbanos', 2.00, 1.00, 0.08, 3.00, true, 20)
on conflict do nothing;

update public.trips
set service_type_id = (
  select id from public.service_types where lower(name) = 'taxi' limit 1
)
where service_type_id is null;

notify pgrst, 'reload schema';
