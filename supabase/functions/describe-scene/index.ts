// PromptFace — describe-scene (Fase 3 do painel admin).
// Recebe a URL pública de uma foto de cena e devolve os campos estruturados
// do cenário (título, descrição, roupa, ambiente, pose, iluminação, estilo)
// descritos por visão (Gemini). A IA é instruída a descrever SÓ a cena —
// nunca o rosto ou a identidade da pessoa da foto: o rosto de quem vai
// gerar a foto sempre vem da foto de referência do cliente.
// Só admin pode chamar (role verificado na tabela users).
// Segredo necessário: GEMINI_API_KEY. O plano gratuito do Gemini basta —
// descrever foto é entrada de imagem, incluída no free tier, sem cartão.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Você descreve fotos de cena para um catálogo de fotografia com IA. Descreva APENAS a cena: roupa, ambiente, pose, iluminação e estilo fotográfico. NUNCA descreva o rosto, a identidade, a idade, o nome ou qualquer traço da pessoa da foto — a pessoa da foto é só um exemplo, e o rosto de quem vai gerar a foto sempre vem da foto de referência do cliente. Responda SOMENTE com JSON, em português, neste formato exato: {"title": "título curto do cenário", "description": "1 frase descrevendo a cena", "outfit": "roupa", "environment": "ambiente", "pose": "pose", "lighting": "iluminação", "style": "estilo fotográfico"}.`;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return jsonResponse({ error: 'GEMINI_API_KEY não configurada.' }, 500);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Não autenticado.' }, 401);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return jsonResponse({ error: 'Não autenticado.' }, 401);
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', userData.user.id)
      .single();
    if (profileError || (profile as { role?: string } | null)?.role !== 'admin') {
      return jsonResponse({ error: 'Só admin pode descrever cenas.' }, 403);
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const imageUrl = body.imageUrl;
    if (typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
      return jsonResponse({ error: 'imageUrl inválida.' }, 400);
    }
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) return jsonResponse({ error: 'Não foi possível baixar a imagem.' }, 400);
    const imageBytes = new Uint8Array(await imageRes.arrayBuffer());
    if (imageBytes.length > MAX_IMAGE_BYTES) {
      return jsonResponse({ error: 'Imagem muito grande (máximo 6 MB).' }, 400);
    }
    const mimeType = imageRes.headers.get('content-type') || 'image/jpeg';

    const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: SYSTEM_PROMPT },
              { inline_data: { mime_type: mimeType, data: toBase64(imageBytes) } },
            ],
          },
        ],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
      }),
    });
    if (!geminiRes.ok) {
      const detail = await geminiRes.text().catch(() => '');
      console.error('Gemini error', geminiRes.status, detail.slice(0, 500));
      return jsonResponse({ error: 'O Gemini não conseguiu descrever a foto. Tente de novo.' }, 502);
    }
    const geminiJson = await geminiRes.json();
    const text =
      geminiJson?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? '')
        .join('') ?? '';
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text);
    } catch {
      return jsonResponse({ error: 'A resposta da IA veio num formato inesperado. Tente de novo.' }, 502);
    }
    const result = {
      title: asText(parsed.title),
      description: asText(parsed.description),
      outfit: asText(parsed.outfit),
      environment: asText(parsed.environment),
      pose: asText(parsed.pose),
      lighting: asText(parsed.lighting),
      style: asText(parsed.style),
    };
    if (!result.title || !result.description) {
      return jsonResponse({ error: 'A IA não devolveu título e descrição. Tente de novo.' }, 502);
    }
    return jsonResponse(result);
  } catch (err) {
    console.error('describe-scene error', err);
    return jsonResponse({ error: 'Não foi possível descrever a foto. Tente de novo.' }, 500);
  }
});
