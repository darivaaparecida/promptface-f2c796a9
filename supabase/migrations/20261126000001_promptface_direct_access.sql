-- ============================================================================
-- PromptFace — migração 2: acesso direto do navegador (sem servidor)
-- Projeto: promptface (https://fbpgsastfracksfvunpd.supabase.co)
-- Como rodar: Supabase Dashboard → SQL Editor → colar este arquivo inteiro
--             e clicar em Run. Rodar UMA vez, DEPOIS da migração 1.
--             Pode rodar de novo (a maioria dos comandos é idempotente).
--
-- O que este SQL faz:
--   1. Atualiza o schema para o catálogo novo (plano Essencial, preços
--      trimestral/anual, billing_interval, next_monthly_credit_grant_at).
--   2. Libera o acesso direto do navegador (role authenticated) com RLS:
--      cada usuário só toca nas PRÓPRIAS linhas; admin lê tudo.
--   3. Trava colunas sensíveis de users (créditos, plano, role...) contra
--      alteração direta pelo navegador — só o banco (triggers/RPCs) mexe.
--   4. Libera o Storage dos 2 buckets para os próprios arquivos do usuário.
--   5. Trigger em auth.users: cria a linha em public.users no cadastro
--      (10 créditos grátis) e marca email_verified ao confirmar o e-mail.
--   6. RPCs: claim_monthly_credits (liberação mensal p/ trimestral/anual)
--      e admin_adjust_credits (ajuste atômico de créditos pelo admin).
--   7. Upsert dos planos com o catálogo novo (Essencial + PRO + PREMIUM).
--
-- O que este SQL NÃO faz: não toca no servidor Express (ele continua
-- existindo só para a prévia do AI Studio) e não cria Edge Functions —
-- geração de imagem e checkout Stripe chegam na Fase 2.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Schema — catálogo novo (Essencial + trimestral/anual)
-- ---------------------------------------------------------------------------

-- users: intervalo de cobrança + próxima liberação mensal de créditos.
alter table public.users
  add column if not exists billing_interval text not null default 'monthly';
alter table public.users
  add column if not exists next_monthly_credit_grant_at timestamptz;

-- users.plan_id passa a aceitar 'essencial'.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'users_plan_id_check') then
    alter table public.users drop constraint users_plan_id_check;
  end if;
end $$;
alter table public.users
  add constraint users_plan_id_check
  check (plan_id in ('free_trial', 'essencial', 'pro', 'premium'));

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'users_billing_interval_check') then
    alter table public.users drop constraint users_billing_interval_check;
  end if;
end $$;
alter table public.users
  add constraint users_billing_interval_check
  check (billing_interval in ('monthly', 'quarterly', 'yearly'));

-- payments.plan_id passa a aceitar 'essencial'.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'payments_plan_id_check') then
    alter table public.payments drop constraint payments_plan_id_check;
  end if;
end $$;
alter table public.payments
  add constraint payments_plan_id_check
  check (plan_id in ('essencial', 'pro', 'premium'));

-- plans: id passa a aceitar 'essencial' + colunas de preço trimestral/anual.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'plans_id_check') then
    alter table public.plans drop constraint plans_id_check;
  end if;
end $$;
alter table public.plans
  add constraint plans_id_check
  check (id in ('essencial', 'pro', 'premium'));

alter table public.plans
  add column if not exists quarterly_price_brl numeric,
  add column if not exists yearly_price_brl numeric,
  add column if not exists quarterly_bonus_credits integer not null default 0,
  add column if not exists yearly_bonus_credits integer not null default 0;

-- ---------------------------------------------------------------------------
-- 2. Funções auxiliares (SECURITY DEFINER — leem public.users sem o RLS)
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where auth_user_id = auth.uid() and role = 'admin'
  );
$$;

-- id da linha em public.users do usuário logado (a chave das demais tabelas).
create or replace function public.my_profile_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from public.users where auth_user_id = auth.uid() limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 3. RLS — acesso direto do navegador (role authenticated)
--    As policies de SELECT da migração 1 continuam; aqui entram INSERT /
--    UPDATE / DELETE das próprias linhas e o acesso de admin.
-- ---------------------------------------------------------------------------

