alter table public.profiles add column if not exists dni text;

do $$ begin
  alter table public.profiles
    add constraint profiles_dni_format
    check (dni is null or dni ~ '^[0-9]{8}$');
exception when duplicate_object then null;
end $$;
