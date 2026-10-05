-- Nova Taxi: registro de chofer por servicio y asignacion estricta de viajes.

alter table public.service_types
  add column if not exists requires_plate boolean not null default true,
  add column if not exists requires_documents boolean not null default true;

insert into public.service_types
  (name, icon, description, base_fare, per_km, per_minute,
   minimum_fare, active, sort_order, requires_plate, requires_documents)
select 'Bicicleta', '🚲', 'Servicio de transporte en bicicleta',
       1.50, 0.50, 0.03, 1.50, true, 30, false, false
where not exists (
  select 1 from public.service_types
  where lower(btrim(name)) = 'bicicleta'
);

insert into public.service_types
  (name, icon, description, base_fare, per_km, per_minute,
   minimum_fare, active, sort_order, requires_plate, requires_documents)
select 'Flete', '🚚', 'Servicio para traslado de carga',
       8.00, 2.20, 0.15, 8.00, true, 40, true, true
where not exists (
  select 1 from public.service_types
  where lower(btrim(name)) = 'flete'
);

update public.service_types
set requires_plate = false,
    requires_documents = false
where lower(btrim(name)) in ('bicicleta', 'bici');

alter table public.drivers
  add column if not exists service_type_id uuid
  references public.service_types(id) on delete restrict;

update public.drivers
set service_type_id = (
  select id
  from public.service_types
  where lower(btrim(name)) in ('taxi', 'auto')
  order by case when lower(btrim(name)) = 'taxi' then 0 else 1 end,
           sort_order,
           created_at
  limit 1
)
where service_type_id is null;

do $$
begin
  if exists (select 1 from public.drivers where service_type_id is null) then
    raise exception 'No se encontro el servicio Taxi/Auto para registrar a los choferes existentes';
  end if;
end
$$;

alter table public.drivers
  alter column service_type_id set not null;

create index if not exists drivers_service_type_id_idx
  on public.drivers(service_type_id);

-- Una placa puede haberse registrado antes en otra cuenta. El vehiculo se
-- identifica por el chofer; asi la edicion del perfil nunca falla por una
-- cuenta antigua que tenga la misma placa.
alter table public.vehicles
  alter column plate drop not null;

alter table public.vehicles
  drop constraint if exists vehicles_plate_key;

create unique index if not exists vehicles_one_per_driver_idx
  on public.vehicles(driver_id);

create index if not exists vehicles_plate_lookup_idx
  on public.vehicles ((upper(regexp_replace(coalesce(plate, ''), '[^A-Za-z0-9]', '', 'g'))))
  where plate is not null and btrim(plate) <> '';

drop policy if exists trips_requested_visible_to_approved_drivers on public.trips;
create policy trips_requested_visible_to_matching_drivers
on public.trips
for select
to authenticated
using (
  status = 'solicitado'
  and exists (
    select 1
    from public.drivers d
    where d.id = (select auth.uid())
      and d.status = 'aprobado'
      and d.is_available = true
      and d.service_type_id = trips.service_type_id
  )
);

drop policy if exists trips_requested_accept_by_approved_driver on public.trips;
create policy trips_requested_accept_by_matching_driver
on public.trips
for update
to authenticated
using (
  status = 'solicitado'
  and driver_id is null
  and exists (
    select 1
    from public.drivers d
    where d.id = (select auth.uid())
      and d.status = 'aprobado'
      and d.is_available = true
      and d.service_type_id = trips.service_type_id
  )
)
with check (
  driver_id = (select auth.uid())
  and exists (
    select 1
    from public.drivers d
    where d.id = (select auth.uid())
      and d.status = 'aprobado'
      and d.service_type_id = trips.service_type_id
  )
);
