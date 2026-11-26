import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PREFERRED_AI_MODEL,
  PREFERRED_AI_MODELS,
  getPreferredAiModelOption,
  normalizePreferredAiModel,
  resolveGenerationModelPreference,
} from './aiModels';

test('normalizePreferredAiModel returns valid model ids and falls back to auto', () => {
  assert.equal(normalizePreferredAiModel('gemini-nano-banana-2.1'), 'gemini-nano-banana-2.1');
  assert.equal(normalizePreferredAiModel('  flux-pro/kontext  '), 'flux-pro/kontext');
  assert.equal(normalizePreferredAiModel('unknown-model'), DEFAULT_PREFERRED_AI_MODEL);
  assert.equal(normalizePreferredAiModel(undefined), DEFAULT_PREFERRED_AI_MODEL);
});

test('getPreferredAiModelOption resolves metadata for all configured models', () => {
  assert.equal(PREFERRED_AI_MODELS.length, 4);
  const nano = getPreferredAiModelOption('gemini-nano-banana-2.1');
  assert.equal(nano.highQuality, true);
  assert.equal(nano.label, 'Gemini Nano Banana 2.1');

  const fallback = getPreferredAiModelOption('invalid');
  assert.equal(fallback.id, 'auto');
});

test('resolveGenerationModelPreference maps model preference to provider flags', () => {
  assert.deepEqual(resolveGenerationModelPreference('gemini-nano-banana-2.1'), {
    preferredModel: 'gemini-nano-banana-2.1',
    highQuality: true,
    preferFal: false,
  });
  assert.deepEqual(resolveGenerationModelPreference('flux-pro/kontext'), {
    preferredModel: 'flux-pro/kontext',
    highQuality: false,
    preferFal: true,
  });
  assert.deepEqual(resolveGenerationModelPreference('auto', true), {
    preferredModel: 'auto',
    highQuality: true,
    preferFal: false,
  });
});
