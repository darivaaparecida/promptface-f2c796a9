import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PREFERRED_AI_MODEL,
  PREFERRED_AI_MODELS,
  canUseProModel,
  getAllowedPreferredModels,
  getPreferredAiModelOption,
  normalizePreferredAiModel,
  resolveEffectiveModel,
  resolveGenerationModelPreference,
} from './aiModels';

test('canUseProModel exige saldo para pelo menos 1 foto Pro', () => {
  assert.equal(canUseProModel(0), false);
  assert.equal(canUseProModel(10), false);
  assert.equal(canUseProModel(19), false);
  assert.equal(canUseProModel(20), true);
  assert.equal(canUseProModel(1600), true);
  assert.equal(canUseProModel(undefined), false);
});

test('resolveEffectiveModel cai para o 2.1 quando o saldo não cobre o Pro', () => {
  // Com 10 créditos (o bônus de cadastro) o Pro não pode ser usado.
  assert.equal(
    resolveEffectiveModel('free_trial', 'gemini-nano-banana-pro', 10).model,
    'gemini-nano-banana-2.1'
  );
  assert.equal(
    resolveEffectiveModel('premium', 'gemini-nano-banana-pro', 19).model,
    'gemini-nano-banana-2.1'
  );
  // Com 20 créditos o Pro vale.
  assert.equal(
    resolveEffectiveModel('premium', 'gemini-nano-banana-pro', 20).model,
    'gemini-nano-banana-pro'
  );
  // O 2.1 não depende do saldo.
  assert.equal(
    resolveEffectiveModel('free_trial', 'gemini-nano-banana-2.1', 0).model,
    'gemini-nano-banana-2.1'
  );
  // Sem saldo informado, não trava (compatibilidade com chamadores antigos).
  assert.equal(
    resolveEffectiveModel('premium', 'gemini-nano-banana-pro').model,
    'gemini-nano-banana-pro'
  );
});

test('normalizePreferredAiModel returns valid model ids and falls back to auto', () => {
  assert.equal(normalizePreferredAiModel('gemini-nano-banana-2.1'), 'gemini-nano-banana-2.1');
  assert.equal(normalizePreferredAiModel('  gemini-nano-banana-pro  '), 'gemini-nano-banana-pro');
  assert.equal(normalizePreferredAiModel('flux-pro/kontext/max'), DEFAULT_PREFERRED_AI_MODEL);
  assert.equal(normalizePreferredAiModel('gemini-3.1-flash-lite-image'), DEFAULT_PREFERRED_AI_MODEL);
  assert.equal(normalizePreferredAiModel('unknown-model'), DEFAULT_PREFERRED_AI_MODEL);
  assert.equal(normalizePreferredAiModel(undefined), DEFAULT_PREFERRED_AI_MODEL);
});

test('getPreferredAiModelOption resolves metadata for all configured models', () => {
  assert.equal(PREFERRED_AI_MODELS.length, 3);
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
  assert.deepEqual(resolveGenerationModelPreference('gemini-nano-banana-pro'), {
    preferredModel: 'gemini-nano-banana-pro',
    highQuality: true,
    preferFal: false,
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
    'gemini-nano-banana-2.1',
    'gemini-nano-banana-pro',
  ]);
  assert.deepEqual(getAllowedPreferredModels('essencial'), [
    'auto',
    'gemini-nano-banana-2.1',
    'gemini-nano-banana-pro',
  ]);
  assert.deepEqual(getAllowedPreferredModels('pro'), [
    'auto',
    'gemini-nano-banana-2.1',
    'gemini-nano-banana-pro',
  ]);
  assert.deepEqual(getAllowedPreferredModels('premium'), [
    'auto',
    'gemini-nano-banana-2.1',
    'gemini-nano-banana-pro',
  ]);
});

test('resolveEffectiveModel resolves auto to the plan model and caps resolution', () => {
  assert.deepEqual(resolveEffectiveModel('free_trial', 'auto'), {
    model: 'gemini-nano-banana-2.1',
    maxResolution: '1K',
    preferFal: false,
    highQuality: true,
  });
  assert.deepEqual(resolveEffectiveModel('essencial', 'auto'), {
    model: 'gemini-nano-banana-2.1',
    maxResolution: '1K',
    preferFal: false,
    highQuality: true,
  });
  assert.deepEqual(resolveEffectiveModel('pro', 'auto'), {
    model: 'gemini-nano-banana-2.1',
    maxResolution: '1K',
    preferFal: false,
    highQuality: true,
  });
  assert.deepEqual(resolveEffectiveModel('premium', 'auto'), {
    model: 'gemini-nano-banana-2.1',
    maxResolution: '1K',
    preferFal: false,
    highQuality: true,
  });
  // Preferência fora do plano volta para o modelo do plano.
  assert.equal(
    resolveEffectiveModel('essencial', 'flux-pro/kontext/max').model,
    'gemini-nano-banana-2.1'
  );
  // Todos os planos ficam em 1K por enquanto.
  assert.equal(
    resolveEffectiveModel('premium', 'gemini-nano-banana-pro').maxResolution,
    '1K'
  );
});
