-- Voxly: almacenamiento privado para imágenes y archivos de conversaciones.
-- Ejecuta este archivo en Supabase > SQL Editor.

insert into storage.buckets (id, name, public, file_size_limit)
values ('voxly-attachments', 'voxly-attachments', false, 15728640)
on conflict (id) do update
set public = false, file_size_limit = 15728640;

drop policy if exists "voxly_attachments_upload_member" on storage.objects;
create policy "voxly_attachments_upload_member"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'voxly-attachments'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and public.is_conversation_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "voxly_attachments_read_member" on storage.objects;
create policy "voxly_attachments_read_member"
on storage.objects for select to authenticated
using (
  bucket_id = 'voxly-attachments'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.is_conversation_member(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "voxly_attachments_delete_owner" on storage.objects;
create policy "voxly_attachments_delete_owner"
on storage.objects for delete to authenticated
using (
  bucket_id = 'voxly-attachments'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.is_conversation_member(((storage.foldername(name))[1])::uuid)
);
