import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canCompareSelectedPhotos,
  resolveComparisonPair,
  summarizePhotoComparison,
  swapComparisonPair,
} from './photoCompare';

test('canCompareSelectedPhotos is true only when exactly 2 photos are selected', () => {
  assert.equal(canCompareSelectedPhotos([]), false);
  assert.equal(canCompareSelectedPhotos(['a']), false);
  assert.equal(canCompareSelectedPhotos(['a', 'b']), true);
  assert.equal(canCompareSelectedPhotos(['a', 'b', 'c']), false);
});

test('resolveComparisonPair returns ordered pair and rejects invalid or duplicate ids', () => {
  const items = [
    { id: 'p1', scenarioTitle: 'Milão', promptUsed: 'Editorial Milão' },
    { id: 'p2', scenarioTitle: 'Paris', promptUsed: 'Café em Paris' },
    { id: 'p3', scenarioTitle: 'Tóquio', promptUsed: 'Noite em Tóquio' },
  ];
  const pair = resolveComparisonPair(items, ['p3', 'p1']);
  assert.ok(pair);
  assert.equal(pair[0].id, 'p3');
  assert.equal(pair[1].id, 'p1');

  assert.equal(resolveComparisonPair(items, ['p1', 'p1']), null);
  assert.equal(resolveComparisonPair(items, ['p1', 'missing']), null);
  assert.equal(resolveComparisonPair(items, ['p1']), null);

  const swapped = swapComparisonPair(pair);
  assert.equal(swapped[0].id, 'p1');
  assert.equal(swapped[1].id, 'p3');
});

test('summarizePhotoComparison identifies identical vs varied prompts and models', () => {
  const diff = summarizePhotoComparison(
    { scenarioTitle: 'Milão', promptUsed: 'Luz dourada', model: 'gemini-3.1-flash-lite-image' },
    { scenarioTitle: 'Milão', promptUsed: 'Luz noturna neon', model: 'gemini-nano-banana-2.1' }
  );
  assert.equal(diff.arePromptsIdentical, false);
  assert.equal(diff.sameScenario, true);
  assert.equal(diff.sameModel, false);

  const same = summarizePhotoComparison(
    { scenarioTitle: 'Café', promptUsed: 'Luz da manhã', model: 'gemini-nano-banana-2.1' },
    { scenarioTitle: 'Café', promptUsed: 'luz da manhã', model: 'gemini-nano-banana-2.1' }
  );
  assert.equal(same.arePromptsIdentical, true);
  assert.equal(same.sameModel, true);
});
