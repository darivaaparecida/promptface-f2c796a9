-- PromptFace — migração 8: programa de convites (27/11/2026).
--
-- Cada usuário tem um código de convite único (users.invite_code, 8 letras).
-- O link de convite é promptface.com.br/convite/CODIGO e cai no cadastro
-- com o código. Quando o convidado cria a conta, o trigger handle_new_user
-- registra a conversão em public.invites e paga 10 créditos ao convidador
-- (INVITE_REWARD_CREDITS). O convidado ganha só o bônus normal de cadastro
-- (10 créditos); se um dia o convidado também ganhar extra, o trigger é o
-- único lugar a mudar.
--
-- Antiabuso: 1 recompensa por conta convidada (invited_user_id é único) e
-- ninguém convida a si mesmo. O bloco de convite roda dentro do seu próprio
-- BEGIN/EXCEPTION: se qualquer coisa falhar, só a recompensa é perdida —
-- o cadastro e o bônus de boas-vindas nunca quebram por causa de convite.
-- A página /convites lê os dados por RLS (só as próprias conversões).

-- 1) Código de convite por usuário ------------------------------------------
alter table public.users
  add column if not exists invite_code text unique;

-- 2) Tabela de conversões -----------------------------------------------------
create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  inviter_user_id uuid not null references public.users (id) on delete cascade,
  invite_code text not null,
  invited_user_id uuid references public.users (id) on delete set null,
  invited_name text,
  invited_email text,
  status text not null default 'converted'
    check (status in ('pending', 'converted')),
  reward_credits integer not null default 10,
  created_at timestamptz not null default now(),
  converted_at timestamptz
);

create unique index if not exists invites_invited_user_id_unique
  on public.invites (invited_user_id) where invited_user_id is not null;
create index if not exists invites_inviter_user_id_idx
  on public.invites (inviter_user_id);
create index if not exists invites_invite_code_idx
  on public.invites (invite_code);

alter table public.invites enable row level security;

drop policy if exists "invites_select_own" on public.invites;
create policy "invites_select_own" on public.invites
  for select to authenticated
  using (inviter_user_id = public.my_profile_id());

-- Sem política de insert/update/delete para o navegador: conversões só
-- acontecem dentro do trigger (security definer). O GRANT de leitura é
-- necessário porque o GRANT geral da migração 3 só cobria as tabelas
-- que existiam na época.
grant select on public.invites to authenticated;

-- 3) Geração do código (8 caracteres, sem letras/números confusos) -----------
create or replace function public.generate_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_i int;
begin
  loop
    v_code := '';
    for v_i in 1..8 loop
      v_code := v_code || substr(v_alphabet, floor(random() * length(v_alphabet) + 1)::int, 1);
    end loop;
    exit when not exists (select 1 from public.users where invite_code = v_code);
  end loop;
  return v_code;
end;
$$;

-- 4) Código do usuário logado (cria na primeira vez que abrir /convites) -----
create or replace function public.get_or_create_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_code text;
begin
  v_profile_id := public.my_profile_id();
  if v_profile_id is null then
    raise exception 'usuário não autenticado';
  end if;

  select invite_code into v_code from public.users where id = v_profile_id;
  if v_code is not null then
    return v_code;
  end if;

  v_code := public.generate_invite_code();
  update public.users set invite_code = v_code where id = v_profile_id;
  return v_code;
end;
$$;

grant execute on function public.generate_invite_code() to authenticated;
grant execute on function public.get_or_create_invite_code() to authenticated;

-- 5) Recompensa no cadastro (estende o handle_new_user da migração 6) --------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_invite_code text;
  v_inviter_id uuid;
  v_inviter_credits int;
  v_invited_name text;
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

  -- Convite: o código veio no cadastro (options.data.invite_code).
  -- Bloco isolado: qualquer falha aqui só perde a recompensa.
  begin
    v_invite_code := nullif(new.raw_user_meta_data ->> 'invite_code', '');
    if v_invite_code is not null and v_profile_id is not null then
      select id, credits into v_inviter_id, v_inviter_credits
      from public.users where invite_code = v_invite_code;

      if v_inviter_id is not null
        and v_inviter_id <> v_profile_id
        and not exists (
          select 1 from public.invites where invited_user_id = v_profile_id
        ) then
        v_invited_name := coalesce(
          nullif(new.raw_user_meta_data ->> 'name', ''),
          split_part(new.email, '@', 1)
        );

        insert into public.invites (
          id, inviter_user_id, invite_code, invited_user_id,
          invited_name, invited_email, status, reward_credits,
          created_at, converted_at
        ) values (
          gen_random_uuid(), v_inviter_id, v_invite_code, v_profile_id,
          v_invited_name, new.email, 'converted', 10,
          now(), now()
        );

        update public.users
        set credits = v_inviter_credits + 10
        where id = v_inviter_id;

        insert into public.credit_ledger (
          id, user_id, type, operation, amount, balance_after, description, created_at
        ) values (
          gen_random_uuid(), v_inviter_id, 'invite_reward',
          'invite_' || v_profile_id, 10, v_inviter_credits + 10,
          'Recompensa por convite: ' || v_invited_name || ' criou a conta pelo seu link (+10 créditos)',
          now()
        );
      end if;
    end if;
  exception when others then
    raise warning 'invite reward falhou para %: %', new.id, sqlerrm;
  end;

  return new;
exception when others then
  raise warning 'handle_new_user falhou para %: %', new.id, sqlerrm;
  return new;
end;
$$;
