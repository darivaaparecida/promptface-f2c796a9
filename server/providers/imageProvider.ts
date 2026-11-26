import { GoogleGenAI, Type } from '@google/genai';
import {
  resolveGenerationModelPreference,
  type PreferredAiModelId,
} from '../../src/shared/aiModels.ts';

export interface ReferenceImagePart {
  base64: string;
  mimeType: string;
}

export interface FalRequestGate {
  tryAcquire: () => boolean;
  commit: () => Promise<void> | void;
  release: () => void;
}

export interface ImageGenerationResult {
  ok: boolean;
  notConfigured?: boolean;
  quotaExhausted?: boolean;
  base64?: string;
  mimeType?: string;
  provider: string;
  model: string;
  estimatedCostUsd: number;
  error?: string;
}

export interface FaceVerificationResult {
  valid: boolean;
  checkedByAi: boolean;
  reason?: string;
}

function getGeminiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || key === 'MY_GEMINI_API_KEY') return null;
  return key;
}

function getFalKey(): string | null {
  const key = process.env.FAL_API_KEY?.trim();
  return key || null;
}

export function isGeminiConfigured(): boolean {
  return Boolean(getGeminiKey());
}

export function isFalConfigured(): boolean {
  return Boolean(getFalKey());
}

export function isImageProviderConfigured(): boolean {
  return Boolean(getGeminiKey() || getFalKey());
}

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = getGeminiKey();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function classifyGeminiError(err: unknown): { notConfigured: boolean; message: string } {
  const raw = err instanceof Error ? err.message : String(err || '');
  const lower = raw.toLowerCase();

  if (
    lower.includes('api_key_invalid') ||
    lower.includes('permission_denied') ||
    lower.includes('limit: 0') ||
    lower.includes('free_tier')
  ) {
    return {
      notConfigured: true,
      message: 'Geração em breve — estamos ativando nossa infraestrutura de imagem.',
    };
  }
  if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return {
      notConfigured: false,
      message:
        'Nossos servidores de geração estão com alta demanda agora. Seus créditos foram estornados — tente novamente em instantes.',
    };
  }
  return {
    notConfigured: false,
    message: 'Não foi possível concluir sua solicitação agora. Seus créditos foram estornados automaticamente.',
  };
}

