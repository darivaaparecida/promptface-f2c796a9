import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PREFERRED_AI_MODEL,
  PREFERRED_AI_MODELS,
  getAllowedPreferredModels,
  getPreferredAiModelOption,
  normalizePreferredAiModel,
  resolveEffectiveModel,
  resolveGenerationModelPreference,
} from './aiModels';

test('normalizePreferredAiModel returns valid model ids and falls back to auto', () => {
  assert.equal(normalizePreferredAiModel('gemini-nano-banana-pro'), 'gemini-nano-banana-pro');
  assert.equal(normalizePreferredAiModel('  flux-pro/kontext/max  '), 'flux-pro/kontext/max');
  assert.equal(normalizePreferredAiModel('gemini-nano-banana-2.1'), DEFAULT_PREFERRED_AI_MODEL);
  assert.equal(normalizePreferredAiModel('unknown-model'), DEFAULT_PREFERRED_AI_MODEL);
  assert.equal(normalizePreferredAiModel(undefined), DEFAULT_PREFERRED_AI_MODEL);
});

test('getPreferredAiModelOption resolves metadata for all configured models', () => {
  assert.equal(PREFERRED_AI_MODELS.length, 4);
  const nano = getPreferredAiModelOption('gemini-nano-banana-pro');
  assert.equal(nano.highQuality, true);
  assert.equal(nano.label, 'Gemini Nano Banana Pro');

  const fallback = getPreferredAiModelOption('invalid');
  assert.equal(fallback.id, 'auto');
});

test('resolveGenerationModelPreference maps model preference to provider flags', () => {
  assert.deepEqual(resolveGenerationModelPreference('gemini-nano-banana-pro'), {
    preferredModel: 'gemini-nano-banana-pro',
    highQuality: true,
    preferFal: false,
  });
  assert.deepEqual(resolveGenerationModelPreference('flux-pro/kontext/max'), {
    preferredModel: 'flux-pro/kontext/max',
    highQuality: true,
    preferFal: true,
  });
  assert.deepEqual(resolveGenerationModelPreference('auto', true), {
    preferredModel: 'auto',
    highQuality: true,
    preferFal: false,
  });
});

test('getAllowedPreferredModels limits choices by plan', () => {
  assert.deepEqual(getAllowedPreferredModels('free_trial'), [
    'auto',
    'flux-pro/kontext/max',
    'gemini-3.1-flash-lite-image',
  ]);
  assert.deepEqual(getAllowedPreferredModels('essencial'), [
    'auto',
    'gemini-nano-banana-pro',
  ]);
  assert.deepEqual(getAllowedPreferredModels('pro'), [
    'auto',
    'flux-pro/kontext/max',
  ]);
  assert.deepEqual(getAllowedPreferredModels('premium'), [
    'auto',
    'flux-pro/kontext/max',
  ]);
});

test('resolveEffectiveModel resolves auto to the plan model and caps resolution', () => {
  assert.deepEqual(resolveEffectiveModel('free_trial', 'auto'), {
    model: 'flux-pro/kontext/max',
    maxResolution: '1K',
    preferFal: true,
    highQuality: true,
  });
  assert.deepEqual(resolveEffectiveModel('essencial', 'auto'), {
    model: 'gemini-nano-banana-pro',
    maxResolution: '1K',
    preferFal: false,
    highQuality: true,
  });
  assert.deepEqual(resolveEffectiveModel('pro', 'auto'), {
    model: 'flux-pro/kontext/max',
    maxResolution: '1K',
    preferFal: true,
    highQuality: true,
  });
  assert.deepEqual(resolveEffectiveModel('premium', 'auto'), {
    model: 'flux-pro/kontext/max',
    maxResolution: '1K',
    preferFal: true,
    highQuality: true,
  });
  // Preferência fora do plano volta para o modelo do plano.
  assert.equal(
    resolveEffectiveModel('essencial', 'flux-pro/kontext/max').model,
    'gemini-nano-banana-pro'
  );
  // Essencial fica em 1K.
  assert.equal(
    resolveEffectiveModel('essencial', 'gemini-nano-banana-pro').maxResolution,
    '1K'
  );
});
