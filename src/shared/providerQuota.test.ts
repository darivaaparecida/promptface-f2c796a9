import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_FAL_FREE_LIMIT,
  canConsumeFalImage,
  getFalQuotaSummary,
  normalizeFalQuotaState,
  recordFalImageSuccess,
} from './providerQuota';

test('normalizeFalQuotaState defaults to 0 used and 12 free limit', () => {
  const state = normalizeFalQuotaState(undefined);
  assert.equal(state.falImagesUsed, 0);
  assert.equal(state.falFreeLimit, DEFAULT_FAL_FREE_LIMIT);
  assert.equal(DEFAULT_FAL_FREE_LIMIT, 12);
});

test('normalizeFalQuotaState clamps invalid negative or fractional values', () => {
  const state = normalizeFalQuotaState({
    falImagesUsed: -5,
    falFreeLimit: 12.9,
  });
  assert.equal(state.falImagesUsed, 0);
  assert.equal(state.falFreeLimit, 12);
});

test('canConsumeFalImage allows up to 12 images and blocks image 13', () => {
  let state = normalizeFalQuotaState({ falImagesUsed: 0, falFreeLimit: 12 });
  for (let i = 0; i < 12; i++) {
    assert.equal(canConsumeFalImage(state), true);
    state = recordFalImageSuccess(state, `2026-11-26T10:00:${String(i).padStart(2, '0')}Z`);
  }
  assert.equal(state.falImagesUsed, 12);
  assert.equal(canConsumeFalImage(state), false);
});

test('canConsumeFalImage prevents concurrent overshoot via inFlight counter', () => {
  const state = normalizeFalQuotaState({ falImagesUsed: 11, falFreeLimit: 12 });
  assert.equal(canConsumeFalImage(state, 0), true);
  assert.equal(canConsumeFalImage(state, 1), false);

  const summary = getFalQuotaSummary(state, { active: true, inFlight: 1 });
  assert.equal(summary.remaining, 0);
  assert.equal(summary.exhausted, true);
});
