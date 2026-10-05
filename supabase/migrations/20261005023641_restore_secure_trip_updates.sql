-- Restore the minimum trip UPDATE permissions used by the installed apps.
-- Column grants and RLS keep acceptance, driver progress, and passenger
-- cancellation limited to the authenticated participant.

alter table public.trips enable row level security;

revoke update on table public.trips from anon;
revoke update on table public.trips from authenticated;
grant update (
  driver_id,
  status,
  accepted_at,
  started_at,
  completed_at,
  final_fare,
  cancellation_reason
) on table public.trips to authenticated;

drop policy if exists trips_requested_accept_by_matching_driver on public.trips;
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
      and d.deleted_at is null
      and d.service_type_id = trips.service_type_id
  )
)
with check (
  driver_id = (select auth.uid())
  and status = 'aceptado'
  and exists (
    select 1
    from public.drivers d
    where d.id = (select auth.uid())
      and d.status = 'aprobado'
      and d.deleted_at is null
      and d.service_type_id = trips.service_type_id
  )
);

drop policy if exists trips_driver_progress_own on public.trips;
create policy trips_driver_progress_own
on public.trips
for update
to authenticated
using (
  driver_id = (select auth.uid())
  and status in ('aceptado', 'chofer_en_camino', 'chofer_llego', 'en_viaje')
  and exists (
    select 1
    from public.drivers d
    where d.id = (select auth.uid())
      and d.status = 'aprobado'
      and d.deleted_at is null
      and d.service_type_id = trips.service_type_id
  )
)
with check (
  driver_id = (select auth.uid())
  and status in ('aceptado', 'chofer_en_camino', 'chofer_llego', 'en_viaje', 'completado')
  and exists (
    select 1
    from public.drivers d
    where d.id = (select auth.uid())
      and d.status = 'aprobado'
      and d.deleted_at is null
      and d.service_type_id = trips.service_type_id
  )
);

drop policy if exists trips_passenger_cancel_own on public.trips;
create policy trips_passenger_cancel_own
on public.trips
for update
to authenticated
using (
  passenger_id = (select auth.uid())
  and status in ('solicitado', 'aceptado', 'chofer_en_camino', 'chofer_llego')
)
with check (
  passenger_id = (select auth.uid())
  and status = 'cancelado'
);
