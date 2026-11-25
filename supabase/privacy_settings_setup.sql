-- Voxly: preferencias de privacidad del perfil.
-- Ejecuta este archivo en Supabase > SQL Editor. No elimina datos existentes.

alter table public.profiles
  add column if not exists show_online_status boolean not null default true,
  add column if not exists show_avatar boolean not null default true,
  add column if not exists allow_search boolean not null default true;

-- La búsqueda respeta los perfiles que no desean aparecer.
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
    and p.allow_search = true
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

grant select, update on public.profiles to authenticated;
