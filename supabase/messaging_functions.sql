-- Voxly: funciones seguras para buscar usuarios y crear/listar chats directos.
-- Ejecuta este archivo una sola vez en Supabase > SQL Editor.

-- Asignar nombres de usuario a perfiles existentes que todavía no tengan uno.
update public.profiles
set username = lower(
  regexp_replace(coalesce(nullif(display_name, ''), 'usuario'), '[^a-zA-Z0-9]+', '_', 'g')
) || '_' || substr(replace(id::text, '-', ''), 1, 6)
where username is null or btrim(username) = '';

-- Crear perfiles nuevos con username único al registrarse.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_name text;
begin
  chosen_name := coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'Usuario Voxly');
  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    chosen_name,
    lower(regexp_replace(chosen_name, '[^a-zA-Z0-9]+', '_', 'g'))
      || '_' || substr(replace(new.id::text, '-', ''), 1, 6)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Buscar usuarios por nombre visible o username. Solo devuelve datos públicos mínimos.
create or replace function public.search_voxly_users(search_term text)
returns table (id uuid, username text, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, coalesce(p.username, ''), p.display_name
  from public.profiles p
  where (select auth.uid()) is not null
    and p.id <> (select auth.uid())
    and nullif(btrim(search_term), '') is not null
    and (
      p.username ilike '%' || btrim(search_term) || '%'
      or p.display_name ilike '%' || btrim(search_term) || '%'
    )
  order by p.display_name
  limit 20;
$$;

revoke all on function public.search_voxly_users(text) from public;
grant execute on function public.search_voxly_users(text) to authenticated;

-- Crear o recuperar una conversación directa entre el usuario actual y otro usuario.
create or replace function public.create_direct_conversation(target_user uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  found_conversation uuid;
begin
  if current_user_id is null then
    raise exception 'Debes iniciar sesión para crear una conversación.';
  end if;
  if target_user is null or target_user = current_user_id then
    raise exception 'Selecciona a otra persona para iniciar el chat.';
  end if;
  if not exists (select 1 from public.profiles p where p.id = target_user) then
    raise exception 'No se encontró ese usuario.';
  end if;

  select c.id into found_conversation
  from public.conversations c
  where c.kind = 'direct'
    and exists (
      select 1 from public.conversation_members a
      where a.conversation_id = c.id and a.user_id = current_user_id
    )
    and exists (
      select 1 from public.conversation_members b
      where b.conversation_id = c.id and b.user_id = target_user
    )
  order by c.created_at
  limit 1;

  if found_conversation is null then
    insert into public.conversations (kind, created_by)
    values ('direct', current_user_id)
    returning id into found_conversation;

    insert into public.conversation_members (conversation_id, user_id, role)
    values
      (found_conversation, current_user_id, 'admin'),
      (found_conversation, target_user, 'member');
  end if;

  return found_conversation;
end;
$$;

revoke all on function public.create_direct_conversation(uuid) from public;
grant execute on function public.create_direct_conversation(uuid) to authenticated;

-- Obtener la lista de chats del usuario sin abrir perfiles ajenos mediante RLS.
create or replace function public.list_my_voxly_conversations()
returns table (
  conversation_id uuid,
  kind text,
  updated_at timestamptz,
  other_user_id uuid,
  other_display_name text,
  other_username text,
  last_message text,
  last_message_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.kind,
    c.updated_at,
    other_member.user_id,
    coalesce(p.display_name, 'Usuario Voxly'),
    coalesce(p.username, ''),
    latest.content,
    latest.created_at
  from public.conversations c
  join public.conversation_members mine
    on mine.conversation_id = c.id
   and mine.user_id = (select auth.uid())
  left join lateral (
    select cm.user_id
    from public.conversation_members cm
    where cm.conversation_id = c.id
      and cm.user_id <> (select auth.uid())
    order by cm.joined_at
    limit 1
  ) other_member on true
  left join public.profiles p on p.id = other_member.user_id
  left join lateral (
    select m.content, m.created_at
    from public.messages m
    where m.conversation_id = c.id and m.deleted_at is null
    order by m.created_at desc
    limit 1
  ) latest on true
  where (select auth.uid()) is not null
  order by coalesce(latest.created_at, c.updated_at) desc;
$$;

revoke all on function public.list_my_voxly_conversations() from public;
grant execute on function public.list_my_voxly_conversations() to authenticated;

-- Actualizar la fecha de la conversación cuando llega un mensaje.
create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute procedure public.touch_conversation_on_message();
