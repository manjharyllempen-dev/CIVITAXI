create or replace function public.rate_trip(
  p_trip_id uuid,
  p_stars integer,
  p_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.trips%rowtype;
  target uuid;
  new_rating numeric(3,2);
  caller uuid := auth.uid();
begin
  if caller is null then raise exception 'Debes iniciar sesión'; end if;
  if p_stars < 1 or p_stars > 5 then raise exception 'Calificación inválida'; end if;
  select * into t from public.trips where id=p_trip_id and status='completado';
  if t.id is null then raise exception 'El viaje aún no está completado'; end if;
  if caller=t.passenger_id then target:=t.driver_id;
  elsif caller=t.driver_id then target:=t.passenger_id;
  else raise exception 'Sin permiso'; end if;
  if target is null then raise exception 'No hay contraparte para calificar'; end if;
  insert into public.trip_party_ratings(trip_id,rater_id,rated_id,stars,comment)
  values(t.id,caller,target,p_stars,nullif(trim(coalesce(p_comment,'')),''))
  on conflict (trip_id,rater_id) do update
    set stars=excluded.stars,comment=excluded.comment,updated_at=now();
  select round(avg(stars)::numeric,2) into new_rating
  from public.trip_party_ratings where rated_id=target;
  update public.profiles
    set rating=coalesce(new_rating,5),updated_at=now()
    where id=target;
  return jsonb_build_object('rated_id',target,'rating',coalesce(new_rating,5));
end;
$$;

revoke all on function public.rate_trip(uuid,integer,text) from public;
grant execute on function public.rate_trip(uuid,integer,text) to authenticated;
