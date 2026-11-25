-- Voxly: reacciones emoji en mensajes.
-- Ejecutar una sola vez en Supabase > SQL Editor.

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('👍', '❤️', '😂', '😮')),
  created_at timestamptz not null default now(),
  constraint message_reactions_unique_per_user unique (message_id, user_id, emoji)
);

create index if not exists message_reactions_message_id_idx
  on public.message_reactions(message_id);

alter table public.message_reactions enable row level security;

drop policy if exists "Conversation members can view message reactions" on public.message_reactions;
create policy "Conversation members can view message reactions"
on public.message_reactions for select to authenticated
using (
  exists (
    select 1 from public.messages m
    where m.id = message_id
      and public.is_conversation_member(m.conversation_id)
  )
);

drop policy if exists "Members can add own message reactions" on public.message_reactions;
create policy "Members can add own message reactions"
on public.message_reactions for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.messages m
    where m.id = message_id
      and public.is_conversation_member(m.conversation_id)
  )
);

drop policy if exists "Users can remove own message reactions" on public.message_reactions;
create policy "Users can remove own message reactions"
on public.message_reactions for delete to authenticated
using (user_id = auth.uid());

grant select, insert, delete on public.message_reactions to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'message_reactions'
     ) then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end $$;
