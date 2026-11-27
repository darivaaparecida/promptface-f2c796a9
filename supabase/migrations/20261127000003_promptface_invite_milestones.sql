-- PromptFace — migração 9: modelo novo de convites (27/11/2026).
--
-- Mantém TUDO da migração 8 (código por usuário, tabela invites, +10
-- créditos ao convidador no cadastro) e ADICIONA o que faltava do modelo
-- novo, sem tirar nada do que já existe:
--
-- 1) Bônus de marco (+5/+5): quando o amigo convidado sobe a 1ª foto de
--    referência no Perfil Visual (ou gerar a 1ª foto, na Fase 2), quem
--    indicou ganha +5 créditos e o amigo ganha +5 extras. Com os 10 do
--    cadastro, o amigo fica com 15 = 1 foto + 5 sobrando ("falta só mais 1").
-- 2) Bônus de assinatura (+30/+10): quando o amigo assinar qualquer plano,
--    quem indicou ganha +30 créditos e o amigo +10 extras no 1º mês.
--    A função fica pronta agora; quem vai chamar é o webhook do Stripe
--    na Fase 2 (checkout ainda não existe).
-- 3) Teto anti-fraude: no máximo 5 bônus de marco por mês por convidador
--    (25 créditos). O bônus de assinatura é ilimitado (só paga quem pagou).
--
-- A confirmação de e-mail NÃO é condição da recompensa: ela está desligada
-- no projeto por decisão da dona, e o marco da 1ª foto é a prova real de
-- uso. Autoindicação continua bloqueada no trigger da migração 8 e o
-- código não pode ser trocado depois do cadastro (não existe função p/ isso).

-- 1) Novas colunas na tabela invites ------------------------------------------
alter table public.invites
  add column if not exists milestone_reward_paid boolean not null default false,
  add column if not exists milestone_paid_at timestamptz,
  add column if not exists subscription_bonus_paid boolean not null default false,
  add column if not exists subscription_bonus_paid_at timestamptz;

-- 2) Bônus de marco: 1ª foto de referência ou 1ª geração ----------------------
create or replace function public.check_invite_milestone(
  p_milestone text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_invite public.invites%rowtype;
  v_inviter_credits int;
  v_invited_credits int;
  v_milestone_ok boolean := false;
  v_paid_this_month int;
begin
  -- O usuário é sempre quem está logado (nunca vem do navegador).
  v_user_id := public.my_profile_id();
  if v_user_id is null then return false; end if;
  if p_milestone not in ('first_photo', 'first_generation') then return false; end if;

  select * into v_invite
  from public.invites
  where invited_user_id = v_user_id
    and status = 'converted'
    and milestone_reward_paid = false
  order by created_at asc
  limit 1;
  if v_invite.id is null then return false; end if;

  -- O marco precisa ser real (não basta chamar a função).
  if p_milestone = 'first_photo' then
    v_milestone_ok := exists (
      select 1 from public.face_references where user_id = v_user_id
    );
  else
    v_milestone_ok := exists (
      select 1 from public.generations
      where user_id = v_user_id and status = 'completed'
    );
  end if;
  if not v_milestone_ok then return false; end if;

  -- Teto: 5 bônus de marco por mês por convidador.
  select count(*) into v_paid_this_month
  from public.invites
  where inviter_user_id = v_invite.inviter_user_id
    and milestone_reward_paid = true
    and milestone_paid_at >= date_trunc('month', now());
  if v_paid_this_month >= 5 then return false; end if;

  select credits into v_inviter_credits
  from public.users where id = v_invite.inviter_user_id;
  select credits into v_invited_credits
  from public.users where id = v_user_id;
  if v_inviter_credits is null or v_invited_credits is null then return false; end if;

  update public.users
  set credits = v_inviter_credits + 5
  where id = v_invite.inviter_user_id;
  insert into public.credit_ledger (
    id, user_id, type, operation, amount, balance_after, description, created_at
  ) values (
    gen_random_uuid(), v_invite.inviter_user_id, 'invite_reward',
    'invite_milestone_' || v_user_id, 5, v_inviter_credits + 5,
    'Bônus de convite: amigo subiu a 1ª foto (+5 créditos)', now()
  );

  update public.users
  set credits = v_invited_credits + 5
  where id = v_user_id;
  insert into public.credit_ledger (
    id, user_id, type, operation, amount, balance_after, description, created_at
  ) values (
    gen_random_uuid(), v_user_id, 'invite_bonus',
    'invite_milestone_bonus', 5, v_invited_credits + 5,
    'Bônus por indicação: 1ª foto enviada (+5 créditos)', now()
  );

  update public.invites
  set milestone_reward_paid = true, milestone_paid_at = now()
  where id = v_invite.id;

  return true;
exception when others then
  raise warning 'check_invite_milestone falhou para %: %', v_user_id, sqlerrm;
  return false;
end;
$$;

-- 3) Bônus de assinatura: amigo assinou um plano (chamar na Fase 2) -----------
create or replace function public.grant_subscription_referral_bonus(
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites%rowtype;
  v_inviter_credits int;
  v_invited_credits int;
begin
  if p_user_id is null then return false; end if;

  select * into v_invite
  from public.invites
  where invited_user_id = p_user_id
    and status = 'converted'
    and subscription_bonus_paid = false
  order by created_at asc
  limit 1;
  if v_invite.id is null then return false; end if;

  select credits into v_inviter_credits
  from public.users where id = v_invite.inviter_user_id;
  select credits into v_invited_credits
  from public.users where id = p_user_id;
  if v_inviter_credits is null or v_invited_credits is null then return false; end if;

  update public.users
  set credits = v_inviter_credits + 30
  where id = v_invite.inviter_user_id;
  insert into public.credit_ledger (
    id, user_id, type, operation, amount, balance_after, description, created_at
  ) values (
    gen_random_uuid(), v_invite.inviter_user_id, 'invite_reward',
    'invite_subscription_' || p_user_id, 30, v_inviter_credits + 30,
    'Bônus de convite: amigo assinou um plano (+30 créditos)', now()
  );

  update public.users
  set credits = v_invited_credits + 10
  where id = p_user_id;
  insert into public.credit_ledger (
    id, user_id, type, operation, amount, balance_after, description, created_at
  ) values (
    gen_random_uuid(), p_user_id, 'invite_bonus',
    'invite_subscription_bonus', 10, v_invited_credits + 10,
    'Bônus por indicação: 1º mês de plano (+10 créditos)', now()
  );

  update public.invites
  set subscription_bonus_paid = true, subscription_bonus_paid_at = now()
  where id = v_invite.id;

  return true;
exception when others then
  raise warning 'grant_subscription_referral_bonus falhou para %: %', p_user_id, sqlerrm;
  return false;
end;
$$;

grant execute on function public.check_invite_milestone(text) to authenticated;
grant execute on function public.grant_subscription_referral_bonus(uuid) to authenticated;
