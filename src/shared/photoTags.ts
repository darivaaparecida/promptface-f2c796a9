export const PRESET_PHOTO_TAGS = [
  'Retrato',
  'Paisagem',
  'Artístico',
  'Editorial',
  'Corporativo',
  'Urbano',
  'Viagem',
  'Noturno',
] as const;

export const MAX_TAGS_PER_PHOTO = 8;
export const MAX_TAG_LENGTH = 24;

export function normalizeTagName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  if (cleaned.length < 2 || cleaned.length > MAX_TAG_LENGTH) return null;
  return cleaned;
}

export function normalizeTagList(rawTags: unknown): string[] {
  if (!Array.isArray(rawTags)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of rawTags) {
    const normalized = normalizeTagName(item);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
    if (out.length >= MAX_TAGS_PER_PHOTO) break;
  }
  return out;
}

export function hasTag(tags: string[] | undefined, targetTag: string): boolean {
  const normalizedTarget = normalizeTagName(targetTag);
  if (!normalizedTarget || !Array.isArray(tags)) return false;
  const key = normalizedTarget.toLowerCase();
  return tags.some((t) => t.trim().toLowerCase() === key);
}

export function togglePhotoTag(
  currentTags: string[] | undefined,
  rawTag: string
): string[] {
  const normalized = normalizeTagName(rawTag);
  const existing = normalizeTagList(currentTags ?? []);
  if (!normalized) return existing;

  const key = normalized.toLowerCase();
  if (existing.some((t) => t.toLowerCase() === key)) {
    return existing.filter((t) => t.toLowerCase() !== key);
  }
  if (existing.length >= MAX_TAGS_PER_PHOTO) {
    return existing;
  }
  return [...existing, normalized];
}

export function addTagToList(
  currentTags: string[] | undefined,
  rawTag: string
): { ok: true; tags: string[]; addedTag: string } | { ok: false; error: string } {
  if (typeof rawTag !== 'string' || !rawTag.trim()) {
    return { ok: false, error: 'Informe um nome para a tag.' };
  }
  const cleaned = rawTag.trim().replace(/\s+/g, ' ');
  if (cleaned.length < 2) {
    return { ok: false, error: 'A tag precisa ter pelo menos 2 caracteres.' };
  }
  if (cleaned.length > MAX_TAG_LENGTH) {
    return {
      ok: false,
      error: `A tag pode ter no máximo ${MAX_TAG_LENGTH} caracteres.`,
    };
  }

  const existing = normalizeTagList(currentTags ?? []);
  const key = cleaned.toLowerCase();
  if (existing.some((t) => t.toLowerCase() === key)) {
    return { ok: false, error: 'Esta foto já possui essa tag.' };
  }
  if (existing.length >= MAX_TAGS_PER_PHOTO) {
    return {
      ok: false,
      error: `Cada foto pode ter no máximo ${MAX_TAGS_PER_PHOTO} tags.`,
    };
  }

  return {
    ok: true,
    tags: [...existing, cleaned],
    addedTag: cleaned,
  };
}

export interface TagStatsSummary {
  availableTags: string[];
  countsByTag: Record<string, number>;
  untaggedCount: number;
}

export function getTagCounts(
  generations: Array<{ tags?: string[] }>,
  presetTags: readonly string[] = PRESET_PHOTO_TAGS
): TagStatsSummary {
  const canonicalByLower = new Map<string, string>();
  const countsByTag: Record<string, number> = {};

  for (const preset of presetTags) {
    canonicalByLower.set(preset.toLowerCase(), preset);
    countsByTag[preset] = 0;
  }

  let untaggedCount = 0;
  for (const g of generations) {
    const cleanTags = normalizeTagList(g.tags ?? []);
    if (cleanTags.length === 0) {
      untaggedCount += 1;
      continue;
    }
    for (const tag of cleanTags) {
      const lower = tag.toLowerCase();
      let canonical = canonicalByLower.get(lower);
      if (!canonical) {
        canonical = tag;
        canonicalByLower.set(lower, canonical);
        countsByTag[canonical] = 0;
      }
      countsByTag[canonical] = (countsByTag[canonical] || 0) + 1;
    }
  }

  const availableTags = Array.from(canonicalByLower.values());
  return { availableTags, countsByTag, untaggedCount };
}
