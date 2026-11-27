import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_PLANS } from './catalog';
import {
  calculateMonthlyCreditNeeds,
  getPlanCyclePricing,
  getPlanSavingsBadgeInfo,
  getPlanUnitMetrics,
} from './plansCalculator';

test('calculateMonthlyCreditNeeds recommends free_trial up to 10 credits', () => {
  const summary = calculateMonthlyCreditNeeds({
    photosPerMonth: 1,
    studioActionsPerMonth: 0,
    promptEnhancementsPerMonth: 0,
  });
  assert.equal(summary.totalCredits, 10);
  assert.equal(summary.recommendedPlanId, 'free_trial');
  assert.equal(summary.exceedsPremiumLimit, false);
});

test('calculateMonthlyCreditNeeds recommends essencial between 11 and 300 credits', () => {
  const summary = calculateMonthlyCreditNeeds({
    photosPerMonth: 6,
    studioActionsPerMonth: 2,
    promptEnhancementsPerMonth: 0,
  });
  assert.equal(summary.totalCredits, 80);
  assert.equal(summary.recommendedPlanId, 'essencial');
  assert.equal(summary.exceedsPremiumLimit, false);
});

test('calculateMonthlyCreditNeeds recommends pro between 301 and 800 credits', () => {
  const summary = calculateMonthlyCreditNeeds({
    photosPerMonth: 40,
    studioActionsPerMonth: 4,
    promptEnhancementsPerMonth: 10,
  });
  assert.equal(summary.generationCredits, 400);
  assert.equal(summary.studioCredits, 40);
  assert.equal(summary.enhanceCredits, 10);
  assert.equal(summary.totalCredits, 450);
  assert.equal(summary.recommendedPlanId, 'pro');
  assert.equal(summary.exceedsPremiumLimit, false);
});

test('calculateMonthlyCreditNeeds recommends premium above 800 credits and flags >1600', () => {
  const premiumFit = calculateMonthlyCreditNeeds({
    photosPerMonth: 70,
    studioActionsPerMonth: 15,
    promptEnhancementsPerMonth: 20,
  });
  assert.equal(premiumFit.totalCredits, 870);
  assert.equal(premiumFit.recommendedPlanId, 'premium');
  assert.equal(premiumFit.exceedsPremiumLimit, false);

  const highUsage = calculateMonthlyCreditNeeds({
    photosPerMonth: 165,
    studioActionsPerMonth: 0,
    promptEnhancementsPerMonth: 0,
  });
  assert.equal(highUsage.totalCredits, 1650);
  assert.equal(highUsage.recommendedPlanId, 'premium');
  assert.equal(highUsage.exceedsPremiumLimit, true);
});

test('getPlanCyclePricing computes monthly, quarterly (~20% off), and yearly (~33% off) equivalents', () => {
  const essencial = INITIAL_PLANS.find((p) => p.id === 'essencial')!;
  const pro = INITIAL_PLANS.find((p) => p.id === 'pro')!;
  const premium = INITIAL_PLANS.find((p) => p.id === 'premium')!;

  assert.equal(getPlanCyclePricing(essencial, 'monthly').monthlyEquivalentBrl, 24.9);
  assert.equal(getPlanCyclePricing(essencial, 'quarterly').monthlyEquivalentBrl, 19.9);
  assert.equal(getPlanCyclePricing(essencial, 'quarterly').discountPercent, 20);
  assert.equal(getPlanCyclePricing(essencial, 'quarterly').bonusCreditsFirstMonth, 20);
  assert.equal(getPlanCyclePricing(essencial, 'yearly').monthlyEquivalentBrl, 16.58);
  assert.equal(getPlanCyclePricing(essencial, 'yearly').discountPercent, 33);
  assert.equal(getPlanCyclePricing(essencial, 'yearly').bonusCreditsFirstMonth, 50);

  assert.equal(getPlanCyclePricing(pro, 'monthly').monthlyEquivalentBrl, 49.9);
  assert.equal(getPlanCyclePricing(pro, 'quarterly').monthlyEquivalentBrl, 39.9);
  assert.equal(getPlanCyclePricing(pro, 'yearly').monthlyEquivalentBrl, 33.25);

  assert.equal(getPlanCyclePricing(premium, 'monthly').monthlyEquivalentBrl, 99.9);
  assert.equal(getPlanCyclePricing(premium, 'quarterly').monthlyEquivalentBrl, 79.9);
  assert.equal(getPlanCyclePricing(premium, 'yearly').monthlyEquivalentBrl, 66.58);
});

test('getPlanUnitMetrics computes cost per photo and savings vs PRO', () => {
  const pro = INITIAL_PLANS.find((p) => p.id === 'pro')!;
  const premium = INITIAL_PLANS.find((p) => p.id === 'premium')!;

  const proMetrics = getPlanUnitMetrics(pro, pro);
  assert.equal(proMetrics.savingsVsBasePercent, 0);
  assert.ok(proMetrics.pricePerPhotoFormatted.includes('0,62'));

  const premiumMetrics = getPlanUnitMetrics(premium, pro);
  assert.equal(premiumMetrics.savingsVsBasePercent, 0);
  assert.ok(premiumMetrics.pricePerPhotoFormatted.includes('0,62'));

  const premiumYearlyMetrics = getPlanUnitMetrics(premium, pro, 'yearly');
  assert.ok(premiumYearlyMetrics.pricePerPhotoFormatted.includes('0,42'));
});

test('getPlanSavingsBadgeInfo returns null on monthly and highlights exact BRL savings on quarterly and yearly', () => {
  const essencial = INITIAL_PLANS.find((p) => p.id === 'essencial')!;
  const pro = INITIAL_PLANS.find((p) => p.id === 'pro')!;
  const premium = INITIAL_PLANS.find((p) => p.id === 'premium')!;

  assert.equal(getPlanSavingsBadgeInfo(getPlanCyclePricing(essencial, 'monthly')), null);
  assert.equal(getPlanSavingsBadgeInfo(getPlanCyclePricing(pro, 'monthly')), null);
  assert.equal(getPlanSavingsBadgeInfo(getPlanCyclePricing(premium, 'monthly')), null);

  const essencialQuarterly = getPlanSavingsBadgeInfo(getPlanCyclePricing(essencial, 'quarterly'));
  assert.ok(essencialQuarterly);
  assert.equal(essencialQuarterly.interval, 'quarterly');
  assert.ok(essencialQuarterly.headline.includes('15,00'));
  assert.equal(essencialQuarterly.discountTag, '-20%');

  const proQuarterly = getPlanSavingsBadgeInfo(getPlanCyclePricing(pro, 'quarterly'));
  assert.ok(proQuarterly);
  assert.ok(proQuarterly.headline.includes('30,00'));

  const premiumYearly = getPlanSavingsBadgeInfo(getPlanCyclePricing(premium, 'yearly'));
  assert.ok(premiumYearly);
  assert.equal(premiumYearly.interval, 'yearly');
  assert.ok(premiumYearly.headline.includes('399,80'));
  assert.equal(premiumYearly.discountTag, '-33%');
  assert.equal(premiumYearly.retentionTag, 'Maior economia');
});

