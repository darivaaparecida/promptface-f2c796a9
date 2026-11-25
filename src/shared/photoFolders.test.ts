import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyFolderToGenerations,
  clearDeletedFolderFromGenerations,
  filterGenerationsByFolder,
  getFolderCounts,
  normalizeFolderName,
  validateNewFolderName,
  validateRenameFolder,
  type FolderItem,
} from './photoFolders.ts';

const sampleFolders: FolderItem[] = [
  { id: 'f1', name: 'Viagens' },
  { id: 'f2', name: 'Casamento Silva' },
];

test('normalizeFolderName trims, collapses spaces, and handles non-strings', () => {
  assert.equal(normalizeFolderName('   Viagem   Europa  '), 'Viagem Europa');
  assert.equal(normalizeFolderName('   '), '');
  assert.equal(normalizeFolderName(null), '');
  assert.equal(normalizeFolderName('A'.repeat(50)).length, 32);
});

test('validateNewFolderName enforces minimum length and case-insensitive uniqueness', () => {
  const shortRes = validateNewFolderName(sampleFolders, ' A ');
  assert.equal(shortRes.ok, false);

  const dupRes = validateNewFolderName(sampleFolders, 'viagens');
  assert.equal(dupRes.ok, false);

  const okRes = validateNewFolderName(sampleFolders, '  Formatura   2026 ');
  assert.deepEqual(okRes, { ok: true, name: 'Formatura 2026' });
});

test('validateRenameFolder validates target existence and avoids conflicts with other folders', () => {
  assert.equal(validateRenameFolder(sampleFolders, 'missing', 'Novo').ok, false);
  assert.equal(validateRenameFolder(sampleFolders, 'f1', 'casamento silva').ok, false);
  assert.deepEqual(validateRenameFolder(sampleFolders, 'f1', 'Viagens 2026'), {
    ok: true,
    name: 'Viagens 2026',
  });
});

test('getFolderCounts and filterGenerationsByFolder count and filter assigned, unfiled, and orphaned photos', () => {
  const gens = [
    { id: 'g1', folderId: 'f1' },
    { id: 'g2', folderId: 'f1' },
    { id: 'g3', folderId: 'f2' },
    { id: 'g4' },
    { id: 'g5', folderId: 'deleted-id' },
  ];

  const counts = getFolderCounts(gens, sampleFolders);
  assert.deepEqual(counts, {
    total: 5,
    unfiled: 2,
    byFolderId: { f1: 2, f2: 1 },
  });

  assert.equal(filterGenerationsByFolder(gens, 'all', sampleFolders).length, 5);
  assert.deepEqual(
    filterGenerationsByFolder(gens, 'f1', sampleFolders).map((g) => g.id),
    ['g1', 'g2']
  );
  assert.deepEqual(
    filterGenerationsByFolder(gens, 'unfiled', sampleFolders).map((g) => g.id),
    ['g4', 'g5']
  );
});

test('applyFolderToGenerations and clearDeletedFolderFromGenerations update assignments immutably', () => {
  const gens = [
    { id: 'g1', folderId: 'f1' },
    { id: 'g2' },
    { id: 'g3', folderId: 'f2' },
  ];

  const batchMoved = applyFolderToGenerations(gens, ['g1', 'g2'], 'f2');
  assert.equal(batchMoved[0].folderId, 'f2');
  assert.equal(batchMoved[1].folderId, 'f2');
  assert.equal(batchMoved[2].folderId, 'f2');

  const cleared = clearDeletedFolderFromGenerations(batchMoved, 'f2');
  assert.equal(cleared.every((g) => g.folderId === undefined), true);
});
