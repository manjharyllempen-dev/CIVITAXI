-- El conductor debe poder elegir su servicio antes de crear la cuenta.
grant select on table public.service_types to anon;

drop policy if exists service_types_read on public.service_types;
create policy service_types_read
  on public.service_types
  for select
  to anon, authenticated
  using (active or (select private.is_admin()));

notify pgrst, 'reload schema';
