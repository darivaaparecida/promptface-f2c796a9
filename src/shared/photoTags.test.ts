import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_TAGS_PER_PHOTO,
  PRESET_PHOTO_TAGS,
  addTagToList,
  getTagCounts,
  hasTag,
  normalizeTagList,
  normalizeTagName,
  togglePhotoTag,
} from './photoTags';

test('normalizeTagName and normalizeTagList clean whitespace and deduplicate case-insensitively', () => {
  assert.equal(normalizeTagName('  Retrato   Urbano '), 'Retrato Urbano');
  assert.equal(normalizeTagName('a'), null);
  assert.equal(normalizeTagName(''), null);
  assert.equal(normalizeTagName('x'.repeat(30)), null);

  assert.deepEqual(
    normalizeTagList(['Retrato', ' retrato ', 'Paisagem', 'A', 'Artístico']),
    ['Retrato', 'Paisagem', 'Artístico']
  );
});

test('togglePhotoTag adds and removes tags case-insensitively without mutating input', () => {
  const initial = ['Retrato'];
  const added = togglePhotoTag(initial, 'Paisagem');
  assert.deepEqual(initial, ['Retrato']);
  assert.deepEqual(added, ['Retrato', 'Paisagem']);
  assert.equal(hasTag(added, 'paisagem'), true);

  const removed = togglePhotoTag(added, 'retrato');
  assert.deepEqual(removed, ['Paisagem']);
});

test('addTagToList enforces length, uniqueness, and max limit rules', () => {
  const tooShort = addTagToList([], 'X');
  assert.equal(tooShort.ok, false);

  const duplicate = addTagToList(['Artístico'], 'artístico');
  assert.equal(duplicate.ok, false);

  const fullList = Array.from({ length: MAX_TAGS_PER_PHOTO }, (_, i) => `Tag ${i + 1}`);
  const overflow = addTagToList(fullList, 'Extra');
  assert.equal(overflow.ok, false);

  const valid = addTagToList(['Retrato'], '  Campanha  Verão ');
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.addedTag, 'Campanha Verão');
    assert.deepEqual(valid.tags, ['Retrato', 'Campanha Verão']);
  }
});

test('getTagCounts aggregates preset and custom tags plus untagged photos', () => {
  const stats = getTagCounts([
    { tags: ['Retrato', 'Campanha'] },
    { tags: ['retrato', 'Artístico'] },
    { tags: [] },
    {},
  ]);

  assert.equal(stats.untaggedCount, 2);
  assert.equal(stats.countsByTag['Retrato'], 2);
  assert.equal(stats.countsByTag['Artístico'], 1);
  assert.equal(stats.countsByTag['Paisagem'], 0);
  assert.equal(stats.countsByTag['Campanha'], 1);
  for (const preset of PRESET_PHOTO_TAGS) {
    assert.ok(stats.availableTags.includes(preset));
  }
  assert.ok(stats.availableTags.includes('Campanha'));
});
