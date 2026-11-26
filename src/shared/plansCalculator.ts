import type { PlanDefinition } from './catalog';
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
  recommendedPlanId: 'free_trial' | 'pro' | 'premium';
  exceedsPremiumLimit: boolean;
}

export interface PlanUnitMetrics {
  pricePerPhotoBrl: number;
  pricePerPhotoFormatted: string;
  savingsVsBasePercent: number;
}

function clampCount(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, Math.round(value)));
}

export function calculateMonthlyCreditNeeds(
  input: MonthlyUsageInput
): MonthlyUsageSummary {
  const photosPerMonth = clampCount(input.photosPerMonth, 100);
  const studioActionsPerMonth = clampCount(input.studioActionsPerMonth, 100);
  const promptEnhancementsPerMonth = clampCount(input.promptEnhancementsPerMonth, 200);

  const generationCredits = photosPerMonth * CREDIT_COSTS.generate;
  const studioCredits = studioActionsPerMonth * CREDIT_COSTS.studio_edit;
  const enhanceCredits = promptEnhancementsPerMonth * CREDIT_COSTS.enhance_prompt;
  const totalCredits = generationCredits + studioCredits + enhanceCredits;

  let recommendedPlanId: 'free_trial' | 'pro' | 'premium' = 'premium';
  if (totalCredits <= INITIAL_SIGNUP_CREDITS) {
    recommendedPlanId = 'free_trial';
  } else if (totalCredits <= 200) {
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
    exceedsPremiumLimit: totalCredits > 600,
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

export function getPlanUnitMetrics(
  plan: PlanDefinition,
  baselinePlan?: PlanDefinition
): PlanUnitMetrics {
  const safeMaxPhotos = Math.max(1, plan.maxPhotosMonthly);
  const pricePerPhotoBrl = plan.priceBrl / safeMaxPhotos;

  let savingsVsBasePercent = 0;
  if (baselinePlan && baselinePlan.id !== plan.id && baselinePlan.maxPhotosMonthly > 0) {
    const baselinePerPhoto = baselinePlan.priceBrl / baselinePlan.maxPhotosMonthly;
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
