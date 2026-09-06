alter table public.profiles add column if not exists account_status text not null default 'activo';
alter table public.profiles add column if not exists suspended_reason text;
alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles add constraint profiles_account_status_check check (account_status in ('activo','suspendido'));

create table if not exists public.passenger_notifications (
  id uuid primary key default gen_random_uuid(),
  passenger_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Nova Taxi Administrador',
  body text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
alter table public.passenger_notifications enable row level security;
drop policy if exists passenger_reads_notifications on public.passenger_notifications;
create policy passenger_reads_notifications on public.passenger_notifications for select using (passenger_id=auth.uid() or private.is_admin());
drop policy if exists passenger_updates_notifications on public.passenger_notifications;
create policy passenger_updates_notifications on public.passenger_notifications for update using (passenger_id=auth.uid() or private.is_admin()) with check (passenger_id=auth.uid() or private.is_admin());

create or replace function public.admin_send_passenger_notification(p_passenger_id uuid,p_body text) returns uuid language plpgsql security definer set search_path='public' as $$
declare rid uuid;
begin
  if not private.is_admin() then raise exception 'Solo administrador'; end if;
  if not exists(select 1 from public.profiles where id=p_passenger_id and role='usuario') then raise exception 'Pasajero no encontrado'; end if;
  if length(trim(coalesce(p_body,'')))<1 then raise exception 'Escribe un mensaje'; end if;
  insert into public.passenger_notifications(passenger_id,title,body,created_by) values(p_passenger_id,'Nova Taxi Administrador',left(trim(p_body),500),auth.uid()) returning id into rid;
  return rid;
end $$;

create or replace function public.admin_set_passenger_status(p_passenger_id uuid,p_status text,p_reason text default '') returns boolean language plpgsql security definer set search_path='public' as $$
begin
  if not private.is_admin() then raise exception 'Solo administrador'; end if;
  if p_status not in ('activo','suspendido') then raise exception 'Estado no válido'; end if;
  update public.profiles set account_status=p_status,suspended_reason=case when p_status='suspendido' then left(trim(coalesce(p_reason,'')),500) else null end,updated_at=now() where id=p_passenger_id and role='usuario';
  if not found then raise exception 'Pasajero no encontrado'; end if;
  insert into public.passenger_notifications(passenger_id,title,body,created_by) values(p_passenger_id,'Nova Taxi Administrador',case when p_status='suspendido' then 'Tu cuenta fue suspendida. Motivo: '||coalesce(nullif(trim(p_reason),''),'infracción registrada') else 'Tu cuenta fue reactivada.' end,auth.uid());
  return true;
end $$;

create or replace function public.block_suspended_passenger_trip() returns trigger language plpgsql security definer set search_path='public' as $$
begin
  if exists(select 1 from public.profiles where id=new.passenger_id and account_status='suspendido') then raise exception 'Tu cuenta está suspendida. Comunícate con Nova Taxi.'; end if;
  return new;
end $$;
drop trigger if exists block_suspended_passenger_trip on public.trips;
create trigger block_suspended_passenger_trip before insert on public.trips for each row execute function public.block_suspended_passenger_trip();

create or replace function public.admin_delete_passenger(p_passenger_id uuid) returns boolean language plpgsql security definer set search_path='public','auth','storage' as $$
begin
  if not private.is_admin() then raise exception 'Solo administrador'; end if;
  if exists(select 1 from public.trips where passenger_id=p_passenger_id and status in ('solicitado','aceptado','chofer_en_camino','chofer_llego','en_viaje')) then raise exception 'No se puede eliminar un pasajero con un viaje activo.'; end if;
  if not exists(select 1 from public.profiles where id=p_passenger_id and role='usuario') then raise exception 'Pasajero no encontrado'; end if;
  delete from public.incidents where reporter_id=p_passenger_id or trip_id in(select id from public.trips where passenger_id=p_passenger_id);
  delete from public.trip_party_ratings where rater_id=p_passenger_id or rated_id=p_passenger_id or trip_id in(select id from public.trips where passenger_id=p_passenger_id);
  delete from public.ratings where passenger_id=p_passenger_id or trip_id in(select id from public.trips where passenger_id=p_passenger_id);
  delete from public.trip_locations where actor_id=p_passenger_id or trip_id in(select id from public.trips where passenger_id=p_passenger_id);
  delete from public.trip_share_tokens where trip_id in(select id from public.trips where passenger_id=p_passenger_id);
  delete from public.trips where passenger_id=p_passenger_id;
  delete from public.passenger_notifications where passenger_id=p_passenger_id or created_by=p_passenger_id;
  delete from storage.objects where owner=p_passenger_id or owner_id=p_passenger_id::text or name like p_passenger_id::text||'/%';
  delete from public.profiles where id=p_passenger_id;
  delete from auth.users where id=p_passenger_id;
  return true;
end $$;

revoke all on function public.admin_send_passenger_notification(uuid,text) from public,anon;
revoke all on function public.admin_set_passenger_status(uuid,text,text) from public,anon;
revoke all on function public.admin_delete_passenger(uuid) from public,anon;
revoke all on function public.block_suspended_passenger_trip() from public,anon,authenticated;
grant execute on function public.admin_send_passenger_notification(uuid,text) to authenticated;
grant execute on function public.admin_set_passenger_status(uuid,text,text) to authenticated;
grant execute on function public.admin_delete_passenger(uuid) to authenticated;
