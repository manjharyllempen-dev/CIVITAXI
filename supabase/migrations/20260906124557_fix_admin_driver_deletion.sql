create or replace function public.admin_delete_driver(p_driver_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'Solo el administrador puede eliminar conductores.'
      using errcode = '42501';
  end if;

  if p_driver_id is null then
    raise exception 'Selecciona un conductor válido.'
      using errcode = '22004';
  end if;

  if not exists (
    select 1 from public.drivers where id = p_driver_id
  ) then
    raise exception 'Conductor no encontrado.'
      using errcode = 'P0002';
  end if;

  -- Keep administrative history valid if this account reviewed or sent records.
  update public.driver_subscription_payments
     set reviewed_by = null
   where reviewed_by = p_driver_id;

  update public.passenger_notifications
     set created_by = null
   where created_by = p_driver_id;

  -- Remove active and historical driver data in foreign-key-safe order.
  delete from public.incidents
   where reporter_id = p_driver_id
      or trip_id in (
        select id from public.trips
         where driver_id = p_driver_id or passenger_id = p_driver_id
      );
  delete from public.trip_party_ratings
   where rater_id = p_driver_id or rated_id = p_driver_id;
  delete from public.ratings
   where driver_id = p_driver_id or passenger_id = p_driver_id;
  delete from public.trip_locations where actor_id = p_driver_id;
  delete from public.trips
   where driver_id = p_driver_id or passenger_id = p_driver_id;
  delete from public.driver_notifications
   where driver_id = p_driver_id or created_by = p_driver_id;
  delete from public.driver_documents where driver_id = p_driver_id;
  delete from public.vehicles where driver_id = p_driver_id;
  delete from public.drivers where id = p_driver_id;

  delete from public.profiles where id = p_driver_id;
  delete from auth.users where id = p_driver_id;

  return true;
end;
$$;

revoke all on function public.admin_delete_driver(uuid)
  from public, anon, authenticated;
grant execute on function public.admin_delete_driver(uuid)
  to authenticated;
