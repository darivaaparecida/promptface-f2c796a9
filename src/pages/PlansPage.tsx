import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Minus,
  Plus,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { FAQ_ITEMS, INITIAL_PLANS, type PlanDefinition } from '../shared/catalog';
import { CREDIT_COSTS, INITIAL_SIGNUP_CREDITS } from '../shared/rules';
import {
  calculateMonthlyCreditNeeds,
  getPlanUnitMetrics,
} from '../shared/plansCalculator';
import { useAuth } from '../context/AuthContext';

interface ComparisonRow {
  label: string;
  freeTrial: string;
  pro: string;
  premium: string;
}

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    label: 'Créditos incluídos',
    freeTrial: `${INITIAL_SIGNUP_CREDITS} créditos (único)`,
    pro: '200 créditos / mês',
    premium: '600 créditos / mês',
  },
  {
    label: 'Volume máximo de fotos',
    freeTrial: '1 foto grátis',
    pro: 'Até 20 fotos / mês',
    premium: 'Até 60 fotos / mês',
  },
  {
    label: 'Custo efetivo por foto',
    freeTrial: 'Grátis no cadastro',
    pro: 'R$ 2,50 por foto',
    premium: 'R$ 1,67 por foto',
  },
  {
    label: 'Biblioteca com 84 cenários',
    freeTrial: 'Incluído',
    pro: 'Incluído',
    premium: 'Incluído',
  },
  {
    label: 'Criação livre por descrição',
    freeTrial: 'Incluído',
    pro: 'Incluído',
    premium: 'Incluído',
  },
  {
    label: 'Variações a partir de fotos',
    freeTrial: '10 créditos cada',
    pro: '10 créditos cada',
    premium: 'Incluído no volume mensal',
  },
  {
    label: 'PromptFace Studio (edições)',
    freeTrial: '10 créditos cada',
    pro: '10 créditos cada',
    premium: 'Ferramentas avançadas',
  },
  {
    label: 'Perfil Visual privado (LGPD)',
    freeTrial: 'Incluído',
    pro: 'Incluído',
    premium: 'Incluído',
  },
  {
    label: 'Exportação Original, 4:5, 9:16 e 1:1',
    freeTrial: 'Incluído',
    pro: 'Incluído',
    premium: 'Incluído',
  },
  {
    label: 'Acúmulo para o mês seguinte',
    freeTrial: 'Não aplicável',
    pro: 'Não acumula',
    premium: 'Não acumula',
  },
];

