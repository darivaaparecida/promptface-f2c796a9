import { INITIAL_PLANS } from './catalog';
import { CREDIT_COSTS } from './rules';

export interface GenerationAnalyticsInput {
  id: string;
  costCredits: number;
  createdAt: string;
  favorite?: boolean;
}

export interface LedgerAnalyticsInput {
  type: string;
  amount: number;
  createdAt: string;
}

export interface MonthlyGenerationBucket {
  monthKey: string;
  label: string;
  fullLabel: string;
  generations: number;
  creditsSpent: number;
}

export interface CreditsOverviewData {
  remainingCredits: number;
  monthlyQuotaCredits: number;
  usedCreditsThisMonth: number;
  remainingPercent: number;
  remainingPhotosEstimate: number;
  planLabel: string;
  chartSlices: Array<{
    name: string;
    value: number;
    color: string;
  }>;
}

export interface MySpaceDashboardSummary {
  monthlySeries: MonthlyGenerationBucket[];
  currentMonthGenerations: number;
  previousMonthGenerations: number;
  totalGenerations: number;
  favoriteCount: number;
  creditsOverview: CreditsOverviewData;
}

const MONTH_ABBR_PT = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

function toMonthKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getPlanDisplayInfo(planId: string | undefined): {
  label: string;
  monthlyQuotaCredits: number;
} {
  if (planId === 'essencial' || planId === 'pro' || planId === 'premium') {
    const plan = INITIAL_PLANS.find((p) => p.id === planId);
    if (plan) {
      return {
        label: `Plano ${plan.name}`,
        monthlyQuotaCredits: plan.creditsMonthly,
      };
    }
  }
  return {
    label: 'Boas-vindas (Free)',
    monthlyQuotaCredits: 10,
  };
}

export function buildMonthlyGenerationSeries(
  generations: GenerationAnalyticsInput[],
  monthsCount = 6,
  referenceDate = new Date()
): MonthlyGenerationBucket[] {
  const safeCount = Math.max(1, Math.min(12, Math.floor(monthsCount)));
  const buckets: MonthlyGenerationBucket[] = [];
  const bucketMap = new Map<string, MonthlyGenerationBucket>();

  for (let offset = safeCount - 1; offset >= 0; offset--) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - offset, 1);
    const key = toMonthKey(d);
    const monthName = MONTH_ABBR_PT[d.getMonth()];
    const shortYear = String(d.getFullYear()).slice(-2);
    const bucket: MonthlyGenerationBucket = {
      monthKey: key,
      label: `${monthName}/${shortYear}`,
      fullLabel: `${monthName} ${d.getFullYear()}`,
      generations: 0,
      creditsSpent: 0,
    };
    buckets.push(bucket);
    bucketMap.set(key, bucket);
  }

  for (const gen of generations) {
    const parsed = new Date(gen.createdAt);
    if (Number.isNaN(parsed.getTime())) continue;
    const key = toMonthKey(parsed);
    const bucket = bucketMap.get(key);
    if (bucket) {
      bucket.generations += 1;
      bucket.creditsSpent += Math.max(0, Number(gen.costCredits) || 0);
    }
  }

  return buckets;
}

export function computeCreditsOverview(params: {
  remainingCredits: number;
  planId?: string;
  generations: GenerationAnalyticsInput[];
  ledger?: LedgerAnalyticsInput[];
  referenceDate?: Date;
}): CreditsOverviewData {
  const referenceDate = params.referenceDate ?? new Date();
  const currentKey = toMonthKey(referenceDate);
  const safeRemaining = Math.max(0, Math.floor(Number(params.remainingCredits) || 0));
  const { label: planLabel, monthlyQuotaCredits } = getPlanDisplayInfo(params.planId);

  let usedThisMonth = 0;
  if (params.ledger && params.ledger.length > 0) {
    let reserved = 0;
    let refunded = 0;
    for (const entry of params.ledger) {
      const parsed = new Date(entry.createdAt);
      if (Number.isNaN(parsed.getTime()) || toMonthKey(parsed) !== currentKey) continue;
      if (entry.type === 'reserve' && entry.amount < 0) {
        reserved += Math.abs(entry.amount);
      } else if (entry.type === 'refund' && entry.amount > 0) {
        refunded += entry.amount;
      }
    }
    usedThisMonth = Math.max(0, reserved - refunded);
  } else {
    for (const gen of params.generations) {
      const parsed = new Date(gen.createdAt);
      if (Number.isNaN(parsed.getTime()) || toMonthKey(parsed) !== currentKey) continue;
      usedThisMonth += Math.max(0, Number(gen.costCredits) || 0);
    }
  }

  const effectiveTotalPool = Math.max(monthlyQuotaCredits, safeRemaining + usedThisMonth);
  const remainingPercent =
    effectiveTotalPool > 0
      ? Math.min(100, Math.max(0, Math.round((safeRemaining / effectiveTotalPool) * 100)))
      : 0;

  const remainingPhotosEstimate = Math.floor(safeRemaining / CREDIT_COSTS.generate);

  const chartSlices =
    safeRemaining === 0 && usedThisMonth === 0
      ? [
          {
            name: 'Sem saldo disponível',
            value: 1,
            color: '#27272A',
          },
        ]
      : [
          {
            name: 'Créditos disponíveis',
            value: safeRemaining,
            color: '#8B5CF6',
          },
          {
            name: 'Créditos usados no mês',
            value: usedThisMonth,
            color: '#2E2E3A',
          },
        ].filter((slice) => slice.value > 0);

  return {
    remainingCredits: safeRemaining,
    monthlyQuotaCredits,
    usedCreditsThisMonth: usedThisMonth,
    remainingPercent,
    remainingPhotosEstimate,
    planLabel,
    chartSlices,
  };
}

export function computeMySpaceDashboardSummary(params: {
  generations: GenerationAnalyticsInput[];
  remainingCredits: number;
  planId?: string;
  ledger?: LedgerAnalyticsInput[];
  monthsCount?: number;
  referenceDate?: Date;
}): MySpaceDashboardSummary {
  const referenceDate = params.referenceDate ?? new Date();
  const monthlySeries = buildMonthlyGenerationSeries(
    params.generations,
    params.monthsCount ?? 6,
    referenceDate
  );

  const currentMonthGenerations =
    monthlySeries.length > 0 ? monthlySeries[monthlySeries.length - 1].generations : 0;
  const previousMonthGenerations =
    monthlySeries.length > 1 ? monthlySeries[monthlySeries.length - 2].generations : 0;

  const favoriteCount = params.generations.filter((g) => Boolean(g.favorite)).length;

  const creditsOverview = computeCreditsOverview({
    remainingCredits: params.remainingCredits,
    planId: params.planId,
    generations: params.generations,
    ledger: params.ledger,
    referenceDate,
  });

  return {
    monthlySeries,
    currentMonthGenerations,
    previousMonthGenerations,
    totalGenerations: params.generations.length,
    favoriteCount,
    creditsOverview,
  };
}
