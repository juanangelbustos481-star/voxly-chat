-- Voxly: bloqueo de usuarios y protección de mensajes directos.
-- Ejecuta este archivo en Supabase > SQL Editor. Es seguro volver a ejecutarlo.

create table if not exists public.user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_blocks_no_self check (blocker_id <> blocked_user_id),
  constraint user_blocks_unique_pair unique (blocker_id, blocked_user_id)
);

create index if not exists user_blocks_blocked_user_idx
  on public.user_blocks (blocked_user_id);

alter table public.user_blocks enable row level security;

drop policy if exists "user_blocks_select_own" on public.user_blocks;
create policy "user_blocks_select_own" on public.user_blocks
  for select to authenticated using (blocker_id = (select auth.uid()));

drop policy if exists "user_blocks_insert_own" on public.user_blocks;
create policy "user_blocks_insert_own" on public.user_blocks
  for insert to authenticated with check (
    blocker_id = (select auth.uid())
    and blocked_user_id <> (select auth.uid())
  );

drop policy if exists "user_blocks_delete_own" on public.user_blocks;
create policy "user_blocks_delete_own" on public.user_blocks
  for delete to authenticated using (blocker_id = (select auth.uid()));

grant select, insert, delete on public.user_blocks to authenticated;

-- Impide crear nuevos chats directos cuando cualquiera de los dos usuarios bloqueó al otro.
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
  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = current_user_id and b.blocked_user_id = target_user)
       or (b.blocker_id = target_user and b.blocked_user_id = current_user_id)
  ) then
    raise exception 'No puedes iniciar una conversación con este usuario.';
  end if;

  select c.id into found_conversation
  from public.conversations c
  where c.kind = 'direct'
    and exists (select 1 from public.conversation_members a where a.conversation_id = c.id and a.user_id = current_user_id)
    and exists (select 1 from public.conversation_members b where b.conversation_id = c.id and b.user_id = target_user)
  order by c.created_at
  limit 1;

  if found_conversation is null then
    insert into public.conversations (kind, created_by)
    values ('direct', current_user_id)
    returning id into found_conversation;
    insert into public.conversation_members (conversation_id, user_id, role)
    values (found_conversation, current_user_id, 'admin'), (found_conversation, target_user, 'member');
  end if;
  return found_conversation;
end;
$$;

revoke all on function public.create_direct_conversation(uuid) from public;
grant execute on function public.create_direct_conversation(uuid) to authenticated;

-- Oculta de las búsquedas a las personas bloqueadas o que bloquearon al usuario actual.
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
    and (p.username ilike '%' || btrim(search_term) || '%' or p.display_name ilike '%' || btrim(search_term) || '%')
    and not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = (select auth.uid()) and b.blocked_user_id = p.id)
         or (b.blocker_id = p.id and b.blocked_user_id = (select auth.uid()))
    )
  order by p.display_name
  limit 20;
$$;

revoke all on function public.search_voxly_users(text) from public;
grant execute on function public.search_voxly_users(text) to authenticated;

-- Protección de servidor: los mensajes directos se rechazan si existe bloqueo en cualquier dirección.
-- Los mensajes de grupos no se ven afectados por esta regla.
create or replace function public.prevent_blocked_direct_messages()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  conversation_kind text;
begin
  select c.kind into conversation_kind
  from public.conversations c
  where c.id = new.conversation_id;

  if conversation_kind = 'direct' and exists (
    select 1
    from public.conversation_members recipient
    join public.user_blocks b
      on (b.blocker_id = new.sender_id and b.blocked_user_id = recipient.user_id)
      or (b.blocker_id = recipient.user_id and b.blocked_user_id = new.sender_id)
    where recipient.conversation_id = new.conversation_id
      and recipient.user_id <> new.sender_id
  ) then
    raise exception 'No se puede enviar este mensaje porque existe un bloqueo entre los usuarios.';
  end if;

  return new;
end;
$$;

drop trigger if exists messages_prevent_blocked_direct on public.messages;
create trigger messages_prevent_blocked_direct
  before insert on public.messages
  for each row execute function public.prevent_blocked_direct_messages();

revoke all on function public.prevent_blocked_direct_messages() from public;
