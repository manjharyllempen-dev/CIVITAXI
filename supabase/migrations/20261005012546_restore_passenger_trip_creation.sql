-- Restore the minimum Data API permission needed for passengers to request a trip.
-- RLS keeps the insert limited to the signed-in passenger's own initial request.

alter table public.trips enable row level security;

revoke insert on table public.trips from anon;
grant select, insert on table public.trips to authenticated;

drop policy if exists trips_passenger_insert_own on public.trips;
create policy trips_passenger_insert_own
on public.trips
for insert
to authenticated
with check (
  passenger_id = (select auth.uid())
  and status = 'solicitado'
  and driver_id is null
  and vehicle_id is null
  and exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'usuario'
      and p.account_status = 'activo'
      and p.deleted_at is null
  )
);
