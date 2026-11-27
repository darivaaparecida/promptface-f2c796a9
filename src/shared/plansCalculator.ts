import type { BillingInterval, PlanDefinition, PlanId } from './catalog';
import { CREDIT_COSTS, INITIAL_SIGNUP_CREDITS } from './rules';

export interface MonthlyUsageInput {
  photosPerMonth: number;
  studioActionsPerMonth: number;
  promptEnhancementsPerMonth: number;
}

export interface MonthlyUsageSummary {
  photosPerMonth: number;
  studioActionsPerMonth: number;
  promptEnhancementsPerMonth: number;
  generationCredits: number;
  studioCredits: number;
  enhanceCredits: number;
  totalCredits: number;
  recommendedPlanId: PlanId;
  exceedsPremiumLimit: boolean;
}

export interface PlanUnitMetrics {
  pricePerPhotoBrl: number;
  pricePerPhotoFormatted: string;
  savingsVsBasePercent: number;
}

export interface PlanCyclePricing {
  interval: BillingInterval;
  months: 1 | 3 | 12;
  intervalLabel: string;
  billingCycleDescription: string;
  totalPriceBrl: number;
  totalPriceFormatted: string;
  monthlyEquivalentBrl: number;
  monthlyEquivalentFormatted: string;
  discountPercent: number;
  savingsBrl: number;
  savingsFormatted: string;
  bonusCreditsFirstMonth: number;
  pricePerPhotoBrl: number;
  pricePerPhotoFormatted: string;
}

function clampCount(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, Math.round(value)));
}

export function calculateMonthlyCreditNeeds(
  input: MonthlyUsageInput
): MonthlyUsageSummary {
  const photosPerMonth = clampCount(input.photosPerMonth, 200);
  const studioActionsPerMonth = clampCount(input.studioActionsPerMonth, 100);
  const promptEnhancementsPerMonth = clampCount(input.promptEnhancementsPerMonth, 200);

  const generationCredits = photosPerMonth * CREDIT_COSTS.generate;
  const studioCredits = studioActionsPerMonth * CREDIT_COSTS.studio_edit;
  const enhanceCredits = promptEnhancementsPerMonth * CREDIT_COSTS.enhance_prompt;
  const totalCredits = generationCredits + studioCredits + enhanceCredits;

  let recommendedPlanId: PlanId = 'premium';
  if (totalCredits <= INITIAL_SIGNUP_CREDITS) {
    recommendedPlanId = 'free_trial';
  } else if (totalCredits <= 300) {
    recommendedPlanId = 'essencial';
  } else if (totalCredits <= 800) {
    recommendedPlanId = 'pro';
  }

  return {
    photosPerMonth,
    studioActionsPerMonth,
    promptEnhancementsPerMonth,
    generationCredits,
    studioCredits,
    enhanceCredits,
    totalCredits,
    recommendedPlanId,
    exceedsPremiumLimit: totalCredits > 1600,
  };
}

export function formatBrlCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function getBillingIntervalMonths(interval: BillingInterval): 1 | 3 | 12 {
  if (interval === 'quarterly') return 3;
  if (interval === 'yearly') return 12;
  return 1;
}

export function getPlanCyclePricing(
  plan: PlanDefinition,
  interval: BillingInterval
): PlanCyclePricing {
  const months = getBillingIntervalMonths(interval);
  const totalPriceBrl =
    interval === 'quarterly'
      ? plan.quarterlyPriceBrl
      : interval === 'yearly'
      ? plan.yearlyPriceBrl
      : plan.priceBrl;

  const monthlyEquivalentBrl = Math.floor((totalPriceBrl / months) * 100 + 1e-6) / 100;
  const fullCyclePriceBrl = plan.priceBrl * months;
  const savingsBrl = Math.max(0, Number((fullCyclePriceBrl - totalPriceBrl).toFixed(2)));
  const discountPercent =
    interval === 'monthly' || fullCyclePriceBrl <= 0
      ? 0
      : Math.round((savingsBrl / fullCyclePriceBrl) * 100);

  const bonusCreditsFirstMonth =
    interval === 'quarterly'
      ? plan.quarterlyBonusCredits
      : interval === 'yearly'
      ? plan.yearlyBonusCredits
      : 0;

  const safeMaxPhotos = Math.max(1, plan.maxPhotosMonthly);
  const pricePerPhotoBrl = monthlyEquivalentBrl / safeMaxPhotos;

  const intervalLabel =
    interval === 'quarterly' ? 'Trimestral' : interval === 'yearly' ? 'Anual' : 'Mensal';
  const billingCycleDescription =
    interval === 'quarterly'
      ? `Cobrado ${formatBrlCurrency(totalPriceBrl)} a cada 3 meses`
      : interval === 'yearly'
      ? `Cobrado ${formatBrlCurrency(totalPriceBrl)} por ano`
      : 'Cobrança mensal sem fidelidade';

  return {
    interval,
    months,
    intervalLabel,
    billingCycleDescription,
    totalPriceBrl,
    totalPriceFormatted: formatBrlCurrency(totalPriceBrl),
    monthlyEquivalentBrl,
    monthlyEquivalentFormatted: formatBrlCurrency(monthlyEquivalentBrl),
    discountPercent,
    savingsBrl,
    savingsFormatted: formatBrlCurrency(savingsBrl),
    bonusCreditsFirstMonth,
    pricePerPhotoBrl,
    pricePerPhotoFormatted: formatBrlCurrency(pricePerPhotoBrl),
  };
}

export function getPlanUnitMetrics(
  plan: PlanDefinition,
  baselinePlan?: PlanDefinition,
  interval: BillingInterval = 'monthly'
): PlanUnitMetrics {
  const planPricing = getPlanCyclePricing(plan, interval);
  const pricePerPhotoBrl = planPricing.pricePerPhotoBrl;

  let savingsVsBasePercent = 0;
  if (baselinePlan && baselinePlan.id !== plan.id && baselinePlan.maxPhotosMonthly > 0) {
    const baselinePricing = getPlanCyclePricing(baselinePlan, interval);
    const baselinePerPhoto = baselinePricing.pricePerPhotoBrl;
    if (baselinePerPhoto > pricePerPhotoBrl) {
      savingsVsBasePercent = Math.round(
        ((baselinePerPhoto - pricePerPhotoBrl) / baselinePerPhoto) * 100
      );
    }
  }

  return {
    pricePerPhotoBrl,
    pricePerPhotoFormatted: formatBrlCurrency(pricePerPhotoBrl),
    savingsVsBasePercent,
  };
}

export interface PlanSavingsBadgeInfo {
  interval: 'quarterly' | 'yearly';
  headline: string;
  discountTag: string;
  periodShortLabel: string;
  retentionTag: string;
}

export function getPlanSavingsBadgeInfo(
  cyclePricing: PlanCyclePricing
): PlanSavingsBadgeInfo | null {
  if (cyclePricing.interval === 'monthly' || cyclePricing.savingsBrl <= 0) {
    return null;
  }

  const isYearly = cyclePricing.interval === 'yearly';

  return {
    interval: cyclePricing.interval,
    headline: `Economize ${cyclePricing.savingsFormatted}`,
    discountTag: `-${cyclePricing.discountPercent}%`,
    periodShortLabel: isYearly ? 'no plano anual' : 'no trimestral',
    retentionTag: isYearly ? 'Maior economia' : 'Economia garantida',
  };
}

