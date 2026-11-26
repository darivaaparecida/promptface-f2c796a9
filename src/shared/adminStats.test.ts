import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MAINTENANCE_CONFIG,
  buildAdminDailyStats,
  normalizeMaintenanceConfig,
} from './adminStats';

test('normalizeMaintenanceConfig falls back to friendly defaults when fields are empty', () => {
  const normalized = normalizeMaintenanceConfig({
    enabled: true,
    title: '   ',
    message: '',
    estimatedReturn: '  20 min  ',
  });

  assert.equal(normalized.enabled, true);
  assert.equal(normalized.title, DEFAULT_MAINTENANCE_CONFIG.title);
  assert.equal(normalized.message, DEFAULT_MAINTENANCE_CONFIG.message);
  assert.equal(normalized.estimatedReturn, '20 min');
});

test('normalizeMaintenanceConfig clamps overly long title and message safely', () => {
  const normalized = normalizeMaintenanceConfig({
    enabled: false,
    title: 'A'.repeat(200),
    message: 'B'.repeat(700),
    estimatedReturn: 'C'.repeat(200),
  });

  assert.equal(normalized.enabled, false);
  assert.equal(normalized.title.length, 120);
  assert.equal(normalized.message.length, 500);
  assert.equal(normalized.estimatedReturn.length, 100);
});

test('buildAdminDailyStats computes daily generations and cumulative user counts accurately', () => {
  const ref = new Date('2026-11-26T15:00:00.000Z');
  const summary = buildAdminDailyStats({
    days: 5,
    referenceDate: ref,
    users: [
      { createdAt: '2026-11-10T10:00:00.000Z' }, // before 5-day window (2026-11-22..2026-11-26)
      { createdAt: '2026-11-23T09:30:00.000Z' },
      { createdAt: '2026-11-23T18:00:00.000Z' },
      { createdAt: '2026-11-26T04:00:00.000Z' },
    ],
    generations: [
      { createdAt: '2026-11-20T12:00:00.000Z' }, // outside window
      { createdAt: '2026-11-24T11:00:00.000Z' },
      { createdAt: '2026-11-24T13:00:00.000Z' },
      { createdAt: '2026-11-24T19:00:00.000Z' },
      { createdAt: '2026-11-26T08:00:00.000Z' },
    ],
  });

  assert.equal(summary.series.length, 5);
  assert.deepEqual(
    summary.series.map((p) => p.dateKey),
    ['2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26']
  );

  // Baseline before window: 1 user
  assert.equal(summary.series[0].cumulativeUsers, 1);
  assert.equal(summary.series[1].newUsersCount, 2);
  assert.equal(summary.series[1].cumulativeUsers, 3);
  assert.equal(summary.series[2].generationsCount, 3);
  assert.equal(summary.series[4].newUsersCount, 1);
  assert.equal(summary.series[4].cumulativeUsers, 4);
  assert.equal(summary.series[4].generationsCount, 1);

  assert.equal(summary.totalGenerationsInWindow, 4);
  assert.equal(summary.newUsersInWindow, 3);
  assert.equal(summary.totalUsersAtEnd, 4);
  assert.equal(summary.peakGenerationsDay?.dateKey, '2026-11-24');
  assert.equal(summary.avgGenerationsPerDay, 0.8);
});

test('buildAdminDailyStats handles empty datasets and invalid dates cleanly', () => {
  const summary = buildAdminDailyStats({
    days: 7,
    referenceDate: new Date('2026-11-26T00:00:00.000Z'),
    users: [{ createdAt: 'not-a-date' }],
    generations: [{ createdAt: '' }],
  });

  assert.equal(summary.series.length, 7);
  assert.equal(summary.totalGenerationsInWindow, 0);
  assert.equal(summary.newUsersInWindow, 0);
  assert.equal(summary.totalUsersAtEnd, 0);
  assert.equal(summary.peakGenerationsDay, null);
});