export async function enhancePromptWithAi(rawDescription: string): Promise<{
  ok: boolean;
  notConfigured?: boolean;
  enhancedPrompt?: string;
  error?: string;
}> {
  const ai = createGeminiClient();
  if (!ai) {
    if (getFalKey()) {
      return {
        ok: false,
        notConfigured: false,
        error:
          'A melhoria automática de descrição usa Gemini. Você pode ajustar o texto diretamente e gerar sua foto normalmente.',
      };
    }
    return {
      ok: false,
      notConfigured: true,
      error: 'Serviço de melhoria de descrição em ativação.',
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Reescreva e enriqueça a seguinte descrição de fotografia em português do Brasil para gerar uma foto ultra-realista preservando o rosto do usuário. Adicione detalhes de iluminação natural, lente fotográfica, composição, vestimenta e atmosfera sem alterar a intenção original e sem incluir termos de desenho, CGI ou 3D. Retorne APENAS o texto melhorado em um parágrafo fluido.\n\nDescrição original: ${rawDescription}`,
    });

    const text = response.text?.trim();
    if (!text) {
      return { ok: false, error: 'Não foi possível melhorar a descrição no momento.' };
    }
    return { ok: true, enhancedPrompt: text };
  } catch (err) {
    const classified = classifyGeminiError(err);
    return {
      ok: false,
      notConfigured: classified.notConfigured,
      error: classified.message,
    };
  }
}

export async function verifyUploadedFace(
  base64: string,
  mimeType: string
): Promise<FaceVerificationResult> {
  const ai = createGeminiClient();
  if (!ai) {
    // Structural check when Gemini is not configured yet
    return { valid: true, checkedByAi: false };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64.replace(/^data:image\/\w+;base64,/, ''),
              mimeType,
            },
          },
          {
            text: 'Analise esta foto enviada para cadastro de referência facial pessoal. Verifique: (1) Há um rosto humano real e claramente visível? (2) A imagem é segura e não contém nudez explícita ou conteúdo violento? Responda em JSON.',
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hasClearRealFace: { type: Type.BOOLEAN },
            isSafe: { type: Type.BOOLEAN },
            reasonPtBr: { type: Type.STRING },
          },
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}') as {
      hasClearRealFace?: boolean;
      isSafe?: boolean;
      reasonPtBr?: string;
    };

    if (parsed.isSafe === false) {
      return {
        valid: false,
        checkedByAi: true,
        reason: parsed.reasonPtBr || 'A imagem enviada viola nossas políticas de segurança.',
      };
    }
    if (parsed.hasClearRealFace === false) {
      return {
        valid: false,
        checkedByAi: true,
        reason:
          parsed.reasonPtBr ||
          'Não identificamos um rosto humano nítido na foto. Envie uma foto com boa iluminação e rosto visível.',
      };
    }
    return { valid: true, checkedByAi: true };
  } catch {
    return { valid: true, checkedByAi: false };
  }
}

async function generateWithGemini(params: {
  referenceImages: ReferenceImagePart[];
  prompt: string;
  aspectRatio: string;
  highQuality?: boolean;
}): Promise<ImageGenerationResult> {
  const ai = createGeminiClient();
  if (!ai) {
    return {
      ok: false,
      notConfigured: true,
      provider: 'gemini',
      model: 'gemini-3.1-flash-lite-image',
      estimatedCostUsd: 0,
    };
  }

  const model = params.highQuality ? 'gemini-nano-banana-2.1' : 'gemini-3.1-flash-lite-image';
  const validAspect = ['1:1', '3:4', '4:3', '9:16', '16:9'].includes(params.aspectRatio)
    ? params.aspectRatio
    : '3:4';

  const parts: Array<{ inlineData: { data: string; mimeType: string } } | { text: string }> =
    params.referenceImages.map((img) => ({
      inlineData: {
        data: img.base64.replace(/^data:image\/\w+;base64,/, ''),
        mimeType: img.mimeType,
      },
    }));

  parts.push({ text: params.prompt });

  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: validAspect,
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        return {
          ok: true,
          base64: part.inlineData.data,
          mimeType: part.inlineData.mimeType ?? 'image/png',
          provider: 'gemini',
          model,
          estimatedCostUsd: params.highQuality ? 0.06 : 0.039,
        };
      }
    }

    return {
      ok: false,
      provider: 'gemini',
      model,
      estimatedCostUsd: 0,
      error: 'O modelo não retornou uma imagem válida. Tente ajustar a descrição.',
    };
  } catch (err) {
    const classified = classifyGeminiError(err);
    return {
      ok: false,
      notConfigured: classified.notConfigured,
      provider: 'gemini',
      model,
      estimatedCostUsd: 0,
      error: classified.message,
    };
  }
}

async function generateWithFluxKontext(params: {
  referenceImages: ReferenceImagePart[];
  prompt: string;
  falGate?: FalRequestGate;
}): Promise<ImageGenerationResult> {
  const falKey = getFalKey();
  if (!falKey) {
    return {
      ok: false,
      notConfigured: true,
      provider: 'fal-flux-kontext',
      model: 'flux-pro/kontext',
      estimatedCostUsd: 0,
    };
  }

  if (params.falGate && !params.falGate.tryAcquire()) {
    return {
      ok: false,
      quotaExhausted: true,
      provider: 'fal-flux-kontext',
      model: 'flux-pro/kontext',
      estimatedCostUsd: 0,
      error:
        'Limite de proteção atingido: as imagens gratuitas configuradas na fal.ai já foram utilizadas para evitar qualquer cobrança.',
    };
  }

  const ref = params.referenceImages[0];
  const dataUri = `data:${ref.mimeType};base64,${ref.base64.replace(/^data:image\/\w+;base64,/, '')}`;

  try {
    const res = await fetch('https://fal.run/fal-ai/flux-pro/kontext', {
      method: 'POST',
      headers: {
        Authorization: `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: params.prompt,
        image_url: dataUri,
      }),
    });

    if (!res.ok) {
      if (res.status === 402 || res.status === 403) {
        return {
          ok: false,
          quotaExhausted: true,
          provider: 'fal-flux-kontext',
          model: 'flux-pro/kontext',
          estimatedCostUsd: 0,
          error:
            'A API da fal.ai exige saldo positivo em Créditos (as 12 imagens gratuitas do painel valem apenas no Playground do site da fal.ai). Nenhuma cobrança foi realizada e seus créditos do app foram estornados.',
        };
      }
      return {
        ok: false,
        provider: 'fal-flux-kontext',
        model: 'flux-pro/kontext',
        estimatedCostUsd: 0,
        error: `Fal.ai retornou status ${res.status}`,
      };
    }

    const json = (await res.json()) as { images?: Array<{ url: string; content_type?: string }> };
    const imageUrl = json.images?.[0]?.url;
    if (!imageUrl) {
      return {
        ok: false,
        provider: 'fal-flux-kontext',
        model: 'flux-pro/kontext',
        estimatedCostUsd: 0,
        error: 'Resposta sem imagem do provedor reserva.',
      };
    }

    // Commit free-allowance usage as soon as fal.ai returns a generated image
    if (params.falGate) {
      await params.falGate.commit();
    }

    const imgRes = await fetch(imageUrl);
    const arrayBuf = await imgRes.arrayBuffer();
    return {
      ok: true,
      base64: Buffer.from(arrayBuf).toString('base64'),
      mimeType: json.images?.[0]?.content_type ?? 'image/jpeg',
      provider: 'fal-flux-kontext',
      model: 'flux-pro/kontext',
      estimatedCostUsd: 0.04,
    };
  } catch (err) {
    return {
      ok: false,
      provider: 'fal-flux-kontext',
      model: 'flux-pro/kontext',
      estimatedCostUsd: 0,
      error: err instanceof Error ? err.message : 'Falha no provedor reserva.',
    };
  } finally {
    params.falGate?.release();
  }
}

