-- Voxly: suscripciones privadas para notificaciones push.
-- Ejecuta este archivo en Supabase > SQL Editor.

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own"
  on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
create policy "push_subscriptions_insert_own"
  on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "push_subscriptions_update_own" on public.push_subscriptions;
create policy "push_subscriptions_update_own"
  on public.push_subscriptions for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
create policy "push_subscriptions_delete_own"
  on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.push_subscriptions from anon, public;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

-- Funciones seguras para registrar y quitar una suscripción del dispositivo actual.
create or replace function public.save_voxly_push_subscription(
  target_endpoint text,
  target_subscription jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Debes iniciar sesión para activar las notificaciones.';
  end if;
  if nullif(btrim(target_endpoint), '') is null or target_subscription is null then
    raise exception 'La suscripción de notificaciones no es válida.';
  end if;

  insert into public.push_subscriptions (endpoint, user_id, subscription, updated_at)
  values (target_endpoint, (select auth.uid()), target_subscription, now())
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        subscription = excluded.subscription,
        updated_at = now();
end;
$$;

create or replace function public.remove_voxly_push_subscription(target_endpoint text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Debes iniciar sesión para desactivar las notificaciones.';
  end if;
  delete from public.push_subscriptions
  where endpoint = target_endpoint
    and user_id = (select auth.uid());
end;
$$;

revoke all on function public.save_voxly_push_subscription(text, jsonb) from public;
revoke all on function public.remove_voxly_push_subscription(text) from public;
grant execute on function public.save_voxly_push_subscription(text, jsonb) to authenticated;
grant execute on function public.remove_voxly_push_subscription(text) to authenticated;
