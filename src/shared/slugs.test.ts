import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { slugify } from './slugs';

describe('slugify', () => {
  it('gera slug simples a partir do título', () => {
    assert.equal(slugify('Pôr do sol em Tóquio'), 'por-do-sol-em-toquio');
  });

  it('tira acentos e caracteres especiais', () => {
    assert.equal(slugify('Luxo & Riqueza! (edição)'), 'luxo-riqueza-edicao');
  });

  it('colapsa separadores e tira hífens das pontas', () => {
    assert.equal(slugify('  Neve   ·   Esqui nos Alpes  '), 'neve-esqui-nos-alpes');
  });

  it('devolve "item" quando não sobra nada', () => {
    assert.equal(slugify('!!!'), 'item');
    assert.equal(slugify(''), 'item');
  });

  it('limita a 60 caracteres', () => {
    assert.equal(slugify('a'.repeat(80)).length, 60);
  });
});
