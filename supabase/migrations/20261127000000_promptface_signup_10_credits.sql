-- Migração 6 — bônus de cadastro volta para 10 créditos (27/11/2026)
-- Decisão da JR: cadastro dá 10 créditos (1 foto grátis), não mais 20.
-- O teste grátis é 1 geração com o FLUX.1 Kontext Max (10 créditos); com
-- 10 créditos de saldo o usuário só consegue essa 1 geração, então o
-- "Max só 1 vez" já é garantido pelo saldo. Usuários que já se cadastraram
-- com 20 créditos NÃO perdem nada (a trigger só vale para novos cadastros).
-- Re-rodável (idempotente).
-- ---------------------------------------------------------------------------

-- Trigger de cadastro: auth.users -> public.users (+ 10 créditos grátis)
-- Os 10 créditos vêm do BANCO, nunca de valor fixado no cliente.
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