export function PlansPage() {
  const { user, config, apiFetch } = useAuth();
  const [plans, setPlans] = useState<PlanDefinition[]>(INITIAL_PLANS);
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

  useEffect(() => {
    fetch('/api/catalog')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.plans)) setPlans(data.plans);
      })
      .catch(() => {});
  }, []);

  const baselinePro = plans.find((p) => p.id === 'pro') ?? plans[0];
  const usageSummary = calculateMonthlyCreditNeeds({
    photosPerMonth,
    studioActionsPerMonth,
    promptEnhancementsPerMonth,
  });

  const scrollToWaitlist = (planName?: string) => {
    if (planName) {
      setStatusMsg(
        `As assinaturas recorrentes do plano ${planName} estão sendo finalizadas. Cadastre seu e-mail abaixo para ser avisado em primeira mão.`
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
    if (!config.stripeConfigured) {
      scrollToWaitlist(plan.name);
      return;
    }

    setLoadingPlan(plan.id);
    try {
      const res = await apiFetch('/api/checkout', {
        method: 'POST',
        body: JSON.stringify({ planId: plan.id }),
      });
      const data = (await res.json()) as {
        url?: string;
        notConfigured?: boolean;
        error?: string;
      };
      if (data.url) {
        window.location.assign(data.url);
        return;
      }
      setStatusMsg(
        data.error || 'Pagamentos em breve — entre na lista de espera para ser avisado.'
      );
    } catch {
      setStatusMsg('Não foi possível iniciar o checkout agora. Tente novamente em instantes.');
    } finally {
      setLoadingPlan(null);
    }
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
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, feature: 'payments' }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (res.ok) {
        setWaitlistFeedback({
          type: 'success',
          text: data.message || 'E-mail confirmado na lista de espera prioritária.',
        });
      } else {
        setWaitlistFeedback({
          type: 'error',
          text: data.error || 'Não foi possível registrar este e-mail agora.',
        });
      }
    } catch {
      setWaitlistFeedback({
        type: 'error',
        text: 'Erro de conexão ao registrar na lista de espera.',
      });
    } finally {
      setWaitlistSubmitting(false);
    }
  };

  const recommendedLabel =
    usageSummary.recommendedPlanId === 'free_trial'
      ? 'Teste Inicial Grátis'
      : usageSummary.recommendedPlanId === 'pro'
      ? 'Plano PRO'
      : 'Plano PREMIUM';

  const currentPlanLabel =
    user?.planId === 'premium'
      ? 'PREMIUM'
      : user?.planId === 'pro'
      ? 'PRO'
      : 'Teste Inicial';

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
              Planos em reais (BRL) · Créditos mensais sem fidelidade
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.65rem] font-bold tracking-tight leading-[1.12] text-slate-950 dark:text-white text-balance">
              Escolha o volume ideal para as suas fotografias
            </h1>
            <p className="text-sm sm:text-base text-slate-700 dark:text-[#A1A1AA] leading-relaxed">
              Comece com {INITIAL_SIGNUP_CREDITS} créditos grátis (1 foto gratuita) ao criar sua conta. Depois, assine o plano compatível com a sua frequência de criação.
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
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700 dark:text-[#A1A1AA] shrink-0">
              <ShieldCheck className="w-4 h-4 text-violet-700 dark:text-[#8B5CF6]" aria-hidden="true" />
              <span>Referências privadas por padrão · Cancele quando quiser</span>
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

        {/* Grade de planos: Teste Inicial + PRO + PREMIUM */}
        <section aria-label="Planos disponíveis" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Card 1: Teste Inicial Grátis */}
          <article className="lg:col-span-4 rounded-2xl border border-slate-300 dark:border-white/10 pf-card-surface p-6 sm:p-7 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-xl font-bold text-slate-950 dark:text-white">Teste Inicial</h2>
                <span className="text-xs text-slate-600 dark:text-[#A1A1AA]">Sem cartão</span>
              </div>

              <div className="mt-5 flex items-baseline gap-2">
                <span className="font-display text-4xl font-bold text-slate-950 dark:text-white font-mono-num">
                  R$ 0
                </span>
                <span className="text-sm text-slate-700 dark:text-[#A1A1AA]">no cadastro</span>
              </div>

              <p className="mt-1.5 text-xs font-medium text-violet-700 dark:text-[#8B5CF6] font-mono-num">
                {INITIAL_SIGNUP_CREDITS} créditos grátis · 1 foto completa
              </p>

              <p className="mt-3 text-sm text-slate-700 dark:text-[#A1A1AA] leading-relaxed">
                Ideal para enviar suas fotos de referência, montar seu Perfil Visual e validar a qualidade realista antes de assinar.
              </p>

              <ul className="mt-6 space-y-2.5">
                {[
                  '10 créditos únicos ao criar a conta',
                  'Acesso para testar qualquer um dos 84 cenários',
                  'Download em alta resolução sem marca d’água visível',
                  'Referências faciais protegidas por LGPD',
                ].map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-800 dark:text-white/90">
                    <Check className="w-4 h-4 text-violet-700 dark:text-[#8B5CF6] shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8">
              {user ? (
                <Link
                  to="/criar"
                  className="inline-flex items-center justify-center gap-2 w-full px-5 py-3.5 rounded-xl border border-slate-300 bg-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-950 hover:border-violet-700 dark:border-white/15 dark:bg-[#08080C] dark:text-white dark:hover:border-[#8B5CF6] transition-colors whitespace-nowrap"
                >
                  <span>Criar fotografia agora</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              ) : (
                <Link
                  to="/login?modo=cadastro"
                  className="inline-flex items-center justify-center gap-2 w-full px-5 py-3.5 rounded-xl border border-slate-300 bg-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-950 hover:border-violet-700 dark:border-white/15 dark:bg-[#08080C] dark:text-white dark:hover:border-[#8B5CF6] transition-colors whitespace-nowrap"
                >
                  <span>Testar grátis agora</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </Link>
              )}
            </div>
          </article>

          {/* Cards 2 e 3: PRO e PREMIUM */}
          {plans.map((plan) => {
            const metrics = getPlanUnitMetrics(plan, baselinePro);
            const isCurrentPlan = user?.planId === plan.id && user?.subscriptionStatus === 'active';
            const isHighlighted = Boolean(plan.highlighted);

            return (
              <article
                key={plan.id}
                className={`lg:col-span-4 rounded-2xl p-6 sm:p-7 flex flex-col justify-between border transition-colors ${
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

                  <div className="mt-5 flex items-baseline gap-2">
                    <span className="font-display text-4xl font-bold text-slate-950 dark:text-white font-mono-num">
                      {plan.priceFormatted}
                    </span>
                    <span className="text-sm text-slate-700 dark:text-[#A1A1AA]">/ mês</span>
                  </div>

                  <p className="mt-1.5 text-xs font-medium text-violet-700 dark:text-[#A855F7] font-mono-num">
                    {plan.creditsMonthly} créditos/mês · {metrics.pricePerPhotoFormatted} por foto
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
                      className={`w-full px-5 py-3.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all disabled:opacity-50 whitespace-nowrap ${
                        isHighlighted
                          ? 'text-white bg-gradient-to-r from-[#A855F7] to-[#EC4899] hover:brightness-110 shadow-lg shadow-[#7C3AED]/25'
                          : 'border border-violet-700 text-violet-950 hover:bg-violet-100 dark:border-[#7C3AED] dark:text-white dark:hover:bg-[#7C3AED]/15'
                      }`}
                    >
                      {loadingPlan === plan.id
                        ? 'Abrindo checkout...'
                        : config.stripeConfigured
                        ? `Assinar ${plan.name}`
                        : `Avisar sobre ${plan.name}`}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
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
                    : usageSummary.recommendedPlanId === 'pro'
                    ? 'O plano PRO entrega 200 créditos mensais por R$ 49,90 (R$ 2,50 por foto), suficiente para esse ritmo.'
                    : 'O plano PREMIUM entrega 600 créditos mensais por R$ 99,90 (R$ 1,67 por foto) com 33% de economia por foto.'}
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
                  onClick={() => {
                    const targetPlan =
                      plans.find((p) => p.id === usageSummary.recommendedPlanId) ?? plans[1];
                    if (user && targetPlan) {
                      void handleSubscribe(targetPlan);
                    } else if (!user) {
                      scrollToWaitlist(targetPlan?.name);
                    }
                  }}
                  className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white hover:brightness-110 transition-all whitespace-nowrap"
                >
                  <span>
                    {user && config.stripeConfigured
                      ? `Assinar ${recommendedLabel}`
                      : `Quero o ${recommendedLabel}`}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
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
              Comparativo completo entre planos
            </h2>
            <p className="text-sm text-slate-700 dark:text-[#A1A1AA]">
              Todos os recursos incluídos no Teste Inicial, PRO e PREMIUM em uma visão única.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-300 dark:border-white/10 pf-card-surface">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b border-slate-300 dark:border-white/10 text-xs uppercase tracking-wider text-slate-700 dark:text-[#A1A1AA]">
                  <th className="py-4 px-5 font-medium">Recurso</th>
                  <th className="py-4 px-5 font-medium">Teste Inicial</th>
                  <th className="py-4 px-5 font-medium">PRO · R$ 49,90</th>
                  <th className="py-4 px-5 font-medium text-violet-700 dark:text-[#A855F7]">
                    PREMIUM · R$ 99,90
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/10 text-sm">
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.label} className="hover:bg-slate-100/70 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-5 font-medium text-slate-950 dark:text-white">{row.label}</td>
                    <td className="py-3.5 px-5 text-slate-700 dark:text-[#A1A1AA] font-mono-num">{row.freeTrial}</td>
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
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white hover:brightness-110 disabled:opacity-50 transition-all whitespace-nowrap shrink-0"
              >
                {waitlistSubmitting ? 'Enviando...' : 'Entrar na lista'}
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
