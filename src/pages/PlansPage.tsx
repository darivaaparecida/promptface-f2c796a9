import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Minus,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import {
  FAQ_ITEMS,
  INITIAL_PLANS,
  type BillingInterval,
  type PlanDefinition,
} from '../shared/catalog';
import { CREDIT_COSTS, INITIAL_SIGNUP_CREDITS } from '../shared/rules';
import {
  calculateMonthlyCreditNeeds,
  formatBrlCurrency,
  getPlanCyclePricing,
  getPlanUnitMetrics,
} from '../shared/plansCalculator';
import { useAuth } from '../context/AuthContext';
import { joinWaitlist } from '../lib/db';
import { ButtonSpinner } from '../components/ButtonSpinner';
import { PlanSavingsBadge } from '../components/PlanSavingsBadge';

interface ComparisonRow {
  label: string;
  freeTrial: string;
  essencial: string;
  pro: string;
  premium: string;
}

const BILLING_CYCLE_OPTIONS: Array<{
  id: BillingInterval;
  label: string;
  badge?: string;
}> = [
  { id: 'monthly', label: 'Mensal' },
  { id: 'quarterly', label: 'Trimestral', badge: '-20%' },
  { id: 'yearly', label: 'Anual', badge: '-33%' },
];

function parseInitialInterval(param: string | null): BillingInterval {
  if (param === 'mensal') return 'monthly';
  if (param === 'anual') return 'yearly';
  if (param === 'trimestral') return 'quarterly';
  return 'quarterly';
}

