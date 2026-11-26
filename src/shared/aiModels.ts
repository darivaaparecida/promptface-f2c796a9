import type { PlanId } from './catalog';

export type PreferredAiModelId =
  | 'auto'
  | 'gemini-3.1-flash-lite-image'
  | 'gemini-nano-banana-2.1'
  | 'gemini-nano-banana-pro'
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
      'Usa automaticamente o modelo incluído no seu plano, sem custo extra.',
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
    id: 'gemini-nano-banana-pro',
    label: 'Gemini Nano Banana Pro',
    shortLabel: 'Gemini Nano Banana Pro',
    badge: 'Máxima qualidade',
    description:
      'A maior qualidade de preservação facial e detalhes, incluída no plano PREMIUM (até 2K).',
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

// ---------------------------------------------------------------------------
// Modelo por plano — cada plano libera um tipo de IA (decisão 26/11/2026).
// Cada modelo tem um custo diferente por foto (ex.: Nano Banana Pro custa
// ~4x o Nano Banana 2.1 e ~7x em 4K), então a escolha livre daria prejuízo e
// tiraria o motivo de existir o plano mais caro. O "Automático" resolve para
// o modelo do plano. A geração (Fase 2) DEVE usar resolveEffectiveModel para
// decidir o modelo — nunca confie só no valor salvo no navegador.
// ---------------------------------------------------------------------------

export type PlanModelResolution = '1K' | '2K';

export interface PlanModelAccess {
  /** Escolhas explícitas liberadas além de 'auto'. */
  allowed: readonly PreferredAiModelId[];
  /** Modelo concreto usado quando a preferência é 'auto'. */
  autoModel: PreferredAiModelId;
}

export const PLAN_MODEL_ACCESS: Record<PlanId, PlanModelAccess> = {
  free_trial: {
    allowed: ['gemini-3.1-flash-lite-image'],
    autoModel: 'gemini-3.1-flash-lite-image',
  },
  essencial: {
    allowed: ['gemini-nano-banana-2.1'],
    autoModel: 'gemini-nano-banana-2.1',
  },
  pro: {
    allowed: ['gemini-nano-banana-2.1'],
    autoModel: 'gemini-nano-banana-2.1',
  },
  premium: {
    allowed: ['gemini-nano-banana-pro', 'flux-pro/kontext'],
    autoModel: 'gemini-nano-banana-pro',
  },
};

/** 'auto' + os modelos explícitos liberados para o plano. */
export function getAllowedPreferredModels(planId: PlanId): PreferredAiModelId[] {
  const access = PLAN_MODEL_ACCESS[planId] ?? PLAN_MODEL_ACCESS.free_trial;
  return ['auto', ...access.allowed];
}

/** Resolução máxima: Pro só vai até 2K (em 4K o custo inviabiliza o plano). */
export function getMaxResolutionForPlanModel(
  planId: PlanId,
  model: PreferredAiModelId
): PlanModelResolution {
  if (model === 'gemini-nano-banana-pro') return '2K';
  if (
    (planId === 'pro' || planId === 'premium') &&
    model === 'gemini-nano-banana-2.1'
  ) {
    return '2K';
  }
  return '1K';
}

/**
 * Modelo efetivo para gerar: resolve 'auto' para o modelo do plano e ignora
 * qualquer preferência fora do plano (ex.: Pro salvo por quem era PREMIUM e
 * hoje é Essencial volta para o modelo do plano atual).
 */
export function resolveEffectiveModel(
  planId: PlanId,
  preferredModel: unknown
): {
  model: PreferredAiModelId;
  maxResolution: PlanModelResolution;
  preferFal: boolean;
  highQuality: boolean;
} {
  const access = PLAN_MODEL_ACCESS[planId] ?? PLAN_MODEL_ACCESS.free_trial;
  const normalized = normalizePreferredAiModel(preferredModel);
  const chosen =
    normalized === 'auto' || !access.allowed.includes(normalized)
      ? access.autoModel
      : normalized;
  const option = getPreferredAiModelOption(chosen);
  return {
    model: chosen,
    maxResolution: getMaxResolutionForPlanModel(planId, chosen),
    preferFal: option.provider === 'fal-flux-kontext',
    highQuality: option.highQuality,
  };
}
