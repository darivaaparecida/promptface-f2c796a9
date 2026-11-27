import type { PlanId } from './catalog';
import { CREDIT_COSTS } from './rules';

export type PreferredAiModelId =
  | 'auto'
  | 'gemini-nano-banana-2.1'
  | 'gemini-nano-banana-pro';

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
    id: 'gemini-nano-banana-2.1',
    label: 'Gemini Nano Banana 2.1',
    shortLabel: 'Gemini Nano Banana 2.1',
    badge: 'Padrão',
    description:
      'O modelo padrão de geração: ótima preservação facial com o melhor custo por foto (10 créditos).',
    provider: 'gemini',
    highQuality: true,
  },
  {
    id: 'gemini-nano-banana-pro',
    label: 'Gemini Nano Banana Pro',
    shortLabel: 'Gemini Nano Banana Pro',
    badge: 'Máxima qualidade',
    description:
      'A maior qualidade de preservação facial e detalhes. Custa 20 créditos por foto.',
    provider: 'gemini',
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
// Modelo por plano — decisão 27/11/2026 (substitui o mapeamento fal.ai/Max
// do mesmo dia): o Nano Banana GERA as imagens e o FLUX Kontext fica só
// para EDIÇÃO no Studio. O 2.1 já serve demais e é o padrão em TODOS os
// planos (10 créditos por foto, teste grátis incluído); o Pro é uma opção
// paga — 20 créditos por foto — para quem quiser a máxima qualidade.
// O "Automático" resolve para o 2.1. A geração (Fase 2) DEVE usar
// resolveEffectiveModel para decidir o modelo e cobrar o custo certo —
// nunca confie só no valor salvo no navegador.
//
// Regra de saldo (27/11/2026): o Pro custa 20 créditos por foto, então só
// pode ser usado por quem tem saldo para pelo menos 1 foto Pro. Quem tem
// menos que isso cai para o 2.1 — nunca fica travado sem conseguir gerar.
// A UI (Perfil Visual) esconde/desabilita o Pro nesses casos, e o resolver
// abaixo é a trava final: passe o saldo em `credits` sempre que souber.
// ---------------------------------------------------------------------------

/** O Pro exige saldo suficiente para pelo menos 1 foto Pro (20 créditos). */
export function canUseProModel(credits: number | undefined | null): boolean {
  return (credits ?? 0) >= CREDIT_COSTS.generate_pro;
}

export type PlanModelResolution = '1K' | '2K';

export interface PlanModelAccess {
  /** Escolhas explícitas liberadas além de 'auto'. */
  allowed: readonly PreferredAiModelId[];
  /** Modelo concreto usado quando a preferência é 'auto'. */
  autoModel: PreferredAiModelId;
}

export const PLAN_MODEL_ACCESS: Record<PlanId, PlanModelAccess> = {
  free_trial: {
    allowed: ['gemini-nano-banana-2.1', 'gemini-nano-banana-pro'],
    autoModel: 'gemini-nano-banana-2.1',
  },
  essencial: {
    allowed: ['gemini-nano-banana-2.1', 'gemini-nano-banana-pro'],
    autoModel: 'gemini-nano-banana-2.1',
  },
  pro: {
    allowed: ['gemini-nano-banana-2.1', 'gemini-nano-banana-pro'],
    autoModel: 'gemini-nano-banana-2.1',
  },
  premium: {
    allowed: ['gemini-nano-banana-2.1', 'gemini-nano-banana-pro'],
    autoModel: 'gemini-nano-banana-2.1',
  },
};

/** 'auto' + os modelos explícitos liberados para o plano. */
export function getAllowedPreferredModels(planId: PlanId): PreferredAiModelId[] {
  const access = PLAN_MODEL_ACCESS[planId] ?? PLAN_MODEL_ACCESS.free_trial;
  return ['auto', ...access.allowed];
}

/** Resolução máxima: 1K para todos os planos por enquanto. */
export function getMaxResolutionForPlanModel(
  _planId: PlanId,
  _model: PreferredAiModelId
): PlanModelResolution {
  return '1K';
}

/**
 * Modelo efetivo para gerar: resolve 'auto' para o modelo do plano e ignora
 * qualquer preferência fora do plano (ex.: Pro salvo por quem era PREMIUM e
 * hoje é Essencial volta para o modelo do plano atual). Quando o saldo é
 * informado (`credits`) e não cobre 1 foto Pro, o Pro também cai para o
 * modelo do plano — o usuário nunca fica sem conseguir gerar.
 */
export function resolveEffectiveModel(
  planId: PlanId,
  preferredModel: unknown,
  credits?: number
): {
  model: PreferredAiModelId;
  maxResolution: PlanModelResolution;
  preferFal: boolean;
  highQuality: boolean;
} {
  const access = PLAN_MODEL_ACCESS[planId] ?? PLAN_MODEL_ACCESS.free_trial;
  const normalized = normalizePreferredAiModel(preferredModel);
  const affordable =
    credits === undefined ||
    normalized !== 'gemini-nano-banana-pro' ||
    canUseProModel(credits);
  const chosen =
    normalized === 'auto' || !access.allowed.includes(normalized) || !affordable
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