export function PlansPage() {
  const { user, config } = useAuth();
  const [searchParams] = useSearchParams();
  // Fase 1: o catálogo (planos) vem do código do site (src/shared/catalog.ts),
  // não mais do servidor — não há fetch de catálogo.
  const plans: PlanDefinition[] = INITIAL_PLANS;
  const [billingInterval, setBillingInterval] = useState<BillingInterval>(() =>
    parseInitialInterval(searchParams.get('ciclo'))
  );
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [waitlistEmail, setWaitlistEmail] = useState(user?.email || '');
  const [waitlistSubmitting, setWaitlistSubmitting] = useState(false);
  const [waitlistFeedback, setWaitlistFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [photosPerMonth, setPhotosPerMonth] = useState(18);
  const [studioActionsPerMonth, setStudioActionsPerMonth] = useState(6);
  const [promptEnhancementsPerMonth, setPromptEnhancementsPerMonth] = useState(10);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const waitlistInputRef = useRef<HTMLInputElement>(null);
  const waitlistSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (user?.email && !waitlistEmail) {
      setWaitlistEmail(user.email);
    }
  }, [user?.email, waitlistEmail]);

  const baselinePlan = plans.find((p) => p.id === 'essencial') ?? plans[0];
  const essencialPlan = plans.find((p) => p.id === 'essencial') ?? INITIAL_PLANS[0];
  const proPlan = plans.find((p) => p.id === 'pro') ?? INITIAL_PLANS[1];
  const premiumPlan = plans.find((p) => p.id === 'premium') ?? INITIAL_PLANS[2];

  const essencialCycle = getPlanCyclePricing(essencialPlan, billingInterval);
  const proCycle = getPlanCyclePricing(proPlan, billingInterval);
  const premiumCycle = getPlanCyclePricing(premiumPlan, billingInterval);

  const comparisonRows: ComparisonRow[] = [
    {
      label: 'Valor mensal equivalente',
      freeTrial: 'Grátis',
      essencial: `${essencialCycle.monthlyEquivalentFormatted}/mês`,
      pro: `${proCycle.monthlyEquivalentFormatted}/mês`,
      premium: `${premiumCycle.monthlyEquivalentFormatted}/mês`,
    },
    {
      label: 'Créditos mensais incluídos',
      freeTrial: `${INITIAL_SIGNUP_CREDITS} créditos (único)`,
      essencial: `${essencialPlan.creditsMonthly} créditos / mês`,
      pro: `${proPlan.creditsMonthly} créditos / mês`,
      premium: `${premiumPlan.creditsMonthly} créditos / mês`,
    },
    {
      label: 'Volume máximo de fotos',
      freeTrial: '1 foto grátis',
      essencial: `Até ${essencialPlan.maxPhotosMonthly} fotos / mês`,
      pro: `Até ${proPlan.maxPhotosMonthly} fotos / mês`,
      premium: `Até ${premiumPlan.maxPhotosMonthly} fotos / mês`,
    },
    {
      label: 'Custo efetivo por foto',
      freeTrial: 'Grátis no cadastro',
      essencial: `${essencialCycle.pricePerPhotoFormatted} por foto`,
      pro: `${proCycle.pricePerPhotoFormatted} por foto`,
      premium: `${premiumCycle.pricePerPhotoFormatted} por foto`,
    },
    {
      label: 'Bônus no 1º mês (Trimestral / Anual)',
      freeTrial: 'Não aplicável',
      essencial:
        essencialCycle.bonusCreditsFirstMonth > 0
          ? `+${essencialCycle.bonusCreditsFirstMonth} créditos extras`
          : 'Disponível no Trimestral/Anual',
      pro:
        proCycle.bonusCreditsFirstMonth > 0
          ? `+${proCycle.bonusCreditsFirstMonth} créditos extras`
          : 'Disponível no Trimestral/Anual',
      premium:
        premiumCycle.bonusCreditsFirstMonth > 0
          ? `+${premiumCycle.bonusCreditsFirstMonth} créditos extras`
          : 'Disponível no Trimestral/Anual',
    },
    {
      label: 'Biblioteca com 84 cenários',
      freeTrial: 'Incluído',
      essencial: 'Incluído',
      pro: 'Incluído',
      premium: 'Incluído',
    },
    {
      label: 'Criação livre por descrição',
      freeTrial: 'Incluído',
      essencial: 'Incluído',
      pro: 'Incluído',
      premium: 'Incluído',
    },
    {
      label: 'Variações a partir de fotos',
      freeTrial: '10 créditos cada',
      essencial: '10 créditos cada',
      pro: '10 créditos cada',
      premium: 'Incluído no volume mensal',
    },
    {
      label: 'PromptFace Studio (edições)',
      freeTrial: '10 créditos cada',
      essencial: '10 créditos cada',
      pro: '10 créditos cada',
      premium: 'Ferramentas avançadas',
    },
    {
      label: 'Perfil Visual privado (LGPD)',
      freeTrial: 'Incluído',
      essencial: 'Incluído',
      pro: 'Incluído',
      premium: 'Incluído',
    },
    {
      label: 'Acúmulo para o mês seguinte',
      freeTrial: 'Não aplicável',
      essencial: 'Renova todo mês (não acumula)',
      pro: 'Renova todo mês (não acumula)',
      premium: 'Renova todo mês (não acumula)',
    },
  ];

  const usageSummary = calculateMonthlyCreditNeeds({
    photosPerMonth,
    studioActionsPerMonth,
    promptEnhancementsPerMonth,
  });

  const scrollToWaitlist = (planName?: string) => {
    if (planName) {
      const cycleText =
        billingInterval === 'quarterly'
          ? 'Trimestral'
          : billingInterval === 'yearly'
          ? 'Anual'
          : 'Mensal';
      setStatusMsg(
        `As assinaturas recorrentes do plano ${planName} (${cycleText}) estão sendo finalizadas. Cadastre seu e-mail abaixo para ser avisado em primeira mão.`
      );
    }
    waitlistSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => {
      waitlistInputRef.current?.focus();
    }, 250);
  };

  const handleSubscribe = async (plan: PlanDefinition) => {
    setStatusMsg(null);
    if (!user) return;
    // Fase 1: checkout Stripe desativado — precisa de servidor e chega na
    // Fase 2 via Edge Function. Mesma mensagem que o servidor devolvia.
    setStatusMsg('Pagamentos em breve — estamos finalizando a ativação das assinaturas.');
  };

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = waitlistEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setWaitlistFeedback({
        type: 'error',
        text: 'Informe um e-mail válido para entrar na lista de espera.',
      });
      return;
    }

    setWaitlistSubmitting(true);
    setWaitlistFeedback(null);
    try {
      await joinWaitlist(email, 'payments');
      setWaitlistFeedback({
        type: 'success',
        text: 'Você entrou na lista de espera prioritária.',
      });
    } catch (err) {
      setWaitlistFeedback({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Não foi possível registrar este e-mail agora.',
      });
    } finally {
      setWaitlistSubmitting(false);
    }
  };

  const recommendedLabel =
    usageSummary.recommendedPlanId === 'free_trial'
      ? 'Teste Inicial Grátis'
      : usageSummary.recommendedPlanId === 'essencial'
      ? 'Plano Essencial'
      : usageSummary.recommendedPlanId === 'pro'
      ? 'Plano PRO'
      : 'Plano PREMIUM';

  const currentPlanLabel =
    user?.planId === 'premium'
      ? 'PREMIUM'
      : user?.planId === 'pro'
      ? 'PRO'
      : user?.planId === 'essencial'
      ? 'Essencial'
      : 'Teste Inicial';

  const recommendedPlanObj = plans.find((p) => p.id === usageSummary.recommendedPlanId);
  const recommendedCyclePricing = recommendedPlanObj
    ? getPlanCyclePricing(recommendedPlanObj, billingInterval)
    : null;

  return (
    <div className="relative overflow-x-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 w-[820px] h-[420px] rounded-full bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.1)_0%,rgba(168,85,247,0.03)_48%,transparent_72%)] dark:bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.2)_0%,rgba(168,85,247,0.06)_48%,transparent_72%)] blur-3xl pf-hero-glow"
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14 space-y-12">
        {/* Cabeçalho */}
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-medium text-violet-700 dark:text-[#A855F7]">
              Planos em reais (BRL) · A partir de {formatBrlCurrency(getPlanCyclePricing(essencialPlan, 'yearly').monthlyEquivalentBrl)}/mês no Anual
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.65rem] font-bold tracking-tight leading-[1.12] text-slate-950 dark:text-white text-balance">
              Escolha o plano e o ciclo ideal para as suas fotografias
            </h1>
            <p className="text-sm sm:text-base text-slate-700 dark:text-[#A1A1AA] leading-relaxed">
              Comece com {INITIAL_SIGNUP_CREDITS} créditos grátis (1 foto gratuita) ao criar sua conta. Depois, economize até 33% nos planos Trimestral e Anual com liberação mensal de créditos e bônus no 1º mês.
            </p>
          </div>

          {user ? (
            <div className="rounded-2xl border border-slate-300 dark:border-white/10 pf-card-surface px-5 py-4 flex flex-wrap items-center gap-5 shrink-0">
              <div>
                <p className="text-xs text-slate-600 dark:text-[#A1A1AA]">Sua conta agora</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-950 dark:text-white">
                  {currentPlanLabel} ·{' '}
                  <span className="font-mono-num text-violet-700 dark:text-[#A855F7]">
                    {user.credits} créditos disponíveis
                  </span>
                </p>
              </div>
              <Link
                to="/meu-espaco?tab=assinatura"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 bg-slate-100 text-xs font-medium text-slate-950 hover:border-violet-700 dark:border-white/15 dark:bg-[#08080C] dark:text-white dark:hover:border-[#8B5CF6] transition-colors whitespace-nowrap shrink-0"
              >
                <span>Gerenciar assinatura</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <div className="flex items-start sm:items-center gap-2.5 text-xs text-slate-700 dark:text-[#A1A1AA] shrink-0">
              <ShieldCheck className="w-4 h-4 text-violet-700 dark:text-[#8B5CF6] shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
              <span>Referências privadas por padrão · Créditos renovados todo mês</span>
            </div>
          )}
        </header>

        {statusMsg && (
          <div
            role="status"
            className="rounded-xl border border-violet-600/50 bg-violet-50 text-slate-950 dark:border-[#7C3AED]/50 dark:bg-[#17171F] px-5 py-4 text-sm dark:text-white flex items-center justify-between gap-4"
          >
            <span>{statusMsg}</span>
            <button
              type="button"
              onClick={() => setStatusMsg(null)}
              className="text-xs font-medium text-slate-700 hover:text-slate-950 dark:text-[#A1A1AA] dark:hover:text-white whitespace-nowrap shrink-0"
            >
              Fechar
            </button>
          </div>
        )}

        {/* Seletor de ciclo: Mensal | Trimestral (-20%) | Anual (-33%) */}
        <section aria-label="Ciclo de cobrança" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div
            role="group"
            aria-label="Selecione o ciclo de pagamento"
            className="grid grid-cols-3 sm:inline-flex items-center gap-1 p-1.5 rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] shadow-sm dark:shadow-none w-full sm:w-fit"
          >
            {BILLING_CYCLE_OPTIONS.map((opt) => {
              const active = billingInterval === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setBillingInterval(opt.id)}
                  className={`inline-flex items-center justify-center gap-1.5 px-2.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                    active
                      ? 'bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white shadow-md shadow-[#7C3AED]/20'
                      : 'text-slate-700 hover:text-slate-950 hover:bg-slate-100 dark:text-[#A1A1AA] dark:hover:text-white dark:hover:bg-white/5'
                  }`}
                >
                  <span>{opt.label}</span>
                  {opt.badge && (
                    <span
                      className={`px-1.5 sm:px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] font-mono-num font-bold ${
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-violet-100 text-violet-800 dark:bg-[#7C3AED]/25 dark:text-[#C4B5FD]'
                      }`}
                    >
                      {opt.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <PlanSavingsBadge
              cyclePricing={premiumCycle}
              variant="cycle"
              testId="plans-cycle-savings-badge"
            />
            <p className="text-xs sm:text-sm text-slate-700 dark:text-[#A1A1AA]">
              {billingInterval === 'yearly'
                ? '+ 50 créditos bônus no 1º mês em todos os planos.'
                : billingInterval === 'quarterly'
                ? '+ 20 créditos bônus no 1º mês em todos os planos.'
                : 'Mensal: cobrança recorrente mês a mês sem fidelidade.'}
            </p>
          </div>
        </section>

        {/* Grade de planos pagos: Essencial + PRO + PREMIUM */}
        <section aria-label="Planos disponíveis" className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          {plans.map((plan) => {
            const cyclePricing = getPlanCyclePricing(plan, billingInterval);
            const metrics = getPlanUnitMetrics(plan, baselinePlan, billingInterval);
            const isCurrentPlan =
              user?.planId === plan.id &&
              user?.subscriptionStatus === 'active' &&
              (user?.billingInterval || 'monthly') === billingInterval;
            const isHighlighted = Boolean(plan.highlighted);

            return (
              <article
                key={plan.id}
                data-testid={`plan-card-${plan.id}`}
                className={`rounded-2xl p-6 sm:p-7 flex flex-col justify-between border transition-colors ${
                  isHighlighted
                    ? 'border-violet-700 bg-gradient-to-b from-violet-50 via-white to-white dark:border-[#7C3AED] dark:from-[#201833] dark:via-[#17171F] dark:to-[#17171F] shadow-xl shadow-[#7C3AED]/15'
                    : 'border-slate-300 dark:border-white/10 pf-card-surface'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-xl font-bold text-slate-950 dark:text-white">{plan.name}</h2>
                    <span
                      className={`text-xs font-medium ${
                        isHighlighted ? 'text-pink-700 dark:text-[#EC4899]' : 'text-slate-600 dark:text-[#A1A1AA]'
                      }`}
                    >
                      {isHighlighted ? 'Melhor custo por foto' : plan.audience}
                    </span>
                  </div>

                  <div className="mt-5 flex items-baseline gap-2 flex-wrap">
                    <span
                      data-testid={`plan-price-${plan.id}`}
                      className="font-display text-4xl font-bold text-slate-950 dark:text-white font-mono-num"
                    >
                      {cyclePricing.monthlyEquivalentFormatted}
                    </span>
                    <span className="text-sm text-slate-700 dark:text-[#A1A1AA]">/ mês</span>
                    {billingInterval !== 'monthly' && (
                      <span className="text-xs text-slate-500 dark:text-[#71717A] line-through font-mono-num">
                        {plan.priceFormatted}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-xs text-slate-700 dark:text-[#A1A1AA] font-mono-num">
                    {cyclePricing.billingCycleDescription}
                  </p>

                  <PlanSavingsBadge
                    cyclePricing={cyclePricing}
                    testId={`plan-savings-badge-${plan.id}`}
                    className="mt-3"
                  />

                  <p className="mt-3 text-xs font-medium text-violet-700 dark:text-[#A855F7] font-mono-num">
                    {plan.creditsMonthly} créditos/mês
                    {cyclePricing.bonusCreditsFirstMonth > 0
                      ? ` (+${cyclePricing.bonusCreditsFirstMonth} bônus no 1º mês)`
                      : ''}
                    {' · '}
                    {metrics.pricePerPhotoFormatted} por foto
                    {metrics.savingsVsBasePercent > 0
                      ? ` · ${metrics.savingsVsBasePercent}% mais econômico`
                      : ''}
                  </p>

                  <p className="mt-3 text-sm text-slate-700 dark:text-[#A1A1AA] leading-relaxed">{plan.description}</p>

                  <ul className="mt-6 space-y-2.5">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-slate-800 dark:text-white/90">
                        <Check
                          className={`w-4 h-4 shrink-0 mt-0.5 ${
                            isHighlighted ? 'text-pink-700 dark:text-[#EC4899]' : 'text-violet-700 dark:text-[#8B5CF6]'
                          }`}
                          aria-hidden="true"
                        />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8">
                  {!user ? (
                    <Link
                      to="/login?modo=cadastro"
                      className={`block w-full text-center px-5 py-3.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
                        isHighlighted
                          ? 'text-white bg-gradient-to-r from-[#A855F7] to-[#EC4899] hover:brightness-110 shadow-lg shadow-[#7C3AED]/25'
                          : 'border border-violet-700 text-violet-950 hover:bg-violet-100 dark:border-[#7C3AED] dark:text-white dark:hover:bg-[#7C3AED]/15'
                      }`}
                    >
                      Começar com 1ª foto grátis
                    </Link>
                  ) : isCurrentPlan ? (
                    <Link
                      to="/meu-espaco?tab=assinatura"
                      className="block w-full text-center px-5 py-3.5 rounded-xl border border-emerald-600/45 bg-emerald-50 text-xs font-semibold uppercase tracking-wider text-emerald-950 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-950/25 dark:text-emerald-200 dark:hover:bg-emerald-900/35 transition-colors whitespace-nowrap"
                    >
                      Seu plano atual · Gerenciar
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled={loadingPlan === plan.id}
                      onClick={() => void handleSubscribe(plan)}
                      className={`w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all disabled:opacity-50 whitespace-nowrap ${
                        isHighlighted
                          ? 'text-white bg-gradient-to-r from-[#A855F7] to-[#EC4899] hover:brightness-110 shadow-lg shadow-[#7C3AED]/25'
                          : 'border border-violet-700 text-violet-950 hover:bg-violet-100 dark:border-[#7C3AED] dark:text-white dark:hover:bg-[#7C3AED]/15'
                      }`}
                    >
                      {loadingPlan === plan.id && <ButtonSpinner size="sm" />}
                      <span>
                        {loadingPlan === plan.id
                          ? 'Abrindo checkout...'
                          : config.stripeConfigured
                          ? `Assinar ${plan.name} ${cyclePricing.intervalLabel}`
                          : `Avisar sobre ${plan.name}`}
                      </span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </section>

        {/* Teste Inicial Grátis (10 créditos no cadastro) */}
        <section
          aria-label="Teste Inicial Grátis"
          className="rounded-2xl border border-slate-300 dark:border-white/10 pf-card-surface p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-6"
        >
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="font-display text-lg sm:text-xl font-bold text-slate-950 dark:text-white">
                Teste Inicial Grátis · R$ 0 no cadastro
              </h2>
              <span className="text-xs font-medium text-violet-700 dark:text-[#A855F7] font-mono-num">
                {INITIAL_SIGNUP_CREDITS} créditos grátis · 1 foto completa · Sem cartão
              </span>
            </div>
            <p className="text-sm text-slate-700 dark:text-[#A1A1AA] leading-relaxed">
              Envie suas fotos de referência com proteção LGPD, monte seu Perfil Visual e teste qualquer um dos 84 cenários antes de escolher um plano mensal, trimestral ou anual.
            </p>
          </div>

          <div className="shrink-0">
            {user ? (
              <Link
                to="/criar"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-slate-300 bg-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-950 hover:border-violet-700 dark:border-white/15 dark:bg-[#08080C] dark:text-white dark:hover:border-[#8B5CF6] transition-colors whitespace-nowrap"
              >
                <span>Criar fotografia agora</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            ) : (
              <Link
                to="/login?modo=cadastro"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-slate-300 bg-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-950 hover:border-violet-700 dark:border-white/15 dark:bg-[#08080C] dark:text-white dark:hover:border-[#8B5CF6] transition-colors whitespace-nowrap"
              >
                <span>Testar grátis agora</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            )}
          </div>
        </section>

        {/* Simulador / Calculadora interativa de créditos mensais */}
        <section
          aria-labelledby="simulador-creditos-titulo"
          className="rounded-2xl border border-slate-300 dark:border-white/10 pf-card-surface p-6 sm:p-8"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-5">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-medium text-violet-700 dark:text-[#A855F7]">
                  <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Simulador de consumo mensal</span>
                </div>
                <h2
                  id="simulador-creditos-titulo"
                  className="font-display text-xl sm:text-2xl font-bold text-slate-950 dark:text-white"
                >
                  Calcule de quantos créditos você precisa por mês
                </h2>
                <p className="text-sm text-slate-700 dark:text-[#A1A1AA]">
                  Ajuste a quantidade estimada de criações e edições para descobrir o plano mais econômico.
                </p>
              </div>

              <div className="space-y-4">
                <UsageCounterRow
                  label="Novas fotografias por mês"
                  costHint={`${CREDIT_COSTS.generate} créditos por foto`}
                  value={photosPerMonth}
                  max={80}
                  step={1}
                  onChange={setPhotosPerMonth}
                />
                <UsageCounterRow
                  label="Variações e edições no Studio"
                  costHint={`${CREDIT_COSTS.studio_edit} créditos por operação`}
                  value={studioActionsPerMonth}
                  max={60}
                  step={1}
                  onChange={setStudioActionsPerMonth}
                />
                <UsageCounterRow
                  label="Melhorias de descrição com IA"
                  costHint={`${CREDIT_COSTS.enhance_prompt} crédito por melhoria`}
                  value={promptEnhancementsPerMonth}
                  max={100}
                  step={5}
                  onChange={setPromptEnhancementsPerMonth}
                />
              </div>
            </div>

            <div className="lg:col-span-5 rounded-2xl border border-violet-600/40 bg-slate-100 dark:border-[#7C3AED]/40 dark:bg-[#08080C] p-6 space-y-5">
              <div>
                <p className="text-xs text-slate-700 dark:text-[#A1A1AA]">Consumo mensal estimado</p>
                <p
                  data-testid="calculator-total-credits"
                  className="mt-1 font-display text-3xl sm:text-4xl font-bold text-slate-950 dark:text-white font-mono-num"
                >
                  {usageSummary.totalCredits} créditos
                </p>
                <p className="mt-1 text-xs text-slate-700 dark:text-[#A1A1AA] font-mono-num">
                  {usageSummary.generationCredits} fotos · {usageSummary.studioCredits} Studio/variações ·{' '}
                  {usageSummary.enhanceCredits} descrições
                </p>
              </div>

              <div className="pt-4 border-t border-slate-300 dark:border-white/10 space-y-2">
                <p className="text-xs text-slate-700 dark:text-[#A1A1AA]">Plano recomendado para este ritmo</p>
                <p
                  data-testid="calculator-recommended-plan"
                  className="font-display text-xl font-bold text-violet-800 dark:text-[#A855F7]"
                >
                  {recommendedLabel}
                </p>
                <p className="text-xs text-slate-700 dark:text-[#A1A1AA] leading-relaxed">
                  {usageSummary.exceedsPremiumLimit
                    ? 'Seu volume supera os 600 créditos do ciclo Premium mensal. Para uso contínuo acima disso, recomenda-se iniciar pelo Premium e acompanhar o saldo em Meu Espaço.'
                    : usageSummary.recommendedPlanId === 'free_trial'
                    ? 'Os 10 créditos gratuitos do cadastro já cobrem esse teste inicial sem custo.'
                    : recommendedPlanObj && recommendedCyclePricing
                    ? `O plano ${recommendedPlanObj.name} entrega ${recommendedPlanObj.creditsMonthly} créditos mensais por ${recommendedCyclePricing.monthlyEquivalentFormatted}/mês no ciclo ${recommendedCyclePricing.intervalLabel} (${recommendedCyclePricing.pricePerPhotoFormatted} por foto).`
                    : ''}
                </p>
              </div>

              {usageSummary.recommendedPlanId === 'free_trial' ? (
                <Link
                  to={user ? '/criar' : '/login?modo=cadastro'}
                  className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white hover:brightness-110 transition-all whitespace-nowrap"
                >
                  <span>{user ? 'Ir para criação' : 'Começar teste grátis'}</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              ) : (
                <button
                  type="button"
                  disabled={loadingPlan === usageSummary.recommendedPlanId}
                  onClick={() => {
                    const targetPlan =
                      plans.find((p) => p.id === usageSummary.recommendedPlanId) ?? proPlan;
                    if (user && targetPlan) {
                      void handleSubscribe(targetPlan);
                    } else if (!user) {
                      scrollToWaitlist(targetPlan?.name);
                    }
                  }}
                  className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white hover:brightness-110 disabled:opacity-60 transition-all whitespace-nowrap"
                >
                  {loadingPlan === usageSummary.recommendedPlanId ? (
                    <>
                      <ButtonSpinner size="sm" />
                      <span>Abrindo checkout...</span>
                    </>
                  ) : (
                    <>
                      <span>
                        {user && config.stripeConfigured
                          ? `Assinar ${recommendedLabel}`
                          : `Quero o ${recommendedLabel}`}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Tabela comparativa completa */}
        <section aria-labelledby="comparativo-planos-titulo" className="space-y-4">
          <div className="space-y-1">
            <h2
              id="comparativo-planos-titulo"
              className="font-display text-xl sm:text-2xl font-bold text-slate-950 dark:text-white"
            >
              Comparativo completo entre planos ({essencialCycle.intervalLabel})
            </h2>
            <p className="text-sm text-slate-700 dark:text-[#A1A1AA]">
              Todos os recursos incluídos no Teste Inicial, Essencial, PRO e PREMIUM em uma visão única.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-300 dark:border-white/10 pf-card-surface">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-300 dark:border-white/10 text-xs uppercase tracking-wider text-slate-700 dark:text-[#A1A1AA]">
                  <th className="py-4 px-5 font-medium">Recurso</th>
                  <th className="py-4 px-5 font-medium">Teste Inicial</th>
                  <th className="py-4 px-5 font-medium">
                    Essencial · {essencialCycle.monthlyEquivalentFormatted}
                  </th>
                  <th className="py-4 px-5 font-medium">
                    PRO · {proCycle.monthlyEquivalentFormatted}
                  </th>
                  <th className="py-4 px-5 font-medium text-violet-700 dark:text-[#A855F7]">
                    PREMIUM · {premiumCycle.monthlyEquivalentFormatted}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/10 text-sm">
                {comparisonRows.map((row) => (
                  <tr key={row.label} className="hover:bg-slate-100/70 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-5 font-medium text-slate-950 dark:text-white">{row.label}</td>
                    <td className="py-3.5 px-5 text-slate-700 dark:text-[#A1A1AA] font-mono-num">{row.freeTrial}</td>
                    <td className="py-3.5 px-5 text-slate-900 dark:text-white/90 font-mono-num">{row.essencial}</td>
                    <td className="py-3.5 px-5 text-slate-900 dark:text-white/90 font-mono-num">{row.pro}</td>
                    <td className="py-3.5 px-5 text-slate-950 dark:text-white font-medium font-mono-num">
                      {row.premium}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Custo transparente por operação */}
        <section className="rounded-2xl border border-slate-300 dark:border-white/10 pf-card-surface p-6 sm:p-8 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-950 dark:text-white">
                Custo transparente por operação
              </h2>
              <p className="mt-1 text-sm text-slate-700 dark:text-[#A1A1AA]">
                Se uma geração ou edição falhar no processamento, os créditos reservados voltam automaticamente para o seu saldo.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: 'Gerar foto',
                cost: `${CREDIT_COSTS.generate} créditos`,
                detail: '84 cenários ou criação livre',
              },
              {
                label: 'Criar variação',
                cost: `${CREDIT_COSTS.variation} créditos`,
                detail: 'Nova versão a partir de foto pronta',
              },
              {
                label: 'Editar no Studio',
                cost: `${CREDIT_COSTS.studio_edit} créditos`,
                detail: 'Ajuste roupa, cenário ou luz',
              },
              {
                label: 'Melhorar descrição',
                cost: `${CREDIT_COSTS.enhance_prompt} crédito`,
                detail: 'Refina seu texto antes de gerar',
              },
            ].map((op) => (
              <div
                key={op.label}
                className="rounded-xl border border-slate-300 bg-slate-100 dark:border-white/10 dark:bg-[#08080C] p-4 space-y-1"
              >
                <p className="text-xs text-slate-700 dark:text-[#A1A1AA]">{op.label}</p>
                <p className="font-display text-lg font-bold text-slate-950 dark:text-white font-mono-num">
                  {op.cost}
                </p>
                <p className="text-xs text-slate-700 dark:text-[#A1A1AA]">{op.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Perguntas frequentes sobre planos e créditos */}
        <section aria-labelledby="faq-planos-titulo" className="space-y-4">
          <div className="space-y-1">
            <h2
              id="faq-planos-titulo"
              className="font-display text-xl sm:text-2xl font-bold text-slate-950 dark:text-white"
            >
              Dúvidas sobre planos, créditos e cancelamento
            </h2>
            <p className="text-sm text-slate-700 dark:text-[#A1A1AA]">
              Respostas diretas sobre cobrança em reais, renovação mensal e privacidade das suas fotos.
            </p>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-white/10 rounded-2xl border border-slate-300 dark:border-white/10 pf-card-surface overflow-hidden">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={item.q}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full px-6 py-4 flex items-center justify-between gap-4 text-left hover:bg-slate-100/70 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <span className="font-display text-sm sm:text-base font-semibold text-slate-950 dark:text-white">
                      {item.q}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-600 dark:text-[#A1A1AA] shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-violet-700 dark:text-[#A855F7]' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-5 text-sm text-slate-700 dark:text-[#A1A1AA] leading-relaxed">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Lista de espera quando pagamentos recorrentes ainda não estão ativos */}
        {!config.stripeConfigured && (
          <section
            ref={waitlistSectionRef}
            aria-labelledby="lista-espera-pagamentos"
            className="rounded-2xl border border-violet-600/45 dark:border-[#7C3AED]/45 pf-card-surface p-6 sm:p-8 space-y-4"
          >
            <div className="max-w-2xl space-y-1.5">
              <h2
                id="lista-espera-pagamentos"
                className="font-display text-xl font-bold text-slate-950 dark:text-white"
              >
                Pagamentos recorrentes em breve (Cartão e Pix Automático)
              </h2>
              <p className="text-sm text-slate-700 dark:text-[#A1A1AA]">
                Entre na lista de espera prioritária para receber o aviso assim que as assinaturas em reais (BRL) forem liberadas.
              </p>
            </div>

            <form
              onSubmit={(e) => void handleWaitlist(e)}
              noValidate
              className="flex flex-col sm:flex-row gap-3 max-w-lg"
            >
              <label htmlFor="plans-waitlist-email" className="sr-only">
                Seu e-mail para lista de espera
              </label>
              <input
                ref={waitlistInputRef}
                id="plans-waitlist-email"
                type="email"
                required
                value={waitlistEmail}
                onChange={(e) => setWaitlistEmail(e.target.value)}
                placeholder="seu@email.com"
                className="flex-1 px-4 py-3 rounded-xl bg-white border border-slate-300 text-sm text-slate-950 placeholder:text-slate-500 dark:bg-[#08080C] dark:border-white/15 dark:text-white dark:placeholder:text-[#71717A] focus:outline-none focus:border-[#8B5CF6]"
              />
              <button
                type="submit"
                disabled={waitlistSubmitting}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white hover:brightness-110 disabled:opacity-50 transition-all whitespace-nowrap shrink-0"
              >
                {waitlistSubmitting && <ButtonSpinner size="sm" />}
                <span>{waitlistSubmitting ? 'Enviando...' : 'Entrar na lista'}</span>
              </button>
            </form>

            {waitlistFeedback && (
              <p
                role="status"
                className={`text-xs font-medium ${
                  waitlistFeedback.type === 'success'
                    ? 'text-emerald-800 dark:text-emerald-300'
                    : 'text-rose-800 dark:text-rose-300'
                }`}
              >
                {waitlistFeedback.text}
              </p>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function UsageCounterRow({
  label,
  costHint,
  value,
  max,
  step,
  onChange,
}: {
  label: string;
  costHint: string;
  value: number;
  max: number;
  step: number;
  onChange: (nextValue: number) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-300 bg-slate-100 dark:border-white/10 dark:bg-[#08080C] px-4 py-3.5 flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-slate-950 dark:text-white">{label}</p>
        <p className="text-xs text-slate-700 dark:text-[#A1A1AA] font-mono-num">{costHint}</p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`Diminuir ${label}`}
          onClick={() => onChange(Math.max(0, value - step))}
          className="w-10 h-10 rounded-lg border border-slate-300 bg-white flex items-center justify-center text-slate-950 hover:border-violet-700 dark:border-white/15 dark:bg-[#17171F] dark:text-white dark:hover:border-[#8B5CF6] transition-colors"
        >
          <Minus className="w-4 h-4" aria-hidden="true" />
        </button>

        <span className="w-12 text-center font-display text-base font-bold text-slate-950 dark:text-white font-mono-num">
          {value}
        </span>

        <button
          type="button"
          aria-label={`Aumentar ${label}`}
          onClick={() => onChange(Math.min(max, value + step))}
          className="w-10 h-10 rounded-lg border border-slate-300 bg-white flex items-center justify-center text-slate-950 hover:border-violet-700 dark:border-white/15 dark:bg-[#17171F] dark:text-white dark:hover:border-[#8B5CF6] transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
