import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, INITIAL_PLANS, INITIAL_SCENARIOS } from './catalog';
import {
  CREDIT_COSTS,
  INITIAL_SIGNUP_CREDITS,
  buildGenerationPrompt,
  canAffordOperation,
  filterScenarios,
  moderatePrompt,
  refundCredits,
  reserveCredits,
} from './rules';

test('catalog has exactly 14 categories and 84 active scenarios (6 per category)', () => {
  assert.equal(CATEGORIES.length, 14);
  assert.equal(INITIAL_SCENARIOS.length, 84);
  for (const cat of CATEGORIES) {
    const count = INITIAL_SCENARIOS.filter((s) => s.categoryId === cat.id).length;
    assert.equal(count, 6, `Category ${cat.id} should have 6 scenarios, got ${count}`);
  }
});

test('plans math is consistent and never advertises unlimited', () => {
  const essencial = INITIAL_PLANS.find((p) => p.id === 'essencial');
  const pro = INITIAL_PLANS.find((p) => p.id === 'pro');
  const premium = INITIAL_PLANS.find((p) => p.id === 'premium');
  assert.ok(essencial && pro && premium);
  assert.equal(essencial.priceBrl, 24.9);
  assert.equal(essencial.creditsMonthly / CREDIT_COSTS.generate, essencial.maxPhotosMonthly);
  assert.equal(pro.priceBrl, 49.9);
  assert.equal(pro.creditsMonthly / CREDIT_COSTS.generate, pro.maxPhotosMonthly);
  assert.equal(premium.priceBrl, 99.9);
  assert.equal(premium.creditsMonthly / CREDIT_COSTS.generate, premium.maxPhotosMonthly);
  assert.equal(INITIAL_SIGNUP_CREDITS, 10);

  const allText = JSON.stringify(INITIAL_PLANS).toLowerCase();
  assert.equal(allText.includes('ilimitad'), false);
});

test('credit reservation, sufficiency, and refund logic work atomically', () => {
  assert.equal(canAffordOperation(10, 'generate'), true);
  assert.equal(canAffordOperation(9, 'generate'), false);
  assert.equal(CREDIT_COSTS.generate_pro, 20);
  assert.equal(canAffordOperation(20, 'generate_pro'), true);
  assert.equal(canAffordOperation(19, 'generate_pro'), false);
  assert.equal(canAffordOperation(1, 'enhance_prompt'), true);

  const res = reserveCredits(10, 'generate');
  assert.equal(res.ok, true);
  assert.equal(res.newBalance, 0);
  assert.equal(res.reservedAmount, 10);

  const insufficient = reserveCredits(5, 'studio_edit');
  assert.equal(insufficient.ok, false);
  assert.equal(insufficient.newBalance, 5);

  const refunded = refundCredits(res.newBalance, res.reservedAmount);
  assert.equal(refunded, 10);
});

test('content moderation blocks disallowed prompts and allows safe prompts', () => {
  assert.equal(moderatePrompt('Pôr do sol em Dubai com terno elegante').allowed, true);
  assert.equal(moderatePrompt('Foto com nudez na praia').allowed, false);
  assert.equal(moderatePrompt('Deepfake de documento falso').allowed, false);
  assert.equal(moderatePrompt('Foto de celebridade famosa').allowed, false);
  assert.equal(moderatePrompt('Propaganda política enganosa na urna').allowed, false);
});

test('generation prompt combines visual profile and mandatory realism instruction', () => {
  const prompt = buildGenerationPrompt({
    mode: 'free',
    baseDescription: 'Em Dubai ao pôr do sol',
    outfit: 'Terno escuro',
    visualProfile: {
      eyeColor: 'castanhos',
      beardMustache: 'barba curta',
    },
  });
  assert.match(prompt, /olhos castanhos/);
  assert.match(prompt, /barba curta/);
  assert.match(prompt, /preserve exatamente o rosto da referência/);
});

test('filterScenarios filters by category and search query', () => {
  const dubai = filterScenarios(INITIAL_SCENARIOS, 'all', 'Dubai');
  assert.ok(dubai.length >= 1);
  const luxoOnly = filterScenarios(INITIAL_SCENARIOS, 'luxo', '');
  assert.equal(luxoOnly.length, 6);
});
