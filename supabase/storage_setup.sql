-- Voxly: almacenamiento privado para imágenes y archivos de conversaciones.
-- Ejecuta este archivo completo en Supabase > SQL Editor.

create or replace function public.can_access_voxly_attachment(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $func$
declare
  parts text[];
begin
  parts := storage.foldername(object_name);
  if coalesce(array_length(parts, 1), 0) < 2 then
    return false;
  end if;
  if parts[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.is_conversation_member(parts[1]::uuid);
end;
$func$;

revoke all on function public.can_access_voxly_attachment(text) from public;
grant execute on function public.can_access_voxly_attachment(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('voxly-attachments', 'voxly-attachments', false, 15728640)
on conflict (id) do update set public = false, file_size_limit = 15728640;

drop policy if exists "voxly_attachments_upload_member" on storage.objects;
create policy "voxly_attachments_upload_member"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'voxly-attachments'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and public.can_access_voxly_attachment(name)
);

drop policy if exists "voxly_attachments_read_member" on storage.objects;
create policy "voxly_attachments_read_member"
on storage.objects for select to authenticated
using (
  bucket_id = 'voxly-attachments'
  and public.can_access_voxly_attachment(name)
);

drop policy if exists "voxly_attachments_delete_owner" on storage.objects;
create policy "voxly_attachments_delete_owner"
on storage.objects for delete to authenticated
using (
  bucket_id = 'voxly-attachments'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and public.can_access_voxly_attachment(name)
);