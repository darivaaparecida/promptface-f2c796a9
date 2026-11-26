export function canCompareSelectedPhotos(selectedIds: string[]): boolean {
  return Array.isArray(selectedIds) && selectedIds.length === 2;
}

export function resolveComparisonPair<T extends { id: string }>(
  items: T[],
  selectedIds: string[]
): [T, T] | null {
  if (!canCompareSelectedPhotos(selectedIds) || !Array.isArray(items)) {
    return null;
  }
  const byId = new Map(items.map((item) => [item.id, item]));
  const first = byId.get(selectedIds[0]);
  const second = byId.get(selectedIds[1]);
  if (!first || !second || first.id === second.id) {
    return null;
  }
  return [first, second];
}

export function swapComparisonPair<T>(pair: [T, T]): [T, T] {
  return [pair[1], pair[0]];
}

export interface PromptComparisonSummary {
  arePromptsIdentical: boolean;
  sameScenario: boolean;
  sameModel: boolean;
  promptA: string;
  promptB: string;
}

export function summarizePhotoComparison(
  a: { promptUsed?: string; scenarioTitle: string; model?: string },
  b: { promptUsed?: string; scenarioTitle: string; model?: string }
): PromptComparisonSummary {
  const promptA = (a.promptUsed || a.scenarioTitle || '').trim();
  const promptB = (b.promptUsed || b.scenarioTitle || '').trim();

  return {
    arePromptsIdentical: promptA.toLowerCase() === promptB.toLowerCase(),
    sameScenario: a.scenarioTitle.trim().toLowerCase() === b.scenarioTitle.trim().toLowerCase(),
    sameModel: (a.model || '').trim().toLowerCase() === (b.model || '').trim().toLowerCase(),
    promptA: promptA || 'Prompt não informado',
    promptB: promptB || 'Prompt não informado',
  };
}
