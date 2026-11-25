-- Voxly: señalización segura para llamadas de voz y video.
-- Ejecuta este archivo en Supabase > SQL Editor. No elimina ni modifica mensajes.

create table if not exists public.voxly_call_sessions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  caller_id uuid not null references auth.users(id) on delete cascade,
  callee_id uuid not null references auth.users(id) on delete cascade,
  call_type text not null check (call_type in ('audio', 'video')),
  status text not null default 'ringing' check (status in ('ringing', 'accepted', 'declined', 'ended')),
  created_at timestamptz not null default now(),
  check (caller_id <> callee_id)
);

create index if not exists voxly_call_sessions_callee_created_idx
  on public.voxly_call_sessions (callee_id, created_at desc);

create table if not exists public.voxly_call_signals (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.voxly_call_sessions(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid not null references auth.users(id) on delete cascade,
  signal_type text not null check (signal_type in ('offer', 'answer', 'ice')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  check (sender_id <> target_id)
);

create index if not exists voxly_call_signals_call_created_idx
  on public.voxly_call_signals (call_id, created_at);

alter table public.voxly_call_sessions enable row level security;
alter table public.voxly_call_signals enable row level security;

drop policy if exists "call_sessions_participants_read" on public.voxly_call_sessions;
create policy "call_sessions_participants_read" on public.voxly_call_sessions
  for select to authenticated using (caller_id = (select auth.uid()) or callee_id = (select auth.uid()));

drop policy if exists "call_sessions_caller_create" on public.voxly_call_sessions;
create policy "call_sessions_caller_create" on public.voxly_call_sessions
  for insert to authenticated with check (
    caller_id = (select auth.uid())
    and exists (
      select 1 from public.conversation_members mine
      join public.conversation_members theirs on theirs.conversation_id = mine.conversation_id
      join public.conversations c on c.id = mine.conversation_id
      where mine.conversation_id = conversation_id
        and mine.user_id = (select auth.uid())
        and theirs.user_id = callee_id
        and c.kind = 'direct'
    )
  );

drop policy if exists "call_sessions_participants_update" on public.voxly_call_sessions;
create policy "call_sessions_participants_update" on public.voxly_call_sessions
  for update to authenticated
  using (caller_id = (select auth.uid()) or callee_id = (select auth.uid()))
  with check (caller_id = (select auth.uid()) or callee_id = (select auth.uid()));

drop policy if exists "call_signals_participants_read" on public.voxly_call_signals;
create policy "call_signals_participants_read" on public.voxly_call_signals
  for select to authenticated using (
    sender_id = (select auth.uid()) or target_id = (select auth.uid())
  );

drop policy if exists "call_signals_sender_create" on public.voxly_call_signals;
create policy "call_signals_sender_create" on public.voxly_call_signals
  for insert to authenticated with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.voxly_call_sessions cs
      where cs.id = call_id
        and (
          (cs.caller_id = (select auth.uid()) and cs.callee_id = target_id)
          or (cs.callee_id = (select auth.uid()) and cs.caller_id = target_id)
        )
    )
  );

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'voxly_call_sessions') then
    alter publication supabase_realtime add table public.voxly_call_sessions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'voxly_call_signals') then
    alter publication supabase_realtime add table public.voxly_call_signals;
  end if;
exception when undefined_object then
  raise notice 'Habilita Realtime para las tablas de llamadas desde Supabase.';
end;
$$;
