import { getArtisticFilter, type ArtisticFilterId } from './artisticFilters';

export interface ImageDimensionsInput {
  width: number;
  height: number;
}

export interface ExifMetadataInput {
  scenarioTitle: string;
  categoryName: string;
  promptUsed?: string;
  createdAt: string;
  appliedFilterId?: ArtisticFilterId;
  aspectRatio?: string;
  mimeType?: string;
  mode?: 'preset' | 'free' | 'variation';
  model?: string;
  provider?: string;
  dimensions?: ImageDimensionsInput | null;
  synthIdMarked?: boolean;
  costCredits?: number;
}

export interface FormattedExifMetadata {
  prompt: string;
  createdAtFormatted: string;
  appliedFilterLabel: string;
  appliedFilterId: ArtisticFilterId;
  aspectRatio: string;
  formatLabel: string;
  modeLabel: string;
  modelLabel: string;
  dimensionsLabel: string;
  categoryName: string;
  signatureLabel: string;
  costLabel: string;
}

export function formatExifDate(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return 'Data indisponível';
  }
  return parsed.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatMimeLabel(mimeType?: string): string {
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return 'JPEG';
  if (mimeType === 'image/webp') return 'WEBP';
  return 'PNG';
}

export function formatModeLabel(mode?: 'preset' | 'free' | 'variation'): string {
  if (mode === 'free') return 'Criação livre';
  if (mode === 'variation') return 'Variação';
  return 'Cenário pronto';
}

export function formatAiModelLabel(model?: string, provider?: string): string {
  const raw = (model || '').trim();
  const normalized = raw.toLowerCase();
  if (!raw) {
    if (provider?.toLowerCase() === 'fal') return 'FLUX Kontext Pro';
    return 'Gemini Image IA';
  }
  if (normalized === 'gemini-3.1-flash-lite-image') return 'Gemini 3.1 Flash Lite Image';
  if (normalized === 'gemini-2.5-flash-image') return 'Gemini 2.5 Flash Image';
  if (normalized === 'gemini-nano-banana-2.1') return 'Gemini Nano Banana 2.1';
  if (normalized.includes('flux-pro/kontext/max')) return 'FLUX.1 Kontext Max';
  if (normalized.includes('flux-pro/kontext')) return 'FLUX Pro Kontext';
  if (normalized.includes('flux')) return 'FLUX Kontext';
  return raw;
}

export function formatDimensionsLabel(
  dimensions?: ImageDimensionsInput | null,
  aspectRatio?: string
): string {
  if (
    dimensions &&
    Number.isFinite(dimensions.width) &&
    Number.isFinite(dimensions.height) &&
    dimensions.width > 0 &&
    dimensions.height > 0
  ) {
    return `${Math.round(dimensions.width)} × ${Math.round(dimensions.height)} px`;
  }
  const ratio = aspectRatio?.trim() || '3:4';
  return `Proporção ${ratio}`;
}

export function formatPhotoExifMetadata(input: ExifMetadataInput): FormattedExifMetadata {
  const filter = getArtisticFilter(input.appliedFilterId);
  const prompt = input.promptUsed?.trim() || input.scenarioTitle.trim() || 'Prompt não informado';
  const credits = typeof input.costCredits === 'number' ? input.costCredits : 10;
  const aspectRatio = input.aspectRatio?.trim() || '3:4';

  return {
    prompt,
    createdAtFormatted: formatExifDate(input.createdAt),
    appliedFilterLabel: filter.label,
    appliedFilterId: filter.id,
    aspectRatio,
    formatLabel: formatMimeLabel(input.mimeType),
    modeLabel: formatModeLabel(input.mode),
    modelLabel: formatAiModelLabel(input.model, input.provider),
    dimensionsLabel: formatDimensionsLabel(input.dimensions, aspectRatio),
    categoryName: input.categoryName || 'Galeria',
    signatureLabel: input.synthIdMarked ? 'SynthID ativo' : 'PromptFace IA',
    costLabel: `${credits} crédito${credits === 1 ? '' : 's'}`,
  };
}
