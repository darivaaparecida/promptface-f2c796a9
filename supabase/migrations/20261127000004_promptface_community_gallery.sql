-- PromptFace — migração 10: Galeria da Comunidade (27/11/2026).
--
-- Qualquer visitante vê a galeria; só aparece nela a foto que o dono
-- optou por compartilhar (generations.is_public). Curtir exige login.
-- O nome do autor NUNCA é exposto inteiro: a função get_community_gallery()
-- (security definer) devolve só o primeiro nome. A galeria começa vazia —
-- nenhum dado de exemplo é criado aqui.

-- 1) Opt-in de publicação na geração -----------------------------------------
alter table public.generations
  add column if not exists is_public boolean not null default false;

-- 2) Curtidas ------------------------------------------------------------------
create table if not exists public.community_likes (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, generation_id)
);

create index if not exists community_likes_generation_id_idx
  on public.community_likes (generation_id);

alter table public.community_likes enable row level security;

-- Qualquer um vê as curtidas das fotos públicas (não das privadas).
drop policy if exists "community_likes_select_public" on public.community_likes;
create policy "community_likes_select_public" on public.community_likes
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.generations g
      where g.id = community_likes.generation_id and g.is_public = true
    )
  );

drop policy if exists "community_likes_insert_own" on public.community_likes;
create policy "community_likes_insert_own" on public.community_likes
  for insert to authenticated
  with check (user_id = public.my_profile_id());

drop policy if exists "community_likes_delete_own" on public.community_likes;
create policy "community_likes_delete_own" on public.community_likes
  for delete to authenticated
  using (user_id = public.my_profile_id());

-- O GRANT geral da migração 3 só cobria as tabelas da época.
grant select on public.community_likes to anon, authenticated;
grant insert, delete on public.community_likes to authenticated;

-- 3) Gerações públicas legíveis por qualquer visitante -------------------------
drop policy if exists "generations_select_public" on public.generations;
create policy "generations_select_public" on public.generations
  for select to anon, authenticated
  using (is_public = true);

-- 4) Arquivo da foto pública legível no Storage --------------------------------
-- O bucket continua privado; só o arquivo cuja geração está pública abre.
drop policy if exists "generated_images_storage_select_public" on storage.objects;
create policy "generated_images_storage_select_public" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'generated-images'
    and exists (
      select 1 from public.generations g
      where g.filename = storage.objects.name and g.is_public = true
    )
  );

-- 5) Leitura da galeria (só 1º nome do autor, nada de users exposto) -----------
create or replace function public.get_community_gallery()
returns table (
  id uuid,
  scenario_title text,
  category_name text,
  author_first_name text,
  filename text,
  likes_count bigint,
  liked_by_me boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    g.id,
    g.scenario_title,
    g.category_name,
    split_part(coalesce(u.name, 'PromptFace'), ' ', 1) as author_first_name,
    g.filename,
    count(l.id) as likes_count,
    coalesce(bool_or(l.user_id = public.my_profile_id()), false) as liked_by_me,
    g.created_at
  from public.generations g
  left join public.users u on u.id = g.user_id
  left join public.community_likes l on l.generation_id = g.id
  where g.is_public = true
    and g.status = 'completed'
  group by g.id, g.scenario_title, g.category_name, u.name, g.filename, g.created_at
  order by g.created_at desc
  limit 30;
$$;

grant execute on function public.get_community_gallery() to anon, authenticated;
