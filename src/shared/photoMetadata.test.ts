import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatExifDate,
  formatMimeLabel,
  formatModeLabel,
  formatPhotoExifMetadata,
} from './photoMetadata';

test('formatPhotoExifMetadata formats prompt, creation date, and active artistic filter', () => {
  const result = formatPhotoExifMetadata({
    scenarioTitle: 'Editorial em Paris',
    categoryName: 'Viagens pelo mundo',
    promptUsed: 'Retrato editorial em Paris com iluminação dourada ao entardecer',
    createdAt: '2026-11-24T15:30:00.000Z',
    appliedFilterId: 'cinematic',
    aspectRatio: '3:4',
    mimeType: 'image/jpeg',
    mode: 'preset',
    synthIdMarked: true,
    costCredits: 10,
  });

  assert.equal(
    result.prompt,
    'Retrato editorial em Paris com iluminação dourada ao entardecer'
  );
  assert.equal(result.appliedFilterLabel, 'Cinematográfico');
  assert.equal(result.appliedFilterId, 'cinematic');
  assert.equal(result.aspectRatio, '3:4');
  assert.equal(result.formatLabel, 'JPEG');
  assert.equal(result.modeLabel, 'Cenário pronto');
  assert.equal(result.signatureLabel, 'SynthID ativo');
  assert.equal(result.costLabel, '10 créditos');
  assert.match(result.createdAtFormatted, /\d{2}\/\d{2}\/2026/);
});

test('formatPhotoExifMetadata falls back cleanly when optional fields are missing', () => {
  const result = formatPhotoExifMetadata({
    scenarioTitle: 'Criação livre personalizada',
    categoryName: 'Criação Livre',
    createdAt: 'invalid-date',
    mode: 'free',
  });

  assert.equal(result.prompt, 'Criação livre personalizada');
  assert.equal(result.appliedFilterLabel, 'Original');
  assert.equal(result.appliedFilterId, 'original');
  assert.equal(result.createdAtFormatted, 'Data indisponível');
  assert.equal(result.formatLabel, 'PNG');
  assert.equal(result.modeLabel, 'Criação livre');
  assert.equal(result.signatureLabel, 'PromptFace IA');
});

test('formatExifDate, formatMimeLabel, and formatModeLabel handle all variants', () => {
  assert.equal(formatMimeLabel('image/webp'), 'WEBP');
  assert.equal(formatMimeLabel('image/png'), 'PNG');
  assert.equal(formatModeLabel('variation'), 'Variação');
  assert.notEqual(formatExifDate('2026-11-24T12:00:00.000Z'), 'Data indisponível');
});
