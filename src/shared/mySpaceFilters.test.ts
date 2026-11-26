import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyBatchFilterToMap,
  extractPromptHistoryEntries,
  filterMySpacePhotos,
} from './mySpaceFilters';
import type { FolderItem } from './photoFolders';

const FOLDERS: FolderItem[] = [
  { id: 'fld-1', name: 'Viagens Europa' },
  { id: 'fld-2', name: 'LinkedIn Executivo' },
];

const PHOTOS = [
  {
    id: 'p1',
    scenarioId: 'dubai',
    scenarioTitle: 'Pôr do sol em Dubai',
    categoryId: 'luxo',
    categoryName: 'Luxo e riqueza',
    promptUsed: 'Terno escuro em cobertura de Dubai com luz dourada',
    mode: 'preset' as const,
    url: '/media/generated/p1.jpg',
    favorite: true,
    folderId: 'fld-1',
    tags: ['Paisagem', 'Artístico'],
    createdAt: '2026-11-20T12:00:00.000Z',
  },
  {
    id: 'p2',
    scenarioTitle: 'Retrato Corporativo',
    categoryId: 'profissoes',
    categoryName: 'Profissões',
    promptUsed: 'Blazer azul marinho fundo escritório minimalista',
    mode: 'free' as const,
    url: '/media/generated/p2.jpg',
    favorite: false,
    folderId: 'fld-2',
    tags: ['Retrato'],
    createdAt: '2026-11-01T12:00:00.000Z',
  },
];

test('filterMySpacePhotos matches by folder name, prompt keywords, scenario title, and tags', () => {
  const byFolderName = filterMySpacePhotos(PHOTOS, {
    searchQuery: 'europa',
    categoryFilter: 'all',
    folderFilter: 'all',
    dateFilter: 'all',
    onlyFavorites: false,
    folders: FOLDERS,
    nowMs: new Date('2026-11-25T12:00:00.000Z').getTime(),
  });
  assert.deepEqual(
    byFolderName.map((p) => p.id),
    ['p1']
  );

  const byPromptKeyword = filterMySpacePhotos(PHOTOS, {
    searchQuery: 'blazer azul',
    categoryFilter: 'all',
    folderFilter: 'all',
    dateFilter: 'all',
    onlyFavorites: false,
    folders: FOLDERS,
    nowMs: new Date('2026-11-25T12:00:00.000Z').getTime(),
  });
  assert.deepEqual(
    byPromptKeyword.map((p) => p.id),
    ['p2']
  );

  const byTagFilter = filterMySpacePhotos(PHOTOS, {
    searchQuery: '',
    categoryFilter: 'all',
    folderFilter: 'all',
    tagFilter: 'artístico',
    dateFilter: 'all',
    onlyFavorites: false,
    folders: FOLDERS,
    nowMs: new Date('2026-11-25T12:00:00.000Z').getTime(),
  });
  assert.deepEqual(
    byTagFilter.map((p) => p.id),
    ['p1']
  );

  const byTagSearch = filterMySpacePhotos(PHOTOS, {
    searchQuery: 'paisagem',
    categoryFilter: 'all',
    folderFilter: 'all',
    dateFilter: 'all',
    onlyFavorites: false,
    folders: FOLDERS,
    nowMs: new Date('2026-11-25T12:00:00.000Z').getTime(),
  });
  assert.deepEqual(
    byTagSearch.map((p) => p.id),
    ['p1']
  );
});

test('applyBatchFilterToMap applies a filter to all selected ids and clears original entries', () => {
  const step1 = applyBatchFilterToMap({ p3: 'vintage' }, ['p1', 'p2'], 'cinematic');
  assert.deepEqual(step1, {
    p3: 'vintage',
    p1: 'cinematic',
    p2: 'cinematic',
  });

  const step2 = applyBatchFilterToMap(step1, ['p1'], 'original');
  assert.deepEqual(step2, {
    p3: 'vintage',
    p2: 'cinematic',
  });
});

test('extractPromptHistoryEntries sorts newest first and preserves folder names and recreate URLs', () => {
  const entries = extractPromptHistoryEntries(PHOTOS, FOLDERS);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].id, 'p1');
  assert.equal(entries[0].folderName, 'Viagens Europa');
  assert.equal(entries[0].recreateUrl, '/criar?cenario=dubai');
  assert.equal(entries[1].id, 'p2');
  assert.ok(entries[1].recreateUrl.startsWith('/criar?modo=livre&prompt='));
});
