export interface FolderItem {
  id: string;
  name: string;
  createdAt?: string;
}

export const SUGGESTED_FOLDER_NAMES = [
  'Viagens',
  'Eventos',
  'Trabalho & LinkedIn',
  'Ensaios',
];

export const FOLDER_NAME_MAX_LENGTH = 32;

export function normalizeFolderName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/\s+/g, ' ').slice(0, FOLDER_NAME_MAX_LENGTH);
}

export function validateNewFolderName(
  folders: FolderItem[],
  rawName: unknown
): { ok: true; name: string } | { ok: false; error: string } {
  const name = normalizeFolderName(rawName);
  if (name.length < 2) {
    return {
      ok: false,
      error: 'Informe um nome de pasta com pelo menos 2 caracteres.',
    };
  }
  const key = name.toLowerCase();
  if (folders.some((f) => f.name.toLowerCase() === key)) {
    return {
      ok: false,
      error: 'Já existe uma pasta com esse nome.',
    };
  }
  return { ok: true, name };
}

export function validateRenameFolder(
  folders: FolderItem[],
  folderId: string,
  rawName: unknown
): { ok: true; name: string } | { ok: false; error: string } {
  if (!folders.some((f) => f.id === folderId)) {
    return { ok: false, error: 'Pasta não encontrada.' };
  }
  const name = normalizeFolderName(rawName);
  if (name.length < 2) {
    return {
      ok: false,
      error: 'Informe um nome de pasta com pelo menos 2 caracteres.',
    };
  }
  const key = name.toLowerCase();
  if (folders.some((f) => f.id !== folderId && f.name.toLowerCase() === key)) {
    return {
      ok: false,
      error: 'Já existe outra pasta com esse nome.',
    };
  }
  return { ok: true, name };
}

export function getFolderCounts(
  generations: { id: string; folderId?: string | null }[],
  folders: FolderItem[]
): {
  total: number;
  unfiled: number;
  byFolderId: Record<string, number>;
} {
  const validFolderIds = new Set(folders.map((f) => f.id));
  const byFolderId: Record<string, number> = {};
  for (const folder of folders) {
    byFolderId[folder.id] = 0;
  }

  let unfiled = 0;
  for (const item of generations) {
    if (item.folderId && validFolderIds.has(item.folderId)) {
      byFolderId[item.folderId] = (byFolderId[item.folderId] || 0) + 1;
    } else {
      unfiled += 1;
    }
  }

  return {
    total: generations.length,
    unfiled,
    byFolderId,
  };
}

export function filterGenerationsByFolder<T extends { id: string; folderId?: string | null }>(
  generations: T[],
  folderFilter: string,
  folders: FolderItem[] = []
): T[] {
  if (folderFilter === 'all') return generations;
  if (folderFilter === 'unfiled') {
    const validIds = folders.length > 0 ? new Set(folders.map((f) => f.id)) : null;
    return generations.filter(
      (g) => !g.folderId || (validIds !== null && !validIds.has(g.folderId))
    );
  }
  return generations.filter((g) => g.folderId === folderFilter);
}

export function applyFolderToGenerations<T extends { id: string; folderId?: string | null }>(
  generations: T[],
  targetIds: string[],
  folderId: string | null
): T[] {
  if (targetIds.length === 0) return generations;
  const targets = new Set(targetIds);
  return generations.map((g) => {
    if (!targets.has(g.id)) return g;
    if (!folderId) {
      const copy = { ...g };
      delete copy.folderId;
      return copy;
    }
    return { ...g, folderId };
  });
}

export function clearDeletedFolderFromGenerations<
  T extends { id: string; folderId?: string | null },
>(generations: T[], deletedFolderId: string): T[] {
  return generations.map((g) => {
    if (g.folderId !== deletedFolderId) return g;
    const copy = { ...g };
    delete copy.folderId;
    return copy;
  });
}
