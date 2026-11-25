-- Voxly: perfiles editables, almacenamiento de avatares y presencia.
-- La tabla profiles ya existe; este archivo agrega reglas y almacenamiento sin borrar datos.

alter table public.profiles
  add column if not exists bio text,
  add column if not exists avatar_url text;

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username))
  where username is not null and btrim(username) <> '';

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voxly-avatars', 'voxly-avatars', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "voxly_avatars_public_read" on storage.objects;
create policy "voxly_avatars_public_read" on storage.objects
  for select using (bucket_id = 'voxly-avatars');

drop policy if exists "voxly_avatars_insert_own" on storage.objects;
create policy "voxly_avatars_insert_own" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'voxly-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "voxly_avatars_update_own" on storage.objects;
create policy "voxly_avatars_update_own" on storage.objects
  for update to authenticated using (
    bucket_id = 'voxly-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text
  ) with check (
    bucket_id = 'voxly-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "voxly_avatars_delete_own" on storage.objects;
create policy "voxly_avatars_delete_own" on storage.objects
  for delete to authenticated using (
    bucket_id = 'voxly-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text
  );

grant select, update on public.profiles to authenticated;
