-- Voxly: soporte para responder mensajes.
-- Ejecuta este archivo una sola vez en Supabase > SQL Editor.

alter table public.messages
  add column if not exists reply_to_message_id uuid
  references public.messages(id) on delete set null;

create index if not exists messages_reply_to_message_id_idx
  on public.messages(reply_to_message_id)
  where reply_to_message_id is not null;

create or replace function public.validate_voxly_message_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.reply_to_message_id is not null and not exists (
    select 1
    from public.messages original
    where original.id = new.reply_to_message_id
      and original.conversation_id = new.conversation_id
  ) then
    raise exception 'Solo puedes responder a mensajes de esta conversación.';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_validate_reply on public.messages;
create trigger messages_validate_reply
  before insert or update of reply_to_message_id, conversation_id
  on public.messages
  for each row execute function public.validate_voxly_message_reply();
