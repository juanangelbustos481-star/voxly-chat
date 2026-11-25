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
-- Crear grupos: el creador queda como administrador y los invitados como miembros.
create or replace function public.create_voxly_group(group_title text, member_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  new_conversation uuid;
  clean_title text := nullif(btrim(group_title), '');
  unique_members uuid[];
begin
  if current_user_id is null then raise exception 'Debes iniciar sesión para crear un grupo.'; end if;
  if clean_title is null or length(clean_title) > 60 then raise exception 'El nombre del grupo debe tener entre 1 y 60 caracteres.'; end if;
  select coalesce(array_agg(distinct candidate), array[]::uuid[]) into unique_members
  from unnest(coalesce(member_ids, array[]::uuid[])) as candidate
  where candidate is not null and candidate <> current_user_id;
  if cardinality(unique_members) < 1 then raise exception 'Agrega al menos a una persona al grupo.'; end if;
  if cardinality(unique_members) > 49 then raise exception 'Un grupo puede tener como máximo 50 integrantes.'; end if;
  if exists (select 1 from unnest(unique_members) requested(user_id)
    where not exists (select 1 from public.profiles p where p.id = requested.user_id)) then
    raise exception 'Uno de los usuarios seleccionados ya no está disponible.';
  end if;
  insert into public.conversations (kind, title, created_by)
  values ('group', clean_title, current_user_id) returning id into new_conversation;
  insert into public.conversation_members (conversation_id, user_id, role)
  values (new_conversation, current_user_id, 'admin');
  insert into public.conversation_members (conversation_id, user_id, role)
  select new_conversation, requested.user_id, 'member' from unnest(unique_members) requested(user_id);
  return new_conversation;
end;
$$;
revoke all on function public.create_voxly_group(text, uuid[]) from public;
grant execute on function public.create_voxly_group(text, uuid[]) to authenticated;

-- Mostrar el título del grupo en la lista de conversaciones.
create or replace function public.list_my_voxly_conversations()
returns table (
  conversation_id uuid, kind text, updated_at timestamptz, other_user_id uuid,
  other_display_name text, other_username text, last_message text, last_message_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.kind, c.updated_at, other_member.user_id,
    case when c.kind = 'group' then coalesce(nullif(c.title, ''), 'Grupo Voxly')
      else coalesce(p.display_name, 'Usuario Voxly') end,
    case when c.kind = 'group' then 'grupo' else coalesce(p.username, '') end,
    latest.content, latest.created_at
  from public.conversations c
  join public.conversation_members mine on mine.conversation_id = c.id and mine.user_id = (select auth.uid())
  left join lateral (
    select cm.user_id from public.conversation_members cm
    where cm.conversation_id = c.id and cm.user_id <> (select auth.uid())
    order by cm.joined_at limit 1
  ) other_member on true
  left join public.profiles p on p.id = other_member.user_id
  left join lateral (
    select m.content, m.created_at from public.messages m
    where m.conversation_id = c.id and m.deleted_at is null
    order by m.created_at desc limit 1
  ) latest on true
  where (select auth.uid()) is not null
  order by coalesce(latest.created_at, c.updated_at) desc;
$$;
revoke all on function public.list_my_voxly_conversations() from public;
grant execute on function public.list_my_voxly_conversations() to authenticated;

-- Actualizar la fecha de la conversación cuando llega un mensaje.
create or replace function public.touch_conversation_on_message()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;
drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation after insert on public.messages
for each row execute procedure public.touch_conversation_on_message();
