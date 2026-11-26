-- ============================================================================
-- PromptFace — migração inicial para o Supabase
-- Projeto: promptface (https://fbpgsastfracksfvunpd.supabase.co)
-- Como rodar: Supabase Dashboard → SQL Editor → colar este arquivo inteiro
--             e clicar em Run. Rodar UMA vez, nesta ordem.
-- O que este SQL faz: cria as 14 tabelas, índices, RLS e os 2 buckets
-- privados do Storage. NÃO insere categorias/cenários/planos — isso é o
-- seed (scripts/seed-supabase.ts), que lê os dados exatos do código.
-- As senhas antigas (scrypt) NÃO migram: contas do JSON antigo precisam
-- criar conta nova ou usar o claim-admin / redefinição de senha.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Tabela: users (perfil interno; a senha vive no Supabase Auth)
-- id = id interno do app (uuid). auth_user_id = auth.users.id (login).
-- Contas importadas do JSON antigo ficam com auth_user_id NULL até criarem
-- o login no Supabase Auth.
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key,
  auth_user_id uuid unique references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null default 'user' check (role in ('user', 'admin')),
  email_verified boolean not null default false,
  verification_code text,
  reset_code text,
  reset_expires_at bigint,
  credits integer not null default 0,
  plan_id text not null default 'free_trial'
    check (plan_id in ('free_trial', 'pro', 'premium')),
  subscription_status text not null default 'inactive'
    check (subscription_status in ('inactive', 'active', 'canceled', 'past_due')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end text,
  preferred_model text not null default 'auto',
  created_at timestamptz not null default now()
);
create index if not exists users_email_idx on public.users (email);
create index if not exists users_auth_user_id_idx on public.users (auth_user_id);

-- ---------------------------------------------------------------------------
-- Tabela: visual_profiles (1 por usuário, chave = user_id)
-- ---------------------------------------------------------------------------
create table if not exists public.visual_profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  eye_color text,
  hair_color_style text,
  hair_type text,
  beard_mustache text,
  skin_tone text,
  facial_features text,
  height_body_type text,
  other_characteristics text,
  preferred_model text not null default 'auto',
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Tabela: face_references (fotos de referência facial; o arquivo vai para o
-- bucket privado face-references — aqui fica só o nome do arquivo)
-- ---------------------------------------------------------------------------
create table if not exists public.face_references (
  id uuid primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  filename text not null,
  mime_type text not null,
  consent_accepted boolean not null default false,
  consent_timestamp timestamptz not null,
  face_verified boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists face_references_user_id_idx on public.face_references (user_id);

-- ---------------------------------------------------------------------------
-- Tabela: folders (precisa vir antes de generations: generations tem FK
-- folder_id para folders)
-- ---------------------------------------------------------------------------
create table if not exists public.folders (
  id uuid primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index if not exists folders_user_id_idx on public.folders (user_id);

-- ---------------------------------------------------------------------------
-- Tabela: generations (versions = versões do Studio, em JSONB)
-- ---------------------------------------------------------------------------
create table if not exists public.generations (
  id uuid primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  mode text not null check (mode in ('preset', 'free', 'variation')),
  scenario_id text,
  scenario_title text not null,
  category_id text not null,
  category_name text not null,
  prompt_used text not null,
  aspect_ratio text not null default '3:4',
  filename text not null,
  mime_type text not null,
  cost_credits integer not null default 10,
  estimated_cost_usd numeric not null default 0,
  status text not null default 'completed'
    check (status in ('pending', 'completed', 'failed')),
  provider text not null default '',
  model text not null default '',
  favorite boolean not null default false,
  folder_id uuid references public.folders (id) on delete set null,
  tags text[] not null default '{}',
  synth_id_marked boolean not null default false,
  versions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists generations_user_id_idx on public.generations (user_id);
create index if not exists generations_folder_id_idx on public.generations (folder_id);

-- ---------------------------------------------------------------------------
-- Tabela: credit_ledger (extrato de créditos)
-- ---------------------------------------------------------------------------
create table if not exists public.credit_ledger (
  id uuid primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  type text not null check (type in ('signup_bonus', 'reserve', 'confirm', 'refund', 'subscription_grant', 'admin_adjustment')),
  operation text not null,
  amount integer not null,
  balance_after integer not null,
  description text not null,
  created_at timestamptz not null default now()
);
create index if not exists credit_ledger_user_id_idx on public.credit_ledger (user_id);

-- ---------------------------------------------------------------------------
-- Tabela: payments
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  plan_id text not null check (plan_id in ('pro', 'premium')),
  amount_brl numeric not null,
  status text not null check (status in ('paid', 'canceled', 'refunded', 'pending')),
  stripe_session_id text,
  method text not null,
  created_at timestamptz not null default now()
);
create index if not exists payments_user_id_idx on public.payments (user_id);

-- ---------------------------------------------------------------------------
-- Tabela: moderation_logs
-- ---------------------------------------------------------------------------
create table if not exists public.moderation_logs (
  id uuid primary key,
  user_id uuid references public.users (id) on delete cascade,
  user_email text,
  input_snippet text not null,
  reason text not null,
  action text not null check (action in ('blocked_prompt', 'blocked_upload')),
  created_at timestamptz not null default now()
);
create index if not exists moderation_logs_user_id_idx on public.moderation_logs (user_id);

-- ---------------------------------------------------------------------------
-- Tabela: notices
-- ---------------------------------------------------------------------------
create table if not exists public.notices (
  id uuid primary key,
  title text not null,
  message text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists notices_active_idx on public.notices (active);

-- ---------------------------------------------------------------------------
-- Tabela: waitlist
-- ---------------------------------------------------------------------------
create table if not exists public.waitlist (
  id uuid primary key,
  email text not null,
  feature text not null check (feature in ('generation', 'payments', 'general')),
  created_at timestamptz not null default now(),
  unique (email, feature)
);
create index if not exists waitlist_email_idx on public.waitlist (email);

-- ---------------------------------------------------------------------------
-- Catálogo: categories / scenarios / plans
-- sort_order preserva a ordem do catálogo do código (src/shared/catalog.ts).
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id text primary key,
  name text not null,
  slug text not null,
  description text not null,
  image text not null,
  sort_order integer not null default 0
);

create table if not exists public.scenarios (
  id text primary key,
  -- Sem FK para categories(id) de propósito: se o seed ainda não rodou, o
  -- catálogo vive só na memória do servidor (fallback do código) e um
  -- cenário criado pelo admin precisa poder ser salvo mesmo assim.
  -- A validação de categoria existe no código (routes.ts).
  category_id text not null,
  category_name text not null,
  title text not null,
  description text not null,
  image text not null,
  default_outfit text not null,
  default_environment text not null,
  default_pose text not null,
  default_lighting text not null,
  default_style text not null,
  popular boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0
);
create index if not exists scenarios_category_id_idx on public.scenarios (category_id);

create table if not exists public.plans (
  id text primary key check (id in ('pro', 'premium')),
  name text not null,
  audience text not null,
  price_brl numeric not null,
  price_formatted text not null,
  credits_monthly integer not null,
  max_photos_monthly integer not null,
  description text not null,
  features text[] not null default '{}',
  highlighted boolean not null default false,
  sort_order integer not null default 0
);

-- ---------------------------------------------------------------------------
-- Tabela: settings (chave/valor — maintenance e fal_quota)
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  key text primary key,
  value jsonb not null
);

-- ============================================================================
-- Row Level Security
-- O servidor usa a service_role, que ignora o RLS — estas políticas valem
-- para acesso direto (anon/authenticated). O frontend NUNCA fala com o
-- Supabase diretamente; tudo passa pela API Express.
-- ============================================================================
alter table public.users enable row level security;
alter table public.visual_profiles enable row level security;
alter table public.face_references enable row level security;
alter table public.generations enable row level security;
alter table public.folders enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.payments enable row level security;
alter table public.moderation_logs enable row level security;
alter table public.notices enable row level security;
alter table public.waitlist enable row level security;
alter table public.categories enable row level security;
alter table public.scenarios enable row level security;
alter table public.plans enable row level security;
alter table public.settings enable row level security;

-- Cada usuário autenticado só lê a própria linha de perfil.
create policy "users_select_own" on public.users
  for select to authenticated
  using (auth_user_id = auth.uid());

-- Dados do usuário: só as próprias linhas (via perfil vinculado ao auth.uid()).
create policy "visual_profiles_select_own" on public.visual_profiles
  for select to authenticated
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "face_references_select_own" on public.face_references
  for select to authenticated
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "generations_select_own" on public.generations
  for select to authenticated
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "folders_select_own" on public.folders
  for select to authenticated
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "credit_ledger_select_own" on public.credit_ledger
  for select to authenticated
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "payments_select_own" on public.payments
  for select to authenticated
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

create policy "moderation_logs_select_own" on public.moderation_logs
  for select to authenticated
  using (user_id in (select id from public.users where auth_user_id = auth.uid()));

-- Catálogo e avisos: leitura pública (já são públicos na API).
create policy "notices_select_public" on public.notices
  for select to anon, authenticated using (active = true);

create policy "categories_select_public" on public.categories
  for select to anon, authenticated using (true);

create policy "scenarios_select_public" on public.scenarios
  for select to anon, authenticated using (true);

create policy "plans_select_public" on public.plans
  for select to anon, authenticated using (true);

-- waitlist e settings: sem acesso direto (só o servidor, via service_role).
-- Nenhuma policy = acesso negado para anon/authenticated.

-- ============================================================================
-- Storage — buckets privados (nada de foto de usuário em URL pública)
-- Os arquivos só saem pelas rotas /media/* da API, após checagem de dono.
-- Se preferir criar pelo Dashboard: Storage → New bucket → desmarcar
-- "Public bucket". Os nomes precisam ser exatamente estes:
--   face-references  (fotos de referência facial)
--   generated-images (fotos geradas e versões do Studio)
-- ============================================================================
insert into storage.buckets (id, name, public)
values
  ('face-references', 'face-references', false),
  ('generated-images', 'generated-images', false)
on conflict (id) do nothing;
