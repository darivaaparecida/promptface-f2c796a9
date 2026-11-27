import { useState } from 'react';
import { Check, CheckCircle2, Clock, Copy, Gift, MessageCircle, Share2, UserPlus, Users } from 'lucide-react';
import { useToast } from '../context/ToastContext';

type InviteStatus = 'entrou' | 'pendente';

interface InvitedFriendExample {
  id: string;
  name: string;
  date: string;
  status: InviteStatus;
}

// TODO(invite): ligar ao Supabase
const MOCK_INVITE_LINK = 'https://www.promptface.com.br/convite/EXEMPLO123';

// TODO(invite): ligar ao Supabase
const MOCK_SHARE_MESSAGE =
  `Estou criando fotos profissionais com IA no PromptFace! Entre pelo meu link de convite e crie sua conta: ${MOCK_INVITE_LINK}`;

// TODO(invite): ligar ao Supabase
const MOCK_INVITE_SUMMARY = [
  {
    id: 'sent',
    label: 'Convites enviados',
    value: 12,
    helper: 'Links compartilhados por você',
    icon: Share2,
  },
  {
    id: 'joined',
    label: 'Amigos que entraram',
    value: 5,
    helper: 'Contas criadas pelo seu link',
    icon: Users,
  },
  {
    id: 'credits',
    label: 'Créditos ganhos com convites',
    value: 50,
    helper: 'Bônus acumulado nas indicações',
    icon: Gift,
  },
] as const;

// TODO(invite): ligar ao Supabase
const MOCK_INVITED_FRIENDS: InvitedFriendExample[] = [
  {
    id: 'friend-1',
    name: 'Mariana Oliveira',
    date: '24/11/2026',
    status: 'entrou',
  },
  {
    id: 'friend-2',
    name: 'Lucas Ferreira',
    date: '25/11/2026',
    status: 'entrou',
  },
  {
    id: 'friend-3',
    name: 'Camila Santos',
    date: '26/11/2026',
    status: 'pendente',
  },
];

export function InvitePage() {
  const { addToast } = useToast();
  const [copied, setCopied] = useState(false);

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(MOCK_SHARE_MESSAGE)}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(MOCK_INVITE_LINK);
      setCopied(true);
      addToast({
        variant: 'success',
        title: 'Link copiado',
        description: 'Seu link de convite de exemplo foi copiado para a área de transferência.',
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      addToast({
        variant: 'info',
        title: 'Copie manualmente',
        description: MOCK_INVITE_LINK,
      });
    }
  };

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
          Cada amigo que criar a conta pelo seu link rende créditos para você.
        </p>
      </header>

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
              {MOCK_INVITE_LINK}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <button
              type="button"
              onClick={handleCopyLink}
              className="min-h-[46px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white shadow-lg shadow-[#7C3AED]/25 hover:brightness-110 transition-all whitespace-nowrap shrink-0"
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
          </div>
        </div>
      </section>

      {/* Three summary cards */}
      <section aria-label="Resumo dos convites">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {MOCK_INVITE_SUMMARY.map((item) => {
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
            {MOCK_INVITED_FRIENDS.length} registros
          </span>
        </div>

        <ul className="divide-y divide-slate-200 dark:divide-white/10">
          {MOCK_INVITED_FRIENDS.map((friend) => {
            const isJoined = friend.status === 'entrou';
            return (
              <li
                key={friend.id}
                className="px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors"
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
      </section>
    </div>
  );
}
