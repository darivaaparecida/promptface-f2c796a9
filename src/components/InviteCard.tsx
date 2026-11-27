import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Copy, Gift, MessageCircle, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getMyInviteCode, getMyInvites, type InviteItem } from '../lib/db';
import {
  INVITE_MILESTONE_REWARD_CREDITS,
  INVITE_REWARD_CREDITS,
  INVITE_SUBSCRIPTION_REWARD_CREDITS,
  buildInviteLink,
  buildInviteShareMessage,
} from '../shared/invites';

/**
 * Cartão "Indique e ganhe" do Meu Espaço: link de convite, contadores e
 * barra de meta para a próxima foto grátis. Carrega os próprios dados.
 */
export function InviteCard() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [invites, setInvites] = useState<InviteItem[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [code, list] = await Promise.all([getMyInviteCode(), getMyInvites()]);
        if (cancelled) return;
        setInviteCode(code);
        setInvites(list);
      } catch {
        // Sem link por enquanto; o cartão mostra o erro de forma discreta.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const inviteLink = inviteCode ? buildInviteLink(inviteCode) : null;
  const whatsappUrl = useMemo(
    () =>
      inviteLink
        ? `https://wa.me/?text=${encodeURIComponent(buildInviteShareMessage(inviteLink))}`
        : undefined,
    [inviteLink]
  );

  const friendsCount = invites.length;
  const subscribedCount = invites.filter((item) => item.subscriptionBonusPaid).length;
  const creditsEarned = invites.reduce(
    (sum, item) =>
      sum +
      item.rewardCredits +
      (item.milestoneRewardPaid ? INVITE_MILESTONE_REWARD_CREDITS : 0) +
      (item.subscriptionBonusPaid ? INVITE_SUBSCRIPTION_REWARD_CREDITS : 0),
    0
  );

  const credits = user?.credits ?? 0;
  const remainder = credits % 10;
  const photosAvailable = Math.floor(credits / 10);
  const missingToNext = remainder === 0 ? 10 : 10 - remainder;
  const progressPct = Math.round((remainder / 10) * 100);

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
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      addToast({
        variant: 'info',
        title: 'Copie manualmente',
        description: inviteLink,
      });
    }
  };

  if (!user) return null;

  return (
    <div className="rounded-2xl border border-slate-300 dark:border-white/10 pf-card-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-950 dark:text-white">
            Indique e ganhe
          </h2>
          <p className="text-xs text-slate-700 dark:text-[#A1A1AA]">
            Cada amigo que entrar pelo seu link rende {INVITE_REWARD_CREDITS} créditos — e
            mais {INVITE_MILESTONE_REWARD_CREDITS} quando ele enviar a 1ª foto
          </p>
        </div>
        <Link
          to="/convites"
          className="text-xs font-medium text-violet-700 hover:text-violet-900 dark:text-[#8B5CF6] dark:hover:text-[#A855F7] whitespace-nowrap"
        >
          Ver convites
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="w-full min-h-[46px] px-3.5 py-3 rounded-xl border border-slate-300 bg-slate-50 text-xs sm:text-sm text-slate-950 font-mono-num break-all select-all flex items-center dark:border-white/15 dark:bg-[#0D0D14] dark:text-white">
            {inviteLink ?? 'Carregando seu link...'}
          </div>
        </div>
        <div className="flex gap-3 shrink-0">
          <button
            type="button"
            onClick={handleCopyLink}
            disabled={!inviteLink}
            className="min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white shadow-lg shadow-[#7C3AED]/25 hover:brightness-110 whitespace-nowrap disabled:opacity-50"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" aria-hidden="true" />
                <span>Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" aria-hidden="true" />
                <span>Copiar link</span>
              </>
            )}
          </button>
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Compartilhar convite no WhatsApp"
              className="min-h-[46px] inline-flex items-center justify-center px-4 rounded-xl border border-emerald-700/45 bg-emerald-50 text-emerald-950 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-950/50 transition-colors"
            >
              <MessageCircle className="w-4 h-4" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="font-display text-xl font-bold text-slate-950 dark:text-white font-mono-num">
            {friendsCount}
          </p>
          <p className="text-[11px] text-slate-700 dark:text-[#A1A1AA]">Amigos cadastrados</p>
        </div>
        <div>
          <p className="font-display text-xl font-bold text-slate-950 dark:text-white font-mono-num">
            {subscribedCount}
          </p>
          <p className="text-[11px] text-slate-700 dark:text-[#A1A1AA]">Amigos que assinaram</p>
        </div>
        <div>
          <p className="font-display text-xl font-bold text-slate-950 dark:text-white font-mono-num">
            {creditsEarned}
          </p>
          <p className="text-[11px] text-slate-700 dark:text-[#A1A1AA]">Créditos ganhos</p>
        </div>
      </div>

      <div className="mt-4">
        <div
          className="h-2 w-full rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progresso para a próxima foto grátis"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#A855F7] to-[#EC4899] transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-700 dark:text-[#A1A1AA]">
          {remainder === 0 ? (
            credits === 0 ? (
              <>Faltam 10 créditos para sua primeira foto grátis.</>
            ) : (
              <>
                Você tem {photosAvailable}{' '}
                {photosAvailable === 1 ? 'foto grátis' : 'fotos grátis'} — indique mais
                para acumular.
              </>
            )
          ) : (
            <>
              Faltam {missingToNext} créditos para sua próxima foto grátis.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
