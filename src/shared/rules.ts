import type { PreferredAiModelId } from './aiModels';

export const CREDIT_COSTS = {
  generate: 10,
  variation: 10,
  studio_edit: 10,
  enhance_prompt: 1,
} as const;

export const INITIAL_SIGNUP_CREDITS = 10;

export type CreditOperation = keyof typeof CREDIT_COSTS;

export interface VisualProfileData {
  eyeColor?: string;
  hairColorStyle?: string;
  hairType?: string;
  beardMustache?: string;
  skinTone?: string;
  facialFeatures?: string;
  heightBodyType?: string;
  otherCharacteristics?: string;
  preferredModel?: PreferredAiModelId;
}

export interface CreditReservationResult {
  ok: boolean;
  newBalance: number;
  reservedAmount: number;
  error?: string;
}

export function getOperationCost(operation: CreditOperation): number {
  return CREDIT_COSTS[operation];
}

export function canAffordOperation(balance: number, operation: CreditOperation): boolean {
  return Number.isFinite(balance) && balance >= CREDIT_COSTS[operation];
}

export function reserveCredits(balance: number, operation: CreditOperation): CreditReservationResult {
  const cost = CREDIT_COSTS[operation];
  if (!Number.isFinite(balance) || balance < cost) {
    return {
      ok: false,
      newBalance: Math.max(0, balance || 0),
      reservedAmount: 0,
      error: `Saldo insuficiente. Você precisa de ${cost} créditos para esta operação.`,
    };
  }
  return {
    ok: true,
    newBalance: balance - cost,
    reservedAmount: cost,
  };
}

export function refundCredits(balance: number, amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return balance;
  return balance + amount;
}

const BLOCKED_MODERATION_PATTERNS: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /\b(nude|nudez|pelad[ao]|despid[ao]|porn|porno|pornograf|sex[ou]al|er[oó]tic[ao]|lingerie expl[ií]cit|hentai|nsfw)\b/i,
    reason: 'Conteúdo sexual ou nudez não é permitido no PromptFace.',
  },
  {
    pattern: /\b(gore|decapit|sangue|assassinat|viol[êe]ncia extrema|armas? apontad|tortura|suic[ií]dio|automutila)\b/i,
    reason: 'Conteúdo violento ou perigoso não é permitido.',
  },
  {
    pattern: /\b(deepfake|se passar por|falsifica[çc][ãa]o|documento falso|identidade falsa|passaporte falso|cnh falsa|fraude banc|golpe)\b/i,
    reason: 'Falsificação de identidade, fraude ou deepfake prejudicial é estritamente proibido.',
  },
  {
    pattern: /\b(campanha eleitoral|urna|propaganda pol[ií]tica enganosa|com[ií]cio falso|candidato|pol[ií]tico discursando)\b/i,
    reason: 'Uso político enganoso não é permitido.',
  },
  {
    pattern: /\b(celebridade|famoso|presidente|atriz|ator de hollywood|elon musk|neymar|anitta|taylor swift|lula|bolsonaro)\b/i,
    reason: 'O PromptFace é exclusivo para o seu próprio rosto — não é permitido gerar terceiros ou figuras públicas.',
  },
];

export interface ModerationResult {
  allowed: boolean;
  reason?: string;
}

export function moderatePrompt(text: string): ModerationResult {
  const normalized = (text || '').trim();
  if (!normalized) {
    return { allowed: false, reason: 'Descreva o cenário desejado antes de continuar.' };
  }
  if (normalized.length > 2000) {
    return { allowed: false, reason: 'A descrição deve ter no máximo 2.000 caracteres.' };
  }
  for (const rule of BLOCKED_MODERATION_PATTERNS) {
    if (rule.pattern.test(normalized)) {
      return { allowed: false, reason: rule.reason };
    }
  }
  return { allowed: true };
}

export function buildGenerationPrompt(params: {
  mode: 'preset' | 'free';
  scenarioTitle?: string;
  baseDescription: string;
  outfit?: string;
  environment?: string;
  pose?: string;
  lighting?: string;
  style?: string;
  aspectRatio?: string;
  visualProfile?: VisualProfileData | null;
}): string {
  const parts: string[] = [];

  if (params.mode === 'preset' && params.scenarioTitle) {
    parts.push(`Cenário: ${params.scenarioTitle}.`);
  }
  parts.push(`Descrição principal: ${params.baseDescription.trim()}.`);

  if (params.outfit?.trim()) parts.push(`Roupa e estilo de vestir: ${params.outfit.trim()}.`);
  if (params.environment?.trim()) parts.push(`Ambiente e fundo: ${params.environment.trim()}.`);
  if (params.pose?.trim()) parts.push(`Pose e expressão: ${params.pose.trim()}.`);
  if (params.lighting?.trim()) parts.push(`Iluminação: ${params.lighting.trim()}.`);
  if (params.style?.trim()) parts.push(`Estilo fotográfico: ${params.style.trim()}.`);
  if (params.aspectRatio?.trim()) parts.push(`Enquadramento / proporção: ${params.aspectRatio.trim()}.`);

  const vp = params.visualProfile;
  if (vp) {
    const profileDetails = [
      vp.eyeColor ? `olhos ${vp.eyeColor}` : '',
      vp.hairColorStyle ? `cabelo ${vp.hairColorStyle}` : '',
      vp.hairType ? `tipo de cabelo ${vp.hairType}` : '',
      vp.beardMustache ? `barba/bigode ${vp.beardMustache}` : '',
      vp.skinTone ? `tom de pele ${vp.skinTone}` : '',
      vp.facialFeatures ? `traços faciais ${vp.facialFeatures}` : '',
      vp.heightBodyType ? `porte físico ${vp.heightBodyType}` : '',
      vp.otherCharacteristics ? `${vp.otherCharacteristics}` : '',
    ].filter(Boolean);

    if (profileDetails.length > 0) {
      parts.push(`Características do Perfil Visual da pessoa: ${profileDetails.join(', ')}.`);
    }
  }

  parts.push(
    'Instrução obrigatória de realismo e identidade: fotografia profissional realista, luz natural, pele real com textura, sem aparência de desenho ou CGI, preserve exatamente o rosto da referência.'
  );

  return parts.join(' ');
}

export function filterScenarios<
  T extends { categoryId: string; title: string; description: string; categoryName: string; active?: boolean }
>(scenarios: T[], categoryId: string, searchQuery: string): T[] {
  const q = searchQuery.trim().toLowerCase();
  return scenarios.filter((item) => {
    if (item.active === false) return false;
    if (categoryId !== 'all' && item.categoryId !== categoryId) return false;
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.categoryName.toLowerCase().includes(q)
    );
  });
}