-- users: o próprio perfil pode ser atualizado (ex.: preferred_model);
-- o admin lê todos os perfis.
drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
  for update to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

drop policy if exists "users_select_admin" on public.users;
create policy "users_select_admin" on public.users
  for select to authenticated
  using (public.is_admin());

-- visual_profiles: CRUD da própria linha.
drop policy if exists "visual_profiles_insert_own" on public.visual_profiles;
create policy "visual_profiles_insert_own" on public.visual_profiles
  for insert to authenticated
  with check (user_id = public.my_profile_id());

drop policy if exists "visual_profiles_update_own" on public.visual_profiles;
create policy "visual_profiles_update_own" on public.visual_profiles
  for update to authenticated
  using (user_id = public.my_profile_id())
  with check (user_id = public.my_profile_id());

drop policy if exists "visual_profiles_delete_own" on public.visual_profiles;
create policy "visual_profiles_delete_own" on public.visual_profiles
  for delete to authenticated
  using (user_id = public.my_profile_id());

-- face_references: CRUD das próprias linhas.
drop policy if exists "face_references_insert_own" on public.face_references;
create policy "face_references_insert_own" on public.face_references
  for insert to authenticated
  with check (user_id = public.my_profile_id());

drop policy if exists "face_references_update_own" on public.face_references;
create policy "face_references_update_own" on public.face_references
  for update to authenticated
  using (user_id = public.my_profile_id())
  with check (user_id = public.my_profile_id());

drop policy if exists "face_references_delete_own" on public.face_references;
create policy "face_references_delete_own" on public.face_references
  for delete to authenticated
  using (user_id = public.my_profile_id());

-- generations: o navegador lê, atualiza (favorito/pasta/tags) e exclui as
-- próprias linhas. INSERT fica só para o servidor/Edge Function (Fase 2) —
-- ninguém cria foto no banco sem passar pela geração.
drop policy if exists "generations_update_own" on public.generations;
create policy "generations_update_own" on public.generations
  for update to authenticated
  using (user_id = public.my_profile_id())
  with check (user_id = public.my_profile_id());

drop policy if exists "generations_delete_own" on public.generations;
create policy "generations_delete_own" on public.generations
  for delete to authenticated
  using (user_id = public.my_profile_id());

-- folders: CRUD das próprias linhas.
drop policy if exists "folders_insert_own" on public.folders;
create policy "folders_insert_own" on public.folders
  for insert to authenticated
  with check (user_id = public.my_profile_id());

drop policy if exists "folders_update_own" on public.folders;
create policy "folders_update_own" on public.folders
  for update to authenticated
  using (user_id = public.my_profile_id())
  with check (user_id = public.my_profile_id());

drop policy if exists "folders_delete_own" on public.folders;
create policy "folders_delete_own" on public.folders
  for delete to authenticated
  using (user_id = public.my_profile_id());

-- credit_ledger / payments: só leitura das próprias linhas (a escrita é
-- feita pelos RPCs e pelo servidor/Edge Function, que ignoram o RLS).
-- (As policies de SELECT já existem desde a migração 1.)

-- moderation_logs: o navegador pode registrar os próprios bloqueios
-- (moderação local de prompt/upload) e o admin lê tudo.
drop policy if exists "moderation_logs_insert_own" on public.moderation_logs;
create policy "moderation_logs_insert_own" on public.moderation_logs
  for insert to authenticated
  with check (user_id = public.my_profile_id());

drop policy if exists "moderation_logs_select_admin" on public.moderation_logs;
create policy "moderation_logs_select_admin" on public.moderation_logs
  for select to authenticated
  using (public.is_admin());

-- notices: o admin cria, edita e exclui avisos.
drop policy if exists "notices_insert_admin" on public.notices;
create policy "notices_insert_admin" on public.notices
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "notices_update_admin" on public.notices;
create policy "notices_update_admin" on public.notices
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "notices_delete_admin" on public.notices;
create policy "notices_delete_admin" on public.notices
  for delete to authenticated
  using (public.is_admin());

