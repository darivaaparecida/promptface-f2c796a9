import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { INITIAL_PLANS, type PlanDefinition } from '../shared/catalog';
import { CREDIT_COSTS, INITIAL_SIGNUP_CREDITS } from '../shared/rules';
import { useAuth } from '../context/AuthContext';

export function PlansPage() {
  const { user, config, apiFetch } = useAuth();
  const [plans, setPlans] = useState<PlanDefinition[]>(INITIAL_PLANS);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [waitlistEmail, setWaitlistEmail] = useState(user?.email || '');
  const [waitlistDone, setWaitlistDone] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/catalog')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.plans)) setPlans(data.plans);
      })
      .catch(() => {});
  }, []);

  const handleSubscribe = async (planId: 'pro' | 'premium') => {
    setStatusMsg(null);
    if (!user) return;
    setLoadingPlan(planId);
    try {
      const res = await apiFetch('/api/checkout', {
        method: 'POST',
        body: JSON.stringify({ planId }),
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
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: waitlistEmail, feature: 'payments' }),
    });
    const data = (await res.json()) as { message?: string; error?: string };
    setWaitlistDone(data.message || data.error || null);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-14 space-y-12">
      <div className="max-w-2xl space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-[#8B5CF6]">
          Planos e créditos
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-white text-balance">
          Escolha o volume ideal para suas fotografias
        </h1>
        <p className="text-sm sm:text-base text-[#A1A1AA]">
          Todo novo cadastro recebe {INITIAL_SIGNUP_CREDITS} créditos grátis (1 foto gratuita) para testar antes de assinar. Os créditos mensais dos planos não acumulam para o mês seguinte.
        </p>
      </div>

      {statusMsg && (
        <div className="rounded-xl border border-[#7C3AED]/40 bg-[#17171F] px-5 py-4 text-sm text-white">
          {statusMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-2xl p-6 sm:p-8 flex flex-col justify-between border ${
              plan.highlighted
                ? 'border-[#7C3AED] bg-[#17171F] shadow-xl shadow-[#7C3AED]/10'
                : 'border-white/10 bg-[#17171F]'
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-xl font-bold text-white">{plan.name}</h2>
                <span className="text-xs text-[#A1A1AA]">{plan.audience}</span>
              </div>

              <div className="mt-4 flex items-baseline gap-2">
                <span className="font-display text-4xl font-bold text-white font-mono-num">
                  {plan.priceFormatted}
                </span>
                <span className="text-sm text-[#A1A1AA]">/ mês</span>
              </div>

              <p className="mt-1 text-xs font-medium text-[#8B5CF6] font-mono-num">
                {plan.creditsMonthly} créditos mensais · até {plan.maxPhotosMonthly} fotos por mês
              </p>

              <p className="mt-3 text-sm text-[#A1A1AA]">{plan.description}</p>

              <ul className="mt-6 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-white/90">
                    <Check className="w-4 h-4 text-[#8B5CF6] shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8">
              {!user ? (
                <Link
                  to="/login?modo=cadastro"
                  className="block w-full text-center px-5 py-3.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white"
                >
                  Criar conta com 1ª foto grátis
                </Link>
              ) : config.stripeConfigured ? (
                <button
                  type="button"
                  disabled={loadingPlan === plan.id}
                  onClick={() => handleSubscribe(plan.id)}
                  className={`w-full px-5 py-3.5 rounded-xl text-xs font-semibold uppercase tracking-wider text-white transition-all ${
                    plan.highlighted
                      ? 'bg-gradient-to-r from-[#A855F7] to-[#EC4899]'
                      : 'border border-[#7C3AED] hover:bg-[#7C3AED]/15'
                  }`}
                >
                  {loadingPlan === plan.id ? 'Abrindo checkout...' : `Assinar ${plan.name}`}
                </button>
              ) : (
                <div className="text-center px-4 py-3 rounded-xl border border-white/10 bg-[#08080C] text-xs font-medium text-[#A1A1AA]">
                  Pagamentos em breve
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Operation costs table */}
      <section className="rounded-2xl border border-white/10 bg-[#17171F] p-6 sm:p-8 space-y-4">
        <h2 className="font-display text-lg font-semibold text-white">
          Custo transparente por operação
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Gerar foto', cost: `${CREDIT_COSTS.generate} créditos` },
            { label: 'Criar variação', cost: `${CREDIT_COSTS.variation} créditos` },
            { label: 'Editar no Studio', cost: `${CREDIT_COSTS.studio_edit} créditos` },
            { label: 'Melhorar descrição', cost: `${CREDIT_COSTS.enhance_prompt} crédito` },
          ].map((op) => (
            <div key={op.label} className="rounded-xl border border-white/10 bg-[#08080C] p-4">
              <p className="text-xs text-[#A1A1AA]">{op.label}</p>
              <p className="mt-1 font-display text-base font-bold text-white font-mono-num">
                {op.cost}
              </p>
            </div>
          ))}
        </div>
      </section>

      {!config.stripeConfigured && (
        <section className="rounded-2xl border border-[#7C3AED]/40 bg-[#17171F] p-6 sm:p-8 space-y-4">
          <h2 className="font-display text-lg font-semibold text-white">
            Pagamentos recorrentes em breve (Cartão e Pix Automático)
          </h2>
          <p className="text-sm text-[#A1A1AA]">
            Entre na lista de espera para receber aviso assim que as assinaturas em reais (BRL) estiverem abertas.
          </p>
          <form onSubmit={handleWaitlist} className="flex flex-col sm:flex-row gap-3 max-w-md">
            <input
              type="email"
              required
              value={waitlistEmail}
              onChange={(e) => setWaitlistEmail(e.target.value)}
              placeholder="seu@email.com"
              className="flex-1 px-4 py-3 rounded-xl bg-[#08080C] border border-white/15 text-sm text-white"
            />
            <button
              type="submit"
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white"
            >
              Entrar na lista
            </button>
          </form>
          {waitlistDone && <p className="text-xs text-[#8B5CF6]">{waitlistDone}</p>}
        </section>
      )}
    </div>
  );
}
