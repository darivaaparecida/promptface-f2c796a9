import { useMemo } from 'react';
import { AlertTriangle, Coins, ShieldCheck, TrendingUp, UserX } from 'lucide-react';
import type { AuthUser } from '../context/AuthContext';
import type { GenerationItem } from '../lib/db';
import type { PlanDefinition } from '../shared/catalog';
import { INITIAL_SIGNUP_CREDITS } from '../shared/rules';
import {
  buildAdminHealthMetrics,
  type ChurnSignal,
} from '../shared/adminStats';

interface AdminHealthPanelProps {
  users: AuthUser[];
  generations: GenerationItem[];
  plans: PlanDefinition[];
}

function planLabel(planId: string, plans: PlanDefinition[]): string {
  if (planId === 'free_trial') return 'Teste grátis';
  return plans.find((p) => p.id === planId)?.name ?? planId;
}

function ChurnSignalRow({
  signal,
  plans,
}: {
  signal: ChurnSignal;
  plans: PlanDefinition[];
}) {
  const isHigh = signal.level === 'high';
  return (
    <li className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#17171F]">
      <span
        className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
          isHigh ? 'bg-red-500' : 'bg-amber-500'
        }`}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">
          {signal.name}{' '}
          <span className="font-normal text-slate-500 dark:text-[#A1A1AA]">
            · {signal.email} · {planLabel(signal.planId, plans)}
          </span>
        </p>
        <p className="mt-0.5 text-sm text-slate-700 dark:text-[#A1A1AA]">
          {signal.reason}
          {signal.daysSince !== null && signal.daysSince > 0
            ? ` — há ${signal.daysSince} ${signal.daysSince === 1 ? 'dia' : 'dias'}`
            : ''}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
          isHigh
            ? 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300'
            : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
        }`}
      >
        {isHigh ? 'Atenção' : 'Observar'}
      </span>
    </li>
  );
}

/**
 * Saúde da assinatura: quanto dos créditos está sendo usado e quem está
 * em risco de cancelar (churn). Os sinais usam o cadastro e as 50
 * gerações mais recentes carregadas pelo painel.
 */
export function AdminHealthPanel({ users, generations, plans }: AdminHealthPanelProps) {
  const metrics = useMemo(() => {
    const monthlyQuotaByPlan: Record<string, number> = {
      free_trial: INITIAL_SIGNUP_CREDITS,
    };
    for (const plan of plans) {
      monthlyQuotaByPlan[plan.id] = plan.creditsMonthly;
    }
    return buildAdminHealthMetrics({
      users,
      generations,
      monthlyQuotaByPlan,
    });
  }, [users, generations, plans]);

  const kpis = [
    {
      label: 'Créditos em circulação',
      val: String(metrics.creditsInCirculation),
      hint: 'Saldo somado de todos os usuários',
      icon: Coins,
    },
    {
      label: 'Créditos usados neste mês',
      val: String(metrics.creditsUsedThisMonth),
      hint: `de ${metrics.totalMonthlyQuota} da cota mensal total`,
      icon: TrendingUp,
    },
    {
      label: 'Taxa de uso do mês',
      val: `${metrics.usageRateThisMonthPct}%`,
      hint: 'Créditos usados ÷ cota mensal total',
      icon: TrendingUp,
    },
    {
      label: 'Assinantes sem uso',
      val: `${metrics.subscribersWithoutGenerations}/${metrics.activeSubscribers}`,
      hint: 'Assinantes ativos sem nenhuma geração',
      icon: UserX,
    },
    {
      label: 'Conversão do teste grátis',
      val: `${metrics.trialConversionPct}%`,
      hint: `${metrics.trialWithGeneration} de ${metrics.trialTotal} testaram gerar`,
      icon: ShieldCheck,
    },
  ];

  return (
    <section aria-label="Saúde da assinatura">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">
          Saúde da assinatura
        </h2>
        <p className="text-xs text-slate-500 dark:text-[#A1A1AA]">
          Uso de créditos e sinais de churn
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#17171F] dark:shadow-none"
          >
            <p className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-[#A1A1AA]">
              <kpi.icon className="h-3.5 w-3.5" aria-hidden="true" />
              {kpi.label}
            </p>
            <p className="font-mono-num mt-2 font-display text-2xl font-bold text-slate-950 dark:text-white">
              {kpi.val}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-[#A1A1AA]">{kpi.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
          <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
          Sinais de churn ({metrics.churnSignals.length})
        </h3>
        {metrics.churnSignals.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            Nenhum sinal de churn no momento.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {metrics.churnSignals.slice(0, 8).map((signal) => (
              <ChurnSignalRow key={signal.userId} signal={signal} plans={plans} />
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-500 dark:text-[#A1A1AA]">
          Sinais calculados a partir do cadastro de cada usuário e das 50 gerações mais
          recentes carregadas. Assinante sem nenhuma geração, mais de 30 dias sem gerar,
          teste grátis sem uso há mais de 7 dias, cancelamento e pagamento em atraso
          entram na lista.
        </p>
      </div>
    </section>
  );
}