-- waitlist: qualquer visitante pode se inscrever (não há leitura direta).
drop policy if exists "waitlist_insert_public" on public.waitlist;
create policy "waitlist_insert_public" on public.waitlist
  for insert to anon, authenticated
  with check (true);

-- settings: manutenção e cota Fal são públicas para leitura (o site mostra);
-- o admin lê e escreve todas as chaves.
drop policy if exists "settings_select_public" on public.settings;
create policy "settings_select_public" on public.settings
  for select to anon, authenticated
  using (key in ('maintenance', 'fal_quota'));

drop policy if exists "settings_admin_all" on public.settings;
create policy "settings_admin_all" on public.settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- generations / credit_ledger / payments: leitura do admin.
drop policy if exists "generations_select_admin" on public.generations;
create policy "generations_select_admin" on public.generations
  for select to authenticated
  using (public.is_admin());

drop policy if exists "credit_ledger_select_admin" on public.credit_ledger;
create policy "credit_ledger_select_admin" on public.credit_ledger
  for select to authenticated
  using (public.is_admin());

drop policy if exists "payments_select_admin" on public.payments;
create policy "payments_select_admin" on public.payments
  for select to authenticated
  using (public.is_admin());

drop policy if exists "waitlist_select_admin" on public.waitlist;
create policy "waitlist_select_admin" on public.waitlist
  for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. Trava de colunas sensíveis de users
--    Sem ela, qualquer usuário logado poderia se dar créditos, trocar de
--    plano ou virar admin com uma chamada direta ao Supabase. Só o banco
--    (triggers e RPCs SECURITY DEFINER, que rodam como postgres) pode mexer
--    nessas colunas; o navegador (role authenticated) só altera os demais
--    campos do próprio perfil (ex.: preferred_model).
-- ---------------------------------------------------------------------------

create or replace function public.protect_user_sensitive_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user <> 'postgres' then
    if old.credits is distinct from new.credits
      or old.plan_id is distinct from new.plan_id
      or old.role is distinct from new.role
      or old.subscription_status is distinct from new.subscription_status
      or old.stripe_customer_id is distinct from new.stripe_customer_id
      or old.stripe_subscription_id is distinct from new.stripe_subscription_id
      or old.current_period_end is distinct from new.current_period_end
      or old.next_monthly_credit_grant_at is distinct from new.next_monthly_credit_grant_at
      or old.billing_interval is distinct from new.billing_interval
      or old.email_verified is distinct from new.email_verified
      or old.auth_user_id is distinct from new.auth_user_id
    then
      raise exception 'Alteração não permitida neste campo da conta.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_user_sensitive_columns on public.users;
create trigger trg_protect_user_sensitive_columns
  before update on public.users
  for each row execute function public.protect_user_sensitive_columns();

-- ---------------------------------------------------------------------------
-- 5. Storage — o usuário autenticado só toca nos PRÓPRIOS arquivos.
--    Caminho: <id-do-perfil>/<arquivo> (a camada de dados já grava assim).
-- ---------------------------------------------------------------------------

drop policy if exists "face_references_storage_select_own" on storage.objects;
create policy "face_references_storage_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'face-references'
    and (storage.foldername(name))[1] = public.my_profile_id()::text);

drop policy if exists "face_references_storage_insert_own" on storage.objects;
create policy "face_references_storage_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'face-references'
    and (storage.foldername(name))[1] = public.my_profile_id()::text);

drop policy if exists "face_references_storage_update_own" on storage.objects;
create policy "face_references_storage_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'face-references'
    and (storage.foldername(name))[1] = public.my_profile_id()::text)
  with check (bucket_id = 'face-references'
    and (storage.foldername(name))[1] = public.my_profile_id()::text);

drop policy if exists "face_references_storage_delete_own" on storage.objects;
create policy "face_references_storage_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'face-references'
    and (storage.foldername(name))[1] = public.my_profile_id()::text);

drop policy if exists "generated_images_storage_select_own" on storage.objects;
create policy "generated_images_storage_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'generated-images'
    and (storage.foldername(name))[1] = public.my_profile_id()::text);

drop policy if exists "generated_images_storage_insert_own" on storage.objects;
create policy "generated_images_storage_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'generated-images'
    and (storage.foldername(name))[1] = public.my_profile_id()::text);

