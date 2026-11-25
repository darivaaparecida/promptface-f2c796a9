import { getArtisticFilter, type ArtisticFilterId } from './artisticFilters';

export interface ExifMetadataInput {
  scenarioTitle: string;
  categoryName: string;
  promptUsed?: string;
  createdAt: string;
  appliedFilterId?: ArtisticFilterId;
  aspectRatio?: string;
  mimeType?: string;
  mode?: 'preset' | 'free' | 'variation';
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

export function formatPhotoExifMetadata(input: ExifMetadataInput): FormattedExifMetadata {
  const filter = getArtisticFilter(input.appliedFilterId);
  const prompt = input.promptUsed?.trim() || input.scenarioTitle.trim() || 'Prompt não informado';
  const credits = typeof input.costCredits === 'number' ? input.costCredits : 10;

  return {
    prompt,
    createdAtFormatted: formatExifDate(input.createdAt),
    appliedFilterLabel: filter.label,
    appliedFilterId: filter.id,
    aspectRatio: input.aspectRatio?.trim() || '3:4',
    formatLabel: formatMimeLabel(input.mimeType),
    modeLabel: formatModeLabel(input.mode),
    categoryName: input.categoryName || 'Galeria',
    signatureLabel: input.synthIdMarked ? 'SynthID ativo' : 'PromptFace IA',
    costLabel: `${credits} crédito${credits === 1 ? '' : 's'}`,
  };
}
