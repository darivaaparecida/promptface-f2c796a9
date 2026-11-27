import type { PlanId } from './catalog';

export type PreferredAiModelId =
  | 'auto'
  | 'gemini-3.1-flash-lite-image'
  | 'gemini-nano-banana-pro'
  | 'flux-pro/kontext/max';

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
    id: 'gemini-nano-banana-pro',
    label: 'Gemini Nano Banana Pro',
    shortLabel: 'Gemini Nano Banana Pro',
    badge: 'Máxima qualidade',
    description:
      'A maior qualidade de preservação facial e detalhes, incluída no plano Essencial (1K).',
    provider: 'gemini',
    highQuality: true,
  },
  {
    id: 'flux-pro/kontext/max',
    label: 'FLUX.1 Kontext Max',
    shortLabel: 'FLUX.1 Kontext Max',
    badge: 'Máxima qualidade',
    description:
      'O melhor modelo para gerar e editar com o rosto preservado, incluído nos planos PRO e PREMIUM.',
    provider: 'fal-flux-kontext',
    highQuality: true,
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
// Modelo por plano — cada plano libera um tipo de IA (decisão 27/11/2026,
// provedor fal.ai; substitui o mapeamento de 26/11/2026).
// Teste grátis: FLUX.1 Kontext Max SÓ 1 vez por conta (10 créditos) e depois
// Nano Banana 2 Lite. Na prática, o "só 1 vez" já é garantido pelo saldo:
// o cadastro dá 10 créditos, ou seja, 1 geração de 10 créditos; depois
// disso o usuário fica sem saldo até assinar. A trava explícita por flag
// (free_max_used_at) entra com a geração na Fase 2.
// Essencial: Nano Banana Pro (o melhor Nano Banana), 1K. PRO e PREMIUM:
// FLUX.1 Kontext Max. O "Automático" resolve para o modelo do plano.
// A geração (Fase 2) DEVE usar resolveEffectiveModel para decidir o modelo
// — nunca confie só no valor salvo no navegador.
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
    allowed: ['flux-pro/kontext/max', 'gemini-3.1-flash-lite-image'],
    autoModel: 'flux-pro/kontext/max',
  },
  essencial: {
    allowed: ['gemini-nano-banana-pro'],
    autoModel: 'gemini-nano-banana-pro',
  },
  pro: {
    allowed: ['flux-pro/kontext/max'],
    autoModel: 'flux-pro/kontext/max',
  },
  premium: {
    allowed: ['flux-pro/kontext/max'],
    autoModel: 'flux-pro/kontext/max',
  },
};

/** 'auto' + os modelos explícitos liberados para o plano. */
export function getAllowedPreferredModels(planId: PlanId): PreferredAiModelId[] {
  const access = PLAN_MODEL_ACCESS[planId] ?? PLAN_MODEL_ACCESS.free_trial;
  return ['auto', ...access.allowed];
}

/** Resolução máxima (decisão 27/11/2026): 1K para todos os planos por enquanto; a resolução máxima do Kontext Max será confirmada na Fase 2. */
export function getMaxResolutionForPlanModel(
  _planId: PlanId,
  _model: PreferredAiModelId
): PlanModelResolution {
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
