export type PreferredAiModelId =
  | 'auto'
  | 'gemini-3.1-flash-lite-image'
  | 'gemini-nano-banana-2.1'
  | 'flux-pro/kontext';

export interface AiModelOption {
  id: PreferredAiModelId;
  label: string;
  shortLabel: string;
  badge: string;
  description: string;
  provider: 'auto' | 'gemini' | 'fal-flux-kontext';
  highQuality: boolean;
}

export const DEFAULT_PREFERRED_AI_MODEL: PreferredAiModelId = 'auto';

export const PREFERRED_AI_MODELS: readonly AiModelOption[] = [
  {
    id: 'auto',
    label: 'Automático (Recomendado)',
    shortLabel: 'Automático',
    badge: 'Equilibrado',
    description:
      'Seleciona automaticamente o melhor motor disponível para preservar seu rosto com rapidez e consistência.',
    provider: 'auto',
    highQuality: false,
  },
  {
    id: 'gemini-3.1-flash-lite-image',
    label: 'Gemini 3.1 Flash Lite Image',
    shortLabel: 'Gemini 3.1 Flash Lite',
    badge: 'Mais rápido',
    description:
      'Ideal para testar vários cenários e variações de prompt em poucos segundos com iluminação natural.',
    provider: 'gemini',
    highQuality: false,
  },
  {
    id: 'gemini-nano-banana-2.1',
    label: 'Gemini Nano Banana 2.1',
    shortLabel: 'Gemini Nano Banana 2.1',
    badge: 'Alta definição',
    description:
      'Prioriza máxima textura de pele, nitidez de detalhes e acabamento fotográfico editorial.',
    provider: 'gemini',
    highQuality: true,
  },
  {
    id: 'flux-pro/kontext',
    label: 'FLUX Pro Kontext',
    shortLabel: 'FLUX Pro Kontext',
    badge: 'Alternativo',
    description:
      'Motor alternativo focado em preservação contextual quando ativo na conta (usa Gemini como reserva automática).',
    provider: 'fal-flux-kontext',
    highQuality: false,
  },
] as const;

const VALID_MODEL_IDS = new Set<string>(PREFERRED_AI_MODELS.map((m) => m.id));

export function normalizePreferredAiModel(value: unknown): PreferredAiModelId {
  if (typeof value !== 'string') return DEFAULT_PREFERRED_AI_MODEL;
  const trimmed = value.trim();
  if (VALID_MODEL_IDS.has(trimmed)) {
    return trimmed as PreferredAiModelId;
  }
  return DEFAULT_PREFERRED_AI_MODEL;
}

export function getPreferredAiModelOption(value: unknown): AiModelOption {
  const id = normalizePreferredAiModel(value);
  return (
    PREFERRED_AI_MODELS.find((m) => m.id === id) ?? PREFERRED_AI_MODELS[0]
  );
}

export function resolveGenerationModelPreference(
  preferredModel: unknown,
  overrideHighQuality?: boolean
): {
  preferredModel: PreferredAiModelId;
  highQuality: boolean;
  preferFal: boolean;
} {
  const normalized = normalizePreferredAiModel(preferredModel);
  const option = getPreferredAiModelOption(normalized);
  return {
    preferredModel: normalized,
    highQuality:
      typeof overrideHighQuality === 'boolean' && overrideHighQuality
        ? true
        : option.highQuality,
    preferFal: option.provider === 'fal-flux-kontext',
  };
}
