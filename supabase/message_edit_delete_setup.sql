-- Voxly: edición segura y eliminación lógica de mensajes.
-- Ejecuta este archivo en Supabase > SQL Editor.
-- No borra filas: conserva el historial y muestra "Este mensaje fue eliminado".

alter table public.messages
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;

create index if not exists messages_conversation_active_idx
  on public.messages (conversation_id, created_at)
  where deleted_at is null;

-- El remitente solo puede editar texto propio o marcar su mensaje como eliminado.
-- Este trigger también impide cambiar el autor, la conversación o el tipo de mensaje.
create or replace function public.guard_voxly_message_changes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null or auth.uid() <> old.sender_id then
    raise exception 'Solo quien envió el mensaje puede modificarlo.';
  end if;

  if new.id is distinct from old.id
     or new.conversation_id is distinct from old.conversation_id
     or new.sender_id is distinct from old.sender_id
     or new.message_type is distinct from old.message_type
     or new.created_at is distinct from old.created_at
     or new.reply_to_message_id is distinct from old.reply_to_message_id then
    raise exception 'No se pueden cambiar los datos originales del mensaje.';
  end if;

  if old.deleted_at is not null then
    raise exception 'Este mensaje ya fue eliminado y no puede modificarse.';
  end if;

  -- Eliminación lógica: conserva la fila para mantener las respuestas y el historial.
  if new.deleted_at is distinct from old.deleted_at then
    if new.deleted_at is null or new.content <> '' or new.attachment_url is not null
       or new.edited_at is distinct from old.edited_at then
      raise exception 'Solicitud de eliminación no válida.';
    end if;
    new.deleted_at := now();
    return new;
  end if;

  -- Edición: solo se permite modificar el contenido de mensajes de texto.
  if new.content is distinct from old.content then
    if old.message_type <> 'text'
       or length(btrim(new.content)) = 0
       or new.attachment_url is distinct from old.attachment_url
       or new.deleted_at is not null then
      raise exception 'Solo puedes editar el texto de un mensaje de texto activo.';
    end if;
    new.edited_at := now();
    return new;
  end if;

  if new.attachment_url is distinct from old.attachment_url
     or new.edited_at is distinct from old.edited_at then
    raise exception 'No se permite modificar esos campos directamente.';
  end if;

  return new;
end;
$$;

drop trigger if exists messages_guard_voxly_changes on public.messages;
create trigger messages_guard_voxly_changes
  before update on public.messages
  for each row execute function public.guard_voxly_message_changes();

-- Asegura que la política de actualización solo permita actuar al remitente.
drop policy if exists "messages_update_sender" on public.messages;
create policy "messages_update_sender" on public.messages
  for update to authenticated
  using (sender_id = (select auth.uid()))
  with check (sender_id = (select auth.uid()));

grant update (content, attachment_url, edited_at, deleted_at) on public.messages to authenticated;
