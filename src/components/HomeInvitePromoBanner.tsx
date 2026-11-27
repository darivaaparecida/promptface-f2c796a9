import { Link } from 'react-router-dom';
import { ArrowRight, Gift, Sparkles, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  INVITE_MILESTONE_REWARD_CREDITS,
  INVITE_REWARD_CREDITS,
  INVITE_SUBSCRIPTION_REWARD_CREDITS,
} from '../shared/invites';

/**
 * Banner promocional estilizado na página inicial incentivando convites
 * e destacando o ganho de créditos extras.
 */
export function HomeInvitePromoBanner() {
  const { user } = useAuth();

  return (
    <section
      aria-labelledby="home-invite-promo-heading"
      className="mx-auto max-w-6xl px-4 sm:px-6 py-12"
    >
      <div className="relative overflow-hidden rounded-3xl border border-violet-600/45 bg-gradient-to-br from-violet-100/90 via-white to-fuchsia-50/80 dark:border-[#8B5CF6]/45 dark:from-[#1B1330] dark:via-[#14141E] dark:to-[#221129] p-6 sm:p-10 shadow-xl shadow-violet-900/5 dark:shadow-[#7C3AED]/10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-600/35 bg-white/80 dark:border-[#A855F7]/35 dark:bg-[#0D0D14]/70 px-3.5 py-1 text-xs font-semibold text-violet-800 dark:text-[#DDD6FE]">
              <Gift className="w-3.5 h-3.5 text-violet-700 dark:text-[#A855F7]" aria-hidden="true" />
              <span>Indique amigos e gere mais fotos grátis</span>
            </div>

            <h2
              id="home-invite-promo-heading"
              className="font-display text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white text-balance"
            >
              Convide amigos e ganhe até{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#A855F7] to-[#EC4899]">
                {INVITE_REWARD_CREDITS + INVITE_MILESTONE_REWARD_CREDITS + INVITE_SUBSCRIPTION_REWARD_CREDITS}{' '}
                créditos extras
              </span>{' '}
              por indicação
            </h2>

            <p className="text-sm sm:text-base text-slate-700 dark:text-[#A1A1AA] max-w-2xl leading-relaxed">
              Compartilhe seu link pessoal de convite. Seu amigo começa com 1 foto grátis e você acumula créditos extras automaticamente para criar novos ensaios no PromptFace.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                to={user ? '/convites' : '/login?modo=cadastro'}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white shadow-lg shadow-[#7C3AED]/25 hover:brightness-110 transition-all"
              >
                <span>{user ? 'Pegar meu link de convite' : 'Criar conta e convidar'}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <Link
                to="/convites"
                className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl border border-slate-300 bg-white/90 text-xs font-semibold uppercase tracking-wider text-slate-900 hover:border-violet-600 dark:border-white/15 dark:bg-[#0D0D14]/80 dark:text-white dark:hover:border-[#8B5CF6] transition-colors"
              >
                <span>Ver regras do programa</span>
              </Link>
            </div>
          </div>

          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3">
            <div className="rounded-2xl border border-slate-300/80 bg-white/90 dark:border-white/10 dark:bg-[#0D0D14]/80 p-4 flex items-center gap-3.5">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-[#7C3AED]/25 dark:text-[#C4B5FD]">
                <Users className="w-5 h-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-mono-num text-sm font-bold text-slate-950 dark:text-white">
                  +{INVITE_REWARD_CREDITS} créditos
                </p>
                <p className="text-xs text-slate-600 dark:text-[#A1A1AA]">
                  Assim que seu amigo cria a conta pelo link
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-300/80 bg-white/90 dark:border-white/10 dark:bg-[#0D0D14]/80 p-4 flex items-center gap-3.5">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fuchsia-100 text-fuchsia-700 dark:bg-[#EC4899]/20 dark:text-[#F9A8D4]">
                <Sparkles className="w-5 h-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-mono-num text-sm font-bold text-slate-950 dark:text-white">
                  +{INVITE_MILESTONE_REWARD_CREDITS} créditos bônus para ambos
                </p>
                <p className="text-xs text-slate-600 dark:text-[#A1A1AA]">
                  Quando ele envia a 1ª foto de referência
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-300/80 bg-white/90 dark:border-white/10 dark:bg-[#0D0D14]/80 p-4 flex items-center gap-3.5">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                <Gift className="w-5 h-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-mono-num text-sm font-bold text-slate-950 dark:text-white">
                  +{INVITE_SUBSCRIPTION_REWARD_CREDITS} créditos extras
                </p>
                <p className="text-xs text-slate-600 dark:text-[#A1A1AA]">
                  Quando um indicado assinar o primeiro plano. Seu amigo ganha +10
                  créditos no 1º mês.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