export async function generatePortraitWithProvider(params: {
  referenceImages: ReferenceImagePart[];
  prompt: string;
  aspectRatio: string;
  highQuality?: boolean;
  preferredModel?: PreferredAiModelId;
  falGate?: FalRequestGate;
}): Promise<ImageGenerationResult> {
  const pref = resolveGenerationModelPreference(params.preferredModel, params.highQuality);

  if (pref.preferFal && getFalKey()) {
    const falFirst = await generateWithFluxKontext({
      referenceImages: params.referenceImages,
      prompt: params.prompt,
      falGate: params.falGate,
    });
    if (falFirst.ok || falFirst.quotaExhausted) return falFirst;
  }

  const geminiResult = await generateWithGemini({
    referenceImages: params.referenceImages,
    prompt: params.prompt,
    aspectRatio: params.aspectRatio,
    highQuality: pref.highQuality,
  });
  if (geminiResult.ok) return geminiResult;

  if (!pref.preferFal && getFalKey()) {
    const fallbackResult = await generateWithFluxKontext({
      referenceImages: params.referenceImages,
      prompt: params.prompt,
      falGate: params.falGate,
    });
    if (fallbackResult.ok || fallbackResult.quotaExhausted) return fallbackResult;
  }

  return geminiResult;
}

export async function editStudioImageWithProvider(params: {
  sourceImage: ReferenceImagePart;
  faceReferences: ReferenceImagePart[];
  instruction: string;
  preferredModel?: PreferredAiModelId;
  falGate?: FalRequestGate;
}): Promise<ImageGenerationResult> {
  const editPrompt = `Edite a primeira imagem aplicando exclusivamente esta alteração: "${params.instruction}". Preserve exatamente o rosto, identidade facial, feições, tom de pele e tudo que não foi solicitado para mudar. Use as demais fotos apenas como referência adicional da identidade facial da pessoa. Fotografia profissional realista, luz natural, pele real com textura, sem aparência de desenho ou CGI.`;

  const refs = [params.sourceImage, ...params.faceReferences.slice(0, 2)];
  return generatePortraitWithProvider({
    referenceImages: refs,
    prompt: editPrompt,
    aspectRatio: '3:4',
    highQuality: false,
    preferredModel: params.preferredModel,
    falGate: params.falGate,
  });
}
