import test from 'node:test';
import assert from 'node:assert/strict';
import { INITIAL_PLANS } from './catalog';
import { calculateMonthlyCreditNeeds, getPlanUnitMetrics } from './plansCalculator';

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

test('calculateMonthlyCreditNeeds recommends pro up to 200 credits', () => {
  const summary = calculateMonthlyCreditNeeds({
    photosPerMonth: 15,
    studioActionsPerMonth: 4,
    promptEnhancementsPerMonth: 10,
  });
  assert.equal(summary.generationCredits, 150);
  assert.equal(summary.studioCredits, 40);
  assert.equal(summary.enhanceCredits, 10);
  assert.equal(summary.totalCredits, 200);
  assert.equal(summary.recommendedPlanId, 'pro');
  assert.equal(summary.exceedsPremiumLimit, false);
});

test('calculateMonthlyCreditNeeds recommends premium above 200 credits and flags >600', () => {
  const premiumFit = calculateMonthlyCreditNeeds({
    photosPerMonth: 35,
    studioActionsPerMonth: 15,
    promptEnhancementsPerMonth: 20,
  });
  assert.equal(premiumFit.totalCredits, 520);
  assert.equal(premiumFit.recommendedPlanId, 'premium');
  assert.equal(premiumFit.exceedsPremiumLimit, false);

  const highUsage = calculateMonthlyCreditNeeds({
    photosPerMonth: 65,
    studioActionsPerMonth: 0,
    promptEnhancementsPerMonth: 0,
  });
  assert.equal(highUsage.totalCredits, 650);
  assert.equal(highUsage.recommendedPlanId, 'premium');
  assert.equal(highUsage.exceedsPremiumLimit, true);
});

test('getPlanUnitMetrics computes cost per photo and savings vs PRO', () => {
  const pro = INITIAL_PLANS.find((p) => p.id === 'pro')!;
  const premium = INITIAL_PLANS.find((p) => p.id === 'premium')!;

  const proMetrics = getPlanUnitMetrics(pro, pro);
  assert.equal(proMetrics.savingsVsBasePercent, 0);
  assert.ok(proMetrics.pricePerPhotoFormatted.includes('2,50'));

  const premiumMetrics = getPlanUnitMetrics(premium, pro);
  assert.equal(premiumMetrics.savingsVsBasePercent, 33);
  assert.ok(premiumMetrics.pricePerPhotoFormatted.includes('1,67'));
});
