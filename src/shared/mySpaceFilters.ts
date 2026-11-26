import type { ArtisticFilterId } from './artisticFilters';
import { filterGenerationsByFolder, type FolderItem } from './photoFolders';
import { hasTag, normalizeTagList } from './photoTags';

export interface FilterablePhotoItem {
  id: string;
  scenarioId?: string;
  scenarioTitle: string;
  categoryId: string;
  categoryName: string;
  promptUsed?: string;
  mode?: 'preset' | 'free' | 'variation';
  url: string;
  favorite: boolean;
  folderId?: string;
  tags?: string[];
  createdAt: string;
}

export interface PhotoSearchFilterOptions {
  searchQuery: string;
  categoryFilter: string;
  folderFilter: string;
  tagFilter?: string;
  dateFilter: 'all' | '7d' | '30d';
  onlyFavorites: boolean;
  folders: FolderItem[];
  nowMs?: number;
}

export interface PromptHistoryEntry {
  id: string;
  scenarioTitle: string;
  categoryName: string;
  folderName: string | null;
  promptUsed: string;
  mode: 'preset' | 'free' | 'variation';
  url: string;
  recreateUrl: string;
  createdAt: string;
}

export function buildPhotoRecreateUrl(item: {
  mode?: 'preset' | 'free' | 'variation';
  scenarioId?: string;
  promptUsed?: string;
  scenarioTitle: string;
}): string {
  if (item.mode === 'free' || !item.scenarioId) {
    const promptParam = encodeURIComponent(item.promptUsed || item.scenarioTitle);
    return `/criar?modo=livre&prompt=${promptParam}`;
  }
  return `/criar?cenario=${encodeURIComponent(item.scenarioId)}`;
}

export function filterMySpacePhotos<T extends FilterablePhotoItem>(
  generations: T[],
  options: PhotoSearchFilterOptions
): T[] {
  const now = options.nowMs ?? Date.now();
  const q = options.searchQuery.trim().toLowerCase();
  const activeTagFilter = options.tagFilter?.trim() || 'all';
  const folderNameById = new Map<string, string>();
  for (const folder of options.folders) {
    folderNameById.set(folder.id, folder.name.toLowerCase());
  }

  const folderMatched = filterGenerationsByFolder(
    generations,
    options.folderFilter,
    options.folders
  );

  return folderMatched.filter((g) => {
    if (options.onlyFavorites && !g.favorite) return false;
    if (options.categoryFilter !== 'all' && g.categoryId !== options.categoryFilter) {
      return false;
    }
    const cleanTags = normalizeTagList(g.tags ?? []);
    if (activeTagFilter === 'untagged') {
      if (cleanTags.length > 0) return false;
    } else if (activeTagFilter !== 'all') {
      if (!hasTag(cleanTags, activeTagFilter)) return false;
    }
    if (options.dateFilter !== 'all') {
      const ageDays = (now - new Date(g.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      if (options.dateFilter === '7d' && ageDays > 7) return false;
      if (options.dateFilter === '30d' && ageDays > 30) return false;
    }
    if (!q) return true;

    const folderName = g.folderId ? folderNameById.get(g.folderId) ?? '' : '';
    const matchesTag = cleanTags.some((tag) => tag.toLowerCase().includes(q));
    return (
      g.scenarioTitle.toLowerCase().includes(q) ||
      g.categoryName.toLowerCase().includes(q) ||
      (g.promptUsed?.toLowerCase().includes(q) ?? false) ||
      folderName.includes(q) ||
      matchesTag
    );
  });
}

export function applyBatchFilterToMap(
  current: Record<string, ArtisticFilterId>,
  targetIds: string[],
  filterId: ArtisticFilterId
): Record<string, ArtisticFilterId> {
  if (targetIds.length === 0) return current;
  const next: Record<string, ArtisticFilterId> = { ...current };
  for (const id of targetIds) {
    if (filterId === 'original') {
      delete next[id];
    } else {
      next[id] = filterId;
    }
  }
  return next;
}

export function extractPromptHistoryEntries(
  generations: FilterablePhotoItem[],
  folders: FolderItem[],
  searchQuery = ''
): PromptHistoryEntry[] {
  const folderById = new Map(folders.map((f) => [f.id, f.name]));
  const q = searchQuery.trim().toLowerCase();

  return generations
    .map((g) => {
      const promptUsed = (g.promptUsed || '').trim() || g.scenarioTitle;
      const folderName = g.folderId ? folderById.get(g.folderId) ?? null : null;
      return {
        id: g.id,
        scenarioTitle: g.scenarioTitle,
        categoryName: g.categoryName,
        folderName,
        promptUsed,
        mode: g.mode ?? 'preset',
        url: g.url,
        recreateUrl: buildPhotoRecreateUrl(g),
        createdAt: g.createdAt,
      };
    })
    .filter((entry) => {
      if (!q) return true;
      return (
        entry.promptUsed.toLowerCase().includes(q) ||
        entry.scenarioTitle.toLowerCase().includes(q) ||
        entry.categoryName.toLowerCase().includes(q) ||
        (entry.folderName?.toLowerCase().includes(q) ?? false)
      );
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
