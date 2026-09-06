create or replace function private.guard_passenger_status() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (new.account_status is distinct from old.account_status or new.suspended_reason is distinct from old.suspended_reason) and not coalesce(private.is_admin(),false) then
 raise exception 'Solo el administrador puede cambiar la suspensión';
 end if;
 return new;
end $$;
revoke all on function private.guard_passenger_status() from public,anon,authenticated;
create trigger guard_passenger_status before update of account_status,suspended_reason on public.profiles for each row execute function private.guard_passenger_status();
revoke update on public.passenger_notifications from authenticated;
grant update(read_at) on public.passenger_notifications to authenticated;