-- Voxly: esquema inicial para Supabase
-- Ejecuta este archivo completo en Supabase > SQL Editor.
-- Todas las tablas privadas usan RLS y requieren una sesión autenticada.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text not null default 'Usuario Voxly',
  avatar_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default now(),
  unique (user_id, contact_user_id),
  check (user_id <> contact_user_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'direct' check (kind in ('direct', 'group')),
  title text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'admin')),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null default '',
  message_type text not null default 'text' check (message_type in ('text', 'image', 'audio', 'file', 'system')),
  attachment_url text,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc);
create index if not exists contacts_user_status_idx
  on public.contacts (user_id, status);
create index if not exists conversation_members_user_idx
  on public.conversation_members (user_id);

-- Función segura para comprobar membresía sin provocar recursión en las políticas RLS.
create or replace function public.is_conversation_member(target_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = target_conversation
      and cm.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_conversation_member(uuid) from public;
grant execute on function public.is_conversation_member(uuid) to authenticated;

create or replace function public.is_conversation_admin(target_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = target_conversation
      and cm.user_id = (select auth.uid())
      and cm.role = 'admin'
  );
$$;

revoke all on function public.is_conversation_admin(uuid) from public;
grant execute on function public.is_conversation_admin(uuid) to authenticated;

-- Crear perfil automáticamente al registrarse un usuario.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'Usuario Voxly')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

-- Perfiles: cada usuario puede consultar y modificar únicamente su perfil.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Contactos: solo las personas involucradas pueden ver la relación.
drop policy if exists "contacts_select_involved" on public.contacts;
create policy "contacts_select_involved" on public.contacts
  for select to authenticated using (
    user_id = (select auth.uid()) or contact_user_id = (select auth.uid())
  );
drop policy if exists "contacts_insert_own" on public.contacts;
create policy "contacts_insert_own" on public.contacts
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "contacts_update_involved" on public.contacts;
create policy "contacts_update_involved" on public.contacts
  for update to authenticated using (
    user_id = (select auth.uid()) or contact_user_id = (select auth.uid())
  ) with check (
    user_id = (select auth.uid()) or contact_user_id = (select auth.uid())
  );
drop policy if exists "contacts_delete_involved" on public.contacts;
create policy "contacts_delete_involved" on public.contacts
  for delete to authenticated using (
    user_id = (select auth.uid()) or contact_user_id = (select auth.uid())
  );

-- Conversaciones y miembros: solo integrantes pueden acceder.
drop policy if exists "conversations_select_members" on public.conversations;
create policy "conversations_select_members" on public.conversations
  for select to authenticated using (public.is_conversation_member(id));
drop policy if exists "conversations_insert_creator" on public.conversations;
create policy "conversations_insert_creator" on public.conversations
  for insert to authenticated with check (created_by = (select auth.uid()));
drop policy if exists "conversations_update_members" on public.conversations;
create policy "conversations_update_members" on public.conversations
  for update to authenticated using (public.is_conversation_member(id))
  with check (public.is_conversation_member(id));

drop policy if exists "members_select_conversation" on public.conversation_members;
create policy "members_select_conversation" on public.conversation_members
  for select to authenticated using (
    user_id = (select auth.uid()) or public.is_conversation_member(conversation_id)
  );
drop policy if exists "members_insert_self_or_admin" on public.conversation_members;
drop policy if exists "members_insert_creator_or_admin" on public.conversation_members;
create policy "members_insert_creator_or_admin" on public.conversation_members
  for insert to authenticated with check (
    (
      user_id = (select auth.uid())
      and exists (
        select 1 from public.conversations c
        where c.id = conversation_members.conversation_id
          and c.created_by = (select auth.uid())
      )
    )
    or public.is_conversation_admin(conversation_members.conversation_id)
  );
drop policy if exists "members_delete_self_or_admin" on public.conversation_members;
create policy "members_delete_self_or_admin" on public.conversation_members
  for delete to authenticated using (
    user_id = (select auth.uid())
    or public.is_conversation_admin(conversation_id)
  );

-- Mensajes: únicamente integrantes pueden leerlos; solo el remitente crea/edita/elimina.
drop policy if exists "messages_select_members" on public.messages;
create policy "messages_select_members" on public.messages
  for select to authenticated using (public.is_conversation_member(conversation_id));
drop policy if exists "messages_insert_as_member" on public.messages;
create policy "messages_insert_as_member" on public.messages
  for insert to authenticated with check (
    sender_id = (select auth.uid())
    and public.is_conversation_member(conversation_id)
  );
drop policy if exists "messages_update_sender" on public.messages;
create policy "messages_update_sender" on public.messages
  for update to authenticated using (sender_id = (select auth.uid()))
  with check (sender_id = (select auth.uid()));
drop policy if exists "messages_delete_sender" on public.messages;
create policy "messages_delete_sender" on public.messages
  for delete to authenticated using (sender_id = (select auth.uid()));

-- Habilitar actualizaciones en tiempo real para mensajes (sin duplicar la publicación).
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
exception
  when undefined_object then
    raise notice 'La publicación supabase_realtime no existe todavía; habilita Realtime desde el panel.';
end;
$$;
