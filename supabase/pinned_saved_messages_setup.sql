-- Voxly: mensajes fijados y guardados por usuario.
create table if not exists public.conversation_pins (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  pinned_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (conversation_id, message_id)
);

create table if not exists public.message_bookmarks (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);

create index if not exists conversation_pins_conversation_idx on public.conversation_pins(conversation_id, created_at desc);
create index if not exists message_bookmarks_user_idx on public.message_bookmarks(user_id, created_at desc);

create or replace function public.validate_voxly_pin_conversation()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare actual_conversation uuid;
begin
  select m.conversation_id into actual_conversation from public.messages m where m.id = new.message_id;
  if actual_conversation is null or actual_conversation <> new.conversation_id then
    raise exception 'El mensaje no pertenece a esta conversación.';
  end if;
  if not public.is_conversation_member(new.conversation_id) then
    raise exception 'Solo los integrantes pueden fijar mensajes.';
  end if;
  return new;
end;
$$;

drop trigger if exists conversation_pins_validate on public.conversation_pins;
create trigger conversation_pins_validate before insert or update on public.conversation_pins
for each row execute function public.validate_voxly_pin_conversation();

alter table public.conversation_pins enable row level security;
alter table public.message_bookmarks enable row level security;

drop policy if exists "conversation_pins_select_members" on public.conversation_pins;
create policy "conversation_pins_select_members" on public.conversation_pins
for select to authenticated using (public.is_conversation_member(conversation_id));

drop policy if exists "conversation_pins_insert_members" on public.conversation_pins;
create policy "conversation_pins_insert_members" on public.conversation_pins
for insert to authenticated with check (
  pinned_by = (select auth.uid()) and public.is_conversation_member(conversation_id)
);

drop policy if exists "conversation_pins_delete_members" on public.conversation_pins;
create policy "conversation_pins_delete_members" on public.conversation_pins
for delete to authenticated using (public.is_conversation_member(conversation_id));

drop policy if exists "message_bookmarks_select_own" on public.message_bookmarks;
create policy "message_bookmarks_select_own" on public.message_bookmarks
for select to authenticated using (
  user_id = (select auth.uid()) and exists (
    select 1 from public.messages m
    where m.id = message_id and public.is_conversation_member(m.conversation_id)
  )
);

drop policy if exists "message_bookmarks_insert_own" on public.message_bookmarks;
create policy "message_bookmarks_insert_own" on public.message_bookmarks
for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.messages m
    where m.id = message_id and public.is_conversation_member(m.conversation_id)
  )
);

drop policy if exists "message_bookmarks_delete_own" on public.message_bookmarks;
create policy "message_bookmarks_delete_own" on public.message_bookmarks
for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, delete on public.conversation_pins to authenticated;
grant select, insert, delete on public.message_bookmarks to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversation_pins') then
      alter publication supabase_realtime add table public.conversation_pins;
    end if;
  end if;
end $$;
