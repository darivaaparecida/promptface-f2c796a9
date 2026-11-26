import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMonthlyGenerationSeries,
  computeCreditsOverview,
  computeMySpaceDashboardSummary,
} from './mySpaceAnalytics';

test('buildMonthlyGenerationSeries creates chronological 6-month buckets and counts generations', () => {
  const ref = new Date(2026, 10, 15, 12, 0, 0); // Nov 2026
  const generations = [
    { id: '1', costCredits: 10, createdAt: '2026-11-05T10:00:00.000Z' },
    { id: '2', costCredits: 10, createdAt: '2026-11-12T15:00:00.000Z' },
    { id: '3', costCredits: 10, createdAt: '2026-10-20T12:00:00.000Z' },
    { id: '4', costCredits: 10, createdAt: '2026-06-08T12:00:00.000Z' },
    { id: '5', costCredits: 10, createdAt: '2025-12-01T12:00:00.000Z' }, // outside 6m window
  ];

  const series = buildMonthlyGenerationSeries(generations, 6, ref);
  assert.equal(series.length, 6);
  assert.deepEqual(
    series.map((b) => b.monthKey),
    ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']
  );
  assert.equal(series[0].generations, 1);
  assert.equal(series[0].creditsSpent, 10);
  assert.equal(series[4].generations, 1);
  assert.equal(series[5].generations, 2);
  assert.equal(series[5].creditsSpent, 20);
});

test('computeCreditsOverview calculates net monthly usage from ledger accounting for refunds', () => {
  const ref = new Date(2026, 10, 20, 12, 0, 0); // Nov 2026
  const overview = computeCreditsOverview({
    remainingCredits: 170,
    planId: 'pro',
    generations: [{ id: 'g1', costCredits: 10, createdAt: '2026-11-02T12:00:00.000Z' }],
    ledger: [
      { type: 'reserve', amount: -10, createdAt: '2026-11-02T12:00:00.000Z' },
      { type: 'reserve', amount: -10, createdAt: '2026-11-03T12:00:00.000Z' },
      { type: 'refund', amount: 10, createdAt: '2026-11-03T12:01:00.000Z' },
      { type: 'reserve', amount: -1, createdAt: '2026-11-04T12:00:00.000Z' },
      { type: 'reserve', amount: -20, createdAt: '2026-11-05T12:00:00.000Z' },
      { type: 'reserve', amount: -50, createdAt: '2026-10-10T12:00:00.000Z' }, // previous month
    ],
    referenceDate: ref,
  });

  assert.equal(overview.planLabel, 'Plano PRO');
  assert.equal(overview.monthlyQuotaCredits, 200);
  assert.equal(overview.remainingCredits, 170);
  assert.equal(overview.usedCreditsThisMonth, 31);
  assert.equal(overview.remainingPhotosEstimate, 17);
  assert.equal(overview.remainingPercent, 85); // 170 / (170+31=201) -> 85%
  assert.equal(overview.chartSlices.length, 2);
});

test('computeMySpaceDashboardSummary handles empty state and zero credits safely', () => {
  const ref = new Date(2026, 10, 20, 12, 0, 0);
  const summary = computeMySpaceDashboardSummary({
    generations: [],
    remainingCredits: 0,
    planId: 'free_trial',
    ledger: [],
    referenceDate: ref,
  });

  assert.equal(summary.totalGenerations, 0);
  assert.equal(summary.currentMonthGenerations, 0);
  assert.equal(summary.previousMonthGenerations, 0);
  assert.equal(summary.favoriteCount, 0);
  assert.equal(summary.creditsOverview.remainingCredits, 0);
  assert.equal(summary.creditsOverview.remainingPhotosEstimate, 0);
  assert.equal(summary.creditsOverview.chartSlices[0].name, 'Sem saldo disponível');
});
