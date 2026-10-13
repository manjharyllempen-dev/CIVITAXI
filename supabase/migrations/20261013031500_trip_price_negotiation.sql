-- Bilateral price negotiation for requested trips.
alter table public.trips
  add column if not exists passenger_offer numeric(10,2),
  add column if not exists agreed_fare numeric(10,2);

alter table public.trips drop constraint if exists trips_passenger_offer_check;
alter table public.trips add constraint trips_passenger_offer_check
  check (passenger_offer is null or (passenger_offer > 0 and passenger_offer <= 10000));

alter table public.trips drop constraint if exists trips_agreed_fare_check;
alter table public.trips add constraint trips_agreed_fare_check
  check (agreed_fare is null or (agreed_fare > 0 and agreed_fare <= 10000));

create table if not exists public.trip_price_offers (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0 and amount <= 10000),
  status text not null default 'pendiente' check (status in ('pendiente','aceptado','rechazado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, driver_id)
);

alter table public.trip_price_offers enable row level security;
revoke all on table public.trip_price_offers from anon, authenticated;

grant insert (passenger_offer) on table public.trips to authenticated;

create or replace function public.driver_accept_trip_price(p_trip_id uuid)
returns setof public.trips
language plpgsql security definer set search_path = public
as $$
declare v_driver public.drivers%rowtype;
begin
  select * into v_driver from public.drivers
   where id = auth.uid() and status = 'aprobado' and is_available and deleted_at is null;
  if not found then raise exception 'Chofer no autorizado o desconectado'; end if;
  return query
    update public.trips t set
      driver_id = auth.uid(), status = 'aceptado', accepted_at = now(),
      agreed_fare = coalesce(t.passenger_offer, t.estimated_fare)
    where t.id = p_trip_id and t.status = 'solicitado' and t.driver_id is null
      and t.service_type_id = v_driver.service_type_id
    returning t.*;
end $$;

create or replace function public.driver_counter_trip_price(p_trip_id uuid, p_amount numeric)
returns public.trip_price_offers
language plpgsql security definer set search_path = public
as $$
declare v_driver public.drivers%rowtype; v_offer public.trip_price_offers%rowtype;
begin
  if p_amount <= 0 or p_amount > 10000 then raise exception 'Precio inválido'; end if;
  select * into v_driver from public.drivers
   where id = auth.uid() and status = 'aprobado' and is_available and deleted_at is null;
  if not found then raise exception 'Chofer no autorizado o desconectado'; end if;
  if not exists (select 1 from public.trips t where t.id=p_trip_id and t.status='solicitado'
    and t.driver_id is null and t.service_type_id=v_driver.service_type_id) then
    raise exception 'El viaje ya no está disponible';
  end if;
  insert into public.trip_price_offers(trip_id,driver_id,amount,status)
  values(p_trip_id,auth.uid(),p_amount,'pendiente')
  on conflict(trip_id,driver_id) do update set amount=excluded.amount,status='pendiente',updated_at=now()
  returning * into v_offer;
  return v_offer;
end $$;

create or replace function public.passenger_pending_price_offers(p_trip_id uuid)
returns table(id uuid, driver_id uuid, driver_name text, amount numeric, created_at timestamptz)
language sql security definer set search_path = public
as $$
  select o.id,o.driver_id,coalesce(p.full_name,'Chofer Nova Taxi'),o.amount,o.created_at
  from public.trip_price_offers o
  join public.trips t on t.id=o.trip_id
  left join public.profiles p on p.id=o.driver_id
  where o.trip_id=p_trip_id and t.passenger_id=auth.uid() and t.status='solicitado' and o.status='pendiente'
  order by o.updated_at desc;
$$;

create or replace function public.passenger_respond_price_offer(p_offer_id uuid, p_accept boolean)
returns setof public.trips
language plpgsql security definer set search_path = public
as $$
declare v_offer public.trip_price_offers%rowtype;
begin
  select o.* into v_offer from public.trip_price_offers o
  join public.trips t on t.id=o.trip_id
  where o.id=p_offer_id and o.status='pendiente' and t.passenger_id=auth.uid()
    and t.status='solicitado' and t.driver_id is null for update of o;
  if not found then raise exception 'La oferta ya no está disponible'; end if;
  if not p_accept then
    update public.trip_price_offers set status='rechazado',updated_at=now() where id=p_offer_id;
    return query select t.* from public.trips t where t.id=v_offer.trip_id;
    return;
  end if;
  return query
    update public.trips t set driver_id=v_offer.driver_id,status='aceptado',accepted_at=now(),agreed_fare=v_offer.amount
    where t.id=v_offer.trip_id and t.status='solicitado' and t.driver_id is null returning t.*;
  if not found then raise exception 'Otro chofer aceptó este viaje primero'; end if;
  update public.trip_price_offers set status=case when id=p_offer_id then 'aceptado' else 'rechazado' end,
    updated_at=now() where trip_id=v_offer.trip_id and status='pendiente';
end $$;

revoke all on function public.driver_accept_trip_price(uuid) from public, anon;
revoke all on function public.driver_counter_trip_price(uuid,numeric) from public, anon;
revoke all on function public.passenger_pending_price_offers(uuid) from public, anon;
revoke all on function public.passenger_respond_price_offer(uuid,boolean) from public, anon;
grant execute on function public.driver_accept_trip_price(uuid) to authenticated;
grant execute on function public.driver_counter_trip_price(uuid,numeric) to authenticated;
grant execute on function public.passenger_pending_price_offers(uuid) to authenticated;
grant execute on function public.passenger_respond_price_offer(uuid,boolean) to authenticated;
