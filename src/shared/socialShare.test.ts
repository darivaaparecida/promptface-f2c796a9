import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildShareCaption,
  buildTwitterShareUrl,
  buildWhatsAppShareUrl,
} from './socialShare';

test('buildShareCaption formats Portuguese caption with scenario title and valid http url', () => {
  const caption = buildShareCaption({
    scenarioTitle: 'Pôr do sol em Dubai',
    categoryName: 'Luxo e riqueza',
    appUrl: 'https://promptface.com.br/meu-espaco',
  });
  assert.match(caption, /Pôr do sol em Dubai/);
  assert.match(caption, /Luxo e riqueza/);
  assert.match(caption, /https:\/\/promptface\.com\.br/);
});

test('buildShareCaption ignores non-http urls safely', () => {
  const caption = buildShareCaption({
    scenarioTitle: 'Editorial em Paris',
    appUrl: 'javascript:alert(1)',
  });
  assert.equal(caption.includes('javascript:'), false);
  assert.match(caption, /Editorial em Paris/);
});

test('buildWhatsAppShareUrl encodes text query parameter cleanly', () => {
  const url = buildWhatsAppShareUrl({
    scenarioTitle: 'CEO em Escritório',
    categoryName: 'Corporativo',
    appUrl: 'https://promptface.com.br',
  });
  assert.ok(url.startsWith('https://api.whatsapp.com/send?text='));
  const parsed = new URL(url);
  assert.match(parsed.searchParams.get('text') || '', /CEO em Escritório/);
});

test('buildTwitterShareUrl separates text and url parameters', () => {
  const url = buildTwitterShareUrl({
    scenarioTitle: 'Praia Paradisíaca',
    categoryName: 'Viagens',
    appUrl: 'https://promptface.com.br/cenarios',
  });
  assert.ok(url.startsWith('https://twitter.com/intent/tweet?'));
  const parsed = new URL(url);
  assert.match(parsed.searchParams.get('text') || '', /Praia Paradisíaca/);
  assert.equal(parsed.searchParams.get('url'), 'https://promptface.com.br');
});
