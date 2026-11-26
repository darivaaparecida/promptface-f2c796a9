-- Migração 5 — novos volumes dos planos (26/11/2026)
-- Decisão da JR: manter os preços e aumentar as fotos.
--   Essencial:  80 créditos /  8 fotos  -> 150 créditos / 15 fotos
--   PRO:       200 créditos / 20 fotos  -> 400 créditos / 40 fotos
--   PREMIUM:   600 créditos / 60 fotos  -> 800 créditos / 80 fotos
--   Cadastro:  10 créditos (1 foto)     ->  20 créditos (2 fotos)
-- O site lê os planos do código (src/shared/catalog.ts); esta migração mantém
-- a tabela public.plans igual ao código porque o RPC claim_monthly_credits()
-- lê credits_monthly DAQUI na hora de liberar os créditos do mês.
-- O bônus de cadastro também vem do banco (trigger handle_new_user), por isso
-- a função é recriada aqui com 20 créditos. Re-rodável (idempotente).
-- ---------------------------------------------------------------------------

update public.plans
set credits_monthly = 150, max_photos_monthly = 15
where id = 'essencial';

update public.plans
set credits_monthly = 400, max_photos_monthly = 40
where id = 'pro';

update public.plans
set credits_monthly = 800, max_photos_monthly = 80
where id = 'premium';

-- Trigger de cadastro: auth.users -> public.users (+ 20 créditos grátis)
-- Os 20 créditos vêm do BANCO, nunca de valor fixado no cliente.
-- Se o perfil falhar por qualquer motivo, o cadastro no Auth NÃO é
-- bloqueado (só registra um aviso no log do Postgres).
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
    20,
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
      gen_random_uuid(), v_profile_id, 'signup_bonus', 'signup', 20, 20,
      'Bônus de boas-vindas (20 créditos = 2 fotos grátis)', now()
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
