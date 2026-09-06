create table if not exists public.daily_archives (
  archive_date date primary key,
  trips_count integer not null default 0,
  completed_count integer not null default 0,
  gross numeric(12,2) not null default 0,
  trips_snapshot jsonb not null default '[]'::jsonb,
  archived_at timestamptz not null default now()
);

alter table public.daily_archives enable row level security;
drop policy if exists daily_archives_admin on public.daily_archives;
create policy daily_archives_admin
on public.daily_archives
for all
to authenticated
using (private.is_admin())
with check (private.is_admin());

create or replace function public.archive_previous_days()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  n integer := 0;
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'Solo administrador';
  end if;

  for r in
    select distinct (t.requested_at at time zone 'America/Lima')::date as d
    from public.trips t
    where (t.requested_at at time zone 'America/Lima')::date < (now() at time zone 'America/Lima')::date
      and not exists (
        select 1
        from public.daily_archives a
        where a.archive_date = (t.requested_at at time zone 'America/Lima')::date
      )
    order by d
  loop
    insert into public.daily_archives (
      archive_date,
      trips_count,
      completed_count,
      gross,
      trips_snapshot
    )
    select
      r.d,
      count(*)::integer,
      count(*) filter (where t.status = 'completado')::integer,
      coalesce(sum(coalesce(t.final_fare, t.estimated_fare, 0)) filter (where t.status = 'completado'), 0)::numeric(12,2),
      coalesce(
        jsonb_agg(
          to_jsonb(t) || jsonb_build_object(
            'driver_name', coalesce(p.full_name, 'Sin conductor asignado')
          )
          order by t.requested_at
        ),
        '[]'::jsonb
      )
    from public.trips t
    left join public.profiles p on p.id = t.driver_id
    where (t.requested_at at time zone 'America/Lima')::date = r.d;

    n := n + 1;
  end loop;

  return n;
end;
$$;

create or replace function public.admin_delete_passenger(p_passenger_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'Solo administrador';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_passenger_id and role = 'usuario'
  ) then
    raise exception 'Pasajero no encontrado';
  end if;

  delete from public.incidents
  where reporter_id = p_passenger_id
     or trip_id in (select id from public.trips where passenger_id = p_passenger_id);

  delete from public.trip_party_ratings
  where rater_id = p_passenger_id
     or rated_id = p_passenger_id
     or trip_id in (select id from public.trips where passenger_id = p_passenger_id);

  delete from public.ratings
  where passenger_id = p_passenger_id
     or trip_id in (select id from public.trips where passenger_id = p_passenger_id);

  delete from public.trip_locations
  where actor_id = p_passenger_id
     or trip_id in (select id from public.trips where passenger_id = p_passenger_id);

  delete from public.trip_share_tokens
  where trip_id in (select id from public.trips where passenger_id = p_passenger_id);

  delete from public.trips where passenger_id = p_passenger_id;
  update public.passenger_notifications set created_by = null where created_by = p_passenger_id;
  delete from public.passenger_notifications where passenger_id = p_passenger_id;
  delete from public.profiles where id = p_passenger_id;
  delete from auth.users where id = p_passenger_id;

  return true;
end;
$$;

create or replace function public.admin_send_passenger_notification(p_passenger_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_id uuid;
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'Solo administrador';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_passenger_id and role = 'usuario'
  ) then
    raise exception 'Pasajero no encontrado';
  end if;

  if length(trim(coalesce(p_body, ''))) < 1 then
    raise exception 'Escribe un mensaje';
  end if;

  insert into public.passenger_notifications (passenger_id, title, body, created_by)
  values (p_passenger_id, 'Nova Taxi Administrador', left(trim(p_body), 500), auth.uid())
  returning id into notification_id;

  return notification_id;
end;
$$;

create or replace function public.admin_set_passenger_status(
  p_passenger_id uuid,
  p_status text,
  p_reason text default ''
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(private.is_admin(), false) then
    raise exception 'Solo administrador';
  end if;

  if p_status not in ('activo', 'suspendido') then
    raise exception 'Estado no válido';
  end if;

  update public.profiles
  set account_status = p_status,
      suspended_reason = case
        when p_status = 'suspendido' then left(trim(coalesce(p_reason, '')), 500)
        else null
      end,
      updated_at = now()
  where id = p_passenger_id and role = 'usuario';

  if not found then
    raise exception 'Pasajero no encontrado';
  end if;

  insert into public.passenger_notifications (passenger_id, title, body, created_by)
  values (
    p_passenger_id,
    'Nova Taxi Administrador',
    case
      when p_status = 'suspendido' then
        'Tu cuenta fue suspendida. Motivo: ' || coalesce(nullif(trim(p_reason), ''), 'infracción registrada')
      else 'Tu cuenta fue reactivada.'
    end,
    auth.uid()
  );

  return true;
end;
$$;

revoke all on function public.archive_previous_days() from public, anon, authenticated;
grant execute on function public.archive_previous_days() to authenticated;
revoke all on function public.admin_delete_passenger(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_passenger(uuid) to authenticated;
revoke all on function public.admin_send_passenger_notification(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_send_passenger_notification(uuid, text) to authenticated;
revoke all on function public.admin_set_passenger_status(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_set_passenger_status(uuid, text, text) to authenticated;