drop policy if exists "generated_images_storage_update_own" on storage.objects;
create policy "generated_images_storage_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'generated-images'
    and (storage.foldername(name))[1] = public.my_profile_id()::text)
  with check (bucket_id = 'generated-images'
    and (storage.foldername(name))[1] = public.my_profile_id()::text);

drop policy if exists "generated_images_storage_delete_own" on storage.objects;
create policy "generated_images_storage_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'generated-images'
    and (storage.foldername(name))[1] = public.my_profile_id()::text);

-- ---------------------------------------------------------------------------
-- 6. Trigger de cadastro: auth.users -> public.users (+ 10 créditos grátis)
--    Os 10 créditos vêm do BANCO, nunca de valor fixado no cliente.
--    Se o perfil falhar por qualquer motivo, o cadastro no Auth NÃO é
--    bloqueado (só registra um aviso no log do Postgres).
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
begin
  insert into public.users (
    id, auth_user_id, name, email, role, email_verified,
    credits, plan_id, subscription_status, created_at
  ) values (
    gen_random_uuid(),
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1)),
    new.email,
    'user',
    new.email_confirmed_at is not null,
    10,
    'free_trial',
    'inactive',
    now()
  )
  on conflict (auth_user_id) do nothing;

  select id into v_profile_id
  from public.users where auth_user_id = new.id;

  if v_profile_id is not null
    and not exists (
      select 1 from public.credit_ledger
      where user_id = v_profile_id and type = 'signup_bonus' and operation = 'signup'
    ) then
    insert into public.credit_ledger (
      id, user_id, type, operation, amount, balance_after, description, created_at
    ) values (
      gen_random_uuid(), v_profile_id, 'signup_bonus', 'signup', 10, 10,
      'Bônus de boas-vindas (10 créditos = 1 foto grátis)', now()
    );
  end if;
  return new;
exception when others then
  raise warning 'handle_new_user falhou para %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_handle_new_user on auth.users;
create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Quando o usuário confirma o e-mail pelo link, marca email_verified no perfil.
create or replace function public.handle_user_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.users set email_verified = true where auth_user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_handle_user_email_confirmed on auth.users;
create trigger trg_handle_user_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function public.handle_user_email_confirmed();

-- ---------------------------------------------------------------------------
-- 7. RPCs
-- ---------------------------------------------------------------------------

-- Liberação mensal de créditos para planos trimestral/anual (a mensal não
-- precisa: o Stripe renova e o webhook/Edge Function zera o ciclo).
-- Mesma regra que o servidor aplicava em /api/auth/session, /api/credits e
-- /api/subscription: reseta o saldo para a cota do plano e agenda +30 dias.
-- Chamado pelo frontend (AuthContext) quando a data está vencida.
create or replace function public.claim_monthly_credits()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users%rowtype;
  v_plan public.plans%rowtype;
  v_now timestamptz := now();
  v_interval text;
begin
  select * into v_user from public.users where auth_user_id = auth.uid();
  if v_user.id is null then return null; end if;
  if v_user.subscription_status <> 'active' then return null; end if;
  if v_user.plan_id = 'free_trial' then return null; end if;
  v_interval := coalesce(v_user.billing_interval, 'monthly');
  if v_interval = 'monthly' then return null; end if;
  if v_user.next_monthly_credit_grant_at is null
    or v_user.next_monthly_credit_grant_at > v_now then
    return null;
  end if;

  select * into v_plan from public.plans where id = v_user.plan_id;
  if v_plan.id is null then return null; end if;

  update public.users
    set credits = v_plan.credits_monthly,
        next_monthly_credit_grant_at = v_now + interval '30 days'
    where id = v_user.id;

  insert into public.credit_ledger (
    id, user_id, type, operation, amount, balance_after, description, created_at
  ) values (
    gen_random_uuid(), v_user.id, 'subscription_grant',
    'monthly_drop_' || v_plan.id || '_' || v_interval,
    v_plan.credits_monthly, v_plan.credits_monthly,
    'Liberação mensal do plano ' || v_plan.name || ' (' ||
      case v_interval when 'quarterly' then 'Trimestral' else 'Anual' end || ')',
    v_now
  );

  return jsonb_build_object(
    'credits', v_plan.credits_monthly,
    'next_grant_at', v_now + interval '30 days'
  );
