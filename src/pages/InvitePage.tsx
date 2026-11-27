import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, CheckCircle2, Clock, Copy, Gift, MessageCircle, Share2, Twitter, UserPlus, Users } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { getMyInviteCode, getMyInvites, type InviteItem } from '../lib/db';
import {
  INVITE_GOAL_FRIENDS,
  INVITE_MILESTONE_REWARD_CREDITS,
  INVITE_REWARD_CREDITS,
  INVITE_SUBSCRIPTION_REWARD_CREDITS,
  buildInviteLink,
  buildInviteShareMessage,
} from '../shared/invites';

type InviteStatus = 'entrou' | 'pendente';

interface InvitedFriend {
  id: string;
  name: string;
  date: string;
  status: InviteStatus;
}

function formatInviteDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function InvitePage() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [invites, setInvites] = useState<InviteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [code, list] = await Promise.all([getMyInviteCode(), getMyInvites()]);
        if (cancelled) return;
        setInviteCode(code);
        setInvites(list);
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          err instanceof Error ? err.message : 'Não foi possível carregar seus convites.'
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const inviteLink = inviteCode ? buildInviteLink(inviteCode) : null;
  const shareMessage = inviteLink ? buildInviteShareMessage(inviteLink) : '';
  const whatsappUrl = inviteLink
    ? `https://wa.me/?text=${encodeURIComponent(shareMessage)}`
    : undefined;
  const twitterUrl = inviteLink
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}`
    : undefined;

  const friends: InvitedFriend[] = useMemo(
    () =>
      invites.map((item) => ({
        id: item.id,
        name: item.invitedName,
        date: formatInviteDate(item.convertedAt ?? item.createdAt),
        status: item.status === 'converted' ? 'entrou' : 'pendente',
      })),
    [invites]
  );
  const joinedCount = invites.filter((item) => item.status === 'converted').length;
  const creditsEarned = invites.reduce((sum, item) => sum + item.rewardCredits, 0);

  const summary = [
    {
      id: 'joined',
      label: 'Amigos que entraram',
      value: joinedCount,
      helper: 'Contas criadas pelo seu link',
      icon: Users,
    },
    {
      id: 'credits',
      label: 'Créditos ganhos com convites',
      value: creditsEarned,
      helper: 'Bônus acumulado nas indicações',
      icon: Gift,
    },
    {
      id: 'code',
      label: 'Seu código de convite',
      value: inviteCode ?? '—',
      helper: 'Use no seu link pessoal',
      icon: Share2,
    },
  ] as const;

  const handleCopyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      addToast({
        variant: 'success',
        title: 'Link copiado',
        description: 'Seu link de convite foi copiado para a área de transferência.',
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      addToast({
        variant: 'info',
        title: 'Copie manualmente',
        description: inviteLink,
      });
    }
  };

  if (!user && !loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-14 space-y-8">
        <header className="space-y-3 border-b border-slate-200 dark:border-white/10 pb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-[#8B5CF6]">
            Programa de convites
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-950 dark:text-white text-balance">
            Convide amigos e ganhe créditos
          </h1>
          <p className="text-sm sm:text-base text-slate-700 dark:text-[#A1A1AA] max-w-2xl leading-relaxed">
            Cada amigo que criar a conta pelo seu link rende {INVITE_REWARD_CREDITS} créditos
            para você.
          </p>
        </header>
        <div className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-5 sm:p-7 text-center space-y-4 shadow-sm dark:shadow-none">
          <p className="text-sm text-slate-700 dark:text-[#A1A1AA]">
            Faça login para ver seu link pessoal de convite.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white shadow-lg shadow-[#7C3AED]/25 hover:brightness-110"
          >
            Entrar na conta
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-14 space-y-8">
      {/* Header */}
      <header className="space-y-3 border-b border-slate-200 dark:border-white/10 pb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-[#8B5CF6]">
          Programa de convites
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-950 dark:text-white text-balance">
          Convide amigos e ganhe créditos
        </h1>
        <p className="text-sm sm:text-base text-slate-700 dark:text-[#A1A1AA] max-w-2xl leading-relaxed">
          Cada amigo que criar a conta pelo seu link rende {INVITE_REWARD_CREDITS} créditos
          para você.
        </p>
      </header>

      {loadError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {loadError}
        </p>
      )}

      {/* Personal invite link & share card */}
      <section
        aria-labelledby="invite-link-heading"
        className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-5 sm:p-7 space-y-5 shadow-sm dark:shadow-none"
      >
        <div className="flex items-start gap-3.5">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-[#7C3AED]/20 dark:text-[#C4B5FD]">
            <UserPlus className="w-5 h-5" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <h2
              id="invite-link-heading"
              className="font-display text-lg font-semibold text-slate-950 dark:text-white"
            >
              Seu link pessoal de convite
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-[#A1A1AA]">
              Copie o link abaixo ou envie direto no WhatsApp para convidar seus amigos.
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="sr-only">Seu link pessoal de convite</p>
            <div
              data-testid="invite-link-value"
              className="w-full min-h-[46px] px-3.5 sm:px-4 py-3 rounded-xl border border-slate-300 bg-slate-50 text-xs sm:text-sm text-slate-950 font-mono-num break-all select-all flex items-center dark:border-white/15 dark:bg-[#0D0D14] dark:text-white"
            >
              {loading ? 'Carregando seu link...' : inviteLink ?? '—'}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <button
              type="button"
              onClick={handleCopyLink}
              disabled={!inviteLink}
              className="min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white shadow-lg shadow-[#7C3AED]/25 hover:brightness-110 transition-all whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" aria-hidden="true" />
                  <span>Link copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" aria-hidden="true" />
                  <span>Copiar link</span>
                </>
              )}
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-emerald-700/45 bg-emerald-50 text-emerald-950 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-950/50 text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap shrink-0"
            >
              <MessageCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Compartilhar no WhatsApp</span>
            </a>

            {twitterUrl && (
              <a
                href={twitterUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Compartilhar convite no X"
                className="min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-300 bg-white text-slate-950 hover:bg-slate-100 dark:border-white/15 dark:bg-[#17171F] dark:text-white dark:hover:bg-white/5 text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap shrink-0"
              >
                <Twitter className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Compartilhar no X</span>
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Three summary cards */}
      <section aria-label="Resumo dos convites">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {summary.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-5 sm:p-6 space-y-3 shadow-sm dark:shadow-none"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-slate-600 dark:text-[#A1A1AA]">
                    {item.label}
                  </span>
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-violet-700 dark:bg-white/5 dark:text-[#A855F7]">
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  </span>
                </div>

                <p className="font-display text-3xl font-bold text-slate-950 dark:text-white font-mono-num">
                  {item.value}
                </p>

                <p className="text-xs text-slate-600 dark:text-[#A1A1AA]">{item.helper}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Metas de indicação */}
      <section
        aria-label="Metas de indicação"
        className="rounded-2xl border border-violet-600/40 bg-gradient-to-r from-violet-600/10 via-fuchsia-500/10 to-violet-600/10 dark:border-[#8B5CF6]/40 p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-slate-950 dark:text-white">
            Meta de indicação
          </h2>
          <span className="text-xs text-slate-700 dark:text-[#A1A1AA] font-mono-num">
            {Math.min(friends.length, INVITE_GOAL_FRIENDS)} de {INVITE_GOAL_FRIENDS} amigos
          </span>
        </div>
        <div
          className="mt-3 h-2 w-full rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden"
          role="progressbar"
          aria-valuenow={Math.round((Math.min(friends.length, INVITE_GOAL_FRIENDS) / INVITE_GOAL_FRIENDS) * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progresso da meta de indicação"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#A855F7] to-[#EC4899] transition-all"
            style={{
              width: `${(Math.min(friends.length, INVITE_GOAL_FRIENDS) / INVITE_GOAL_FRIENDS) * 100}%`,
            }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-700 dark:text-[#A1A1AA] leading-relaxed">
          {friends.length >= INVITE_GOAL_FRIENDS ? (
            <>
              Meta batida! Você já trouxe {friends.length}{' '}
              {friends.length === 1 ? 'amigo' : 'amigos'} — cada um rendeu{' '}
              {INVITE_REWARD_CREDITS} créditos, e quando eles enviarem a 1ª foto vocês
              ganham mais {INVITE_MILESTONE_REWARD_CREDITS} cada.
            </>
          ) : (
            <>
              Faltam {INVITE_GOAL_FRIENDS - friends.length}{' '}
              {INVITE_GOAL_FRIENDS - friends.length === 1 ? 'amigo' : 'amigos'} para a
              meta. Cada amigo que criar a conta rende {INVITE_REWARD_CREDITS} créditos
              para você — e quando ele enviar a 1ª foto, vocês dois ganham mais{' '}
              {INVITE_MILESTONE_REWARD_CREDITS}. Se ele assinar um plano, você ganha{' '}
              {INVITE_SUBSCRIPTION_REWARD_CREDITS} créditos.
            </>
          )}
        </p>
      </section>

      {/* Invited friends list */}
      <section
        aria-labelledby="invited-friends-heading"
        className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] overflow-hidden shadow-sm dark:shadow-none"
      >
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2
              id="invited-friends-heading"
              className="font-display text-base font-semibold text-slate-950 dark:text-white"
            >
              Amigos convidados
            </h2>
            <p className="text-xs text-slate-600 dark:text-[#A1A1AA] mt-0.5">
              Acompanhe quem já criou a conta usando o seu convite.
            </p>
          </div>
          <span className="text-xs text-slate-600 dark:text-[#A1A1AA] font-mono-num">
            {friends.length} {friends.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        {friends.length === 0 ? (
          <p className="px-5 sm:px-6 py-8 text-center text-sm text-slate-600 dark:text-[#A1A1AA]">
            Ninguém entrou pelo seu link ainda. Compartilhe e ganhe{' '}
            {INVITE_REWARD_CREDITS} créditos por amigo.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-white/10">
            {friends.map((friend, index) => {
            const isJoined = friend.status === 'entrou';
            return (
              <li
                key={friend.id}
                style={{ animationDelay: `${index * 70}ms` }}
                className="pf-fade-in-up px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-950 dark:text-white truncate">
                    {friend.name}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-[#A1A1AA] font-mono-num mt-0.5">
                    Convidado em {friend.date}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isJoined ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>entrou</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                      <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>pendente</span>
                    </span>
                  )}
                </div>
              </li>
            );
          })}
          </ul>
        )}
      </section>

      {/* Perguntas frequentes sobre os créditos por indicação */}
      <section
        aria-labelledby="invite-faq-heading"
        className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-5 sm:p-6 shadow-sm dark:shadow-none"
      >
        <h2
          id="invite-faq-heading"
          className="font-display text-base font-semibold text-slate-950 dark:text-white"
        >
          Perguntas frequentes
        </h2>
        <div className="mt-4 space-y-3">
          <details className="rounded-xl border border-slate-200 dark:border-white/10 px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-950 dark:text-white">
              Quantos créditos eu ganho por amigo?
            </summary>
            <p className="mt-2 text-xs text-slate-700 dark:text-[#A1A1AA] leading-relaxed">
              {INVITE_REWARD_CREDITS} créditos quando o amigo cria a conta pelo seu
              link, mais {INVITE_MILESTONE_REWARD_CREDITS} quando ele enviar a 1ª foto
              de referência. Se ele assinar qualquer plano, você ganha{' '}
              {INVITE_SUBSCRIPTION_REWARD_CREDITS} créditos.
            </p>
          </details>
          <details className="rounded-xl border border-slate-200 dark:border-white/10 px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-950 dark:text-white">
              O que meu amigo ganha?
            </summary>
            <p className="mt-2 text-xs text-slate-700 dark:text-[#A1A1AA] leading-relaxed">
              Os 10 créditos de boas-vindas (1 foto grátis) mais 5 extras quando
              enviar a 1ª foto — 15 no total. Se ele assinar um plano, ganha mais 10
              créditos no 1º mês.
            </p>
          </details>
          <details className="rounded-xl border border-slate-200 dark:border-white/10 px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-950 dark:text-white">
              Existe limite de bônus por mês?
            </summary>
            <p className="mt-2 text-xs text-slate-700 dark:text-[#A1A1AA] leading-relaxed">
              O bônus de 1ª foto é limitado a 5 por mês (25 créditos). O bônus por
              assinatura não tem limite — cada amigo que assinar rende 30 créditos.
            </p>
          </details>
          <details className="rounded-xl border border-slate-200 dark:border-white/10 px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-950 dark:text-white">
              Posso usar meu próprio link?
            </summary>
            <p className="mt-2 text-xs text-slate-700 dark:text-[#A1A1AA] leading-relaxed">
              Não. O sistema bloqueia autoindicação e cada conta só pode gerar a
              recompensa uma vez. O código de convite não pode ser trocado depois do
              cadastro.
            </p>
          </details>
        </div>
      </section>
    </div>
  );
}