end;
$$;

-- Ajuste de créditos pelo admin (atômico: saldo + extrato juntos).
create or replace function public.admin_adjust_credits(
  p_user_id uuid, p_delta integer, p_reason text
)
returns public.users
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user public.users%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Acesso restrito a administradores.';
  end if;

  update public.users
    set credits = greatest(0, credits + p_delta)
    where id = p_user_id
    returning * into v_user;
  if v_user.id is null then
    raise exception 'Usuário não encontrado.';
  end if;

  insert into public.credit_ledger (
    id, user_id, type, operation, amount, balance_after, description, created_at
  ) values (
    gen_random_uuid(), v_user.id, 'admin_adjustment', 'admin', p_delta,
    v_user.credits, coalesce(nullif(p_reason, ''), 'Ajuste administrativo'), now()
  );

  return v_user;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. Planos — upsert com o catálogo novo (valores exatos de
--    src/shared/catalog.ts; nada inventado). O seed (scripts/seed-supabase.ts)
--    faz o mesmo a partir do código; este upsert garante o banco mesmo sem
--    rodar o seed de novo.
-- ---------------------------------------------------------------------------

insert into public.plans (
  id, name, audience, price_brl, price_formatted,
  quarterly_price_brl, yearly_price_brl,
  quarterly_bonus_credits, yearly_bonus_credits,
  credits_monthly, max_photos_monthly, description, features, highlighted, sort_order
) values
  (
    'essencial', 'Essencial', 'Entrada acessível', 24.9, 'R$ 24,90',
    59.7, 199.0, 20, 50,
    80, 8,
    'Para quem quer renovar foto de perfil, currículo ou redes sociais gastando pouco por mês.',
    array[
      '80 créditos mensais (até 8 fotos por mês)',
      'Acesso completo aos 84 cenários prontos',
      'Criação livre com descrição personalizada',
      'Perfil Visual salvo com suas referências privadas',
      'Créditos liberados todo mês (não acumulam)'
    ],
    false, 0
  ),
  (
    'pro', 'PRO', 'Para uso pessoal e redes sociais', 49.9, 'R$ 49,90',
    119.7, 399.0, 20, 50,
    200, 20,
    'Ideal para renovar seu perfil com frequência, criar fotos profissionais e explorar cenários.',
    array[
      '200 créditos mensais (até 20 fotos por mês)',
      'Acesso completo aos 84 cenários prontos',
      'Criação livre com descrição personalizada',
      'Perfil Visual salvo com suas referências privadas',
      'Galeria pessoal em alta resolução',
      'Créditos liberados todo mês (não acumulam)'
    ],
    false, 1
  ),
  (
    'premium', 'PREMIUM', 'Para criadores e uso frequente', 99.9, 'R$ 99,90',
    239.7, 799.0, 20, 50,
    600, 60,
    'Mais volume mensal, variações e acesso completo às edições no PromptFace Studio.',
    array[
      '600 créditos mensais (até 60 fotos por mês)',
      'Tudo do plano PRO incluído',
      'Criação de variações a partir de fotos geradas (10 créditos)',
      'Ferramentas avançadas de edição no PromptFace Studio',
      'Acesso antecipado a novos cenários da plataforma',
      'Créditos liberados todo mês (não acumulam)'
    ],
    true, 2
  )
on conflict (id) do update set
  name = excluded.name,
  audience = excluded.audience,
  price_brl = excluded.price_brl,
  price_formatted = excluded.price_formatted,
  quarterly_price_brl = excluded.quarterly_price_brl,
  yearly_price_brl = excluded.yearly_price_brl,
  quarterly_bonus_credits = excluded.quarterly_bonus_credits,
  yearly_bonus_credits = excluded.yearly_bonus_credits,
  credits_monthly = excluded.credits_monthly,
  max_photos_monthly = excluded.max_photos_monthly,
  description = excluded.description,
  features = excluded.features,
  highlighted = excluded.highlighted,
  sort_order = excluded.sort_order;
