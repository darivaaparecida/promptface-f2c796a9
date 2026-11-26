export interface SocialShareParams {
  scenarioTitle: string;
  categoryName?: string;
  appUrl?: string;
}

function normalizeHttpUrl(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin;
    }
    return null;
  } catch {
    return null;
  }
}

export function buildShareCaption({
  scenarioTitle,
  categoryName,
  appUrl,
}: SocialShareParams): string {
  const cleanTitle = scenarioTitle.trim() || 'Criação PromptFace';
  const cleanCategory = categoryName?.trim();
  const baseText = cleanCategory
    ? `Minha nova fotografia "${cleanTitle}" (${cleanCategory}) criada com IA no PromptFace.`
    : `Minha nova fotografia "${cleanTitle}" criada com IA no PromptFace.`;
  const safeUrl = normalizeHttpUrl(appUrl);
  return safeUrl ? `${baseText} ${safeUrl}` : baseText;
}

export function buildWhatsAppShareUrl(params: SocialShareParams): string {
  const text = buildShareCaption(params);
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

export function buildTwitterShareUrl(params: SocialShareParams): string {
  const captionWithoutUrl = buildShareCaption({
    scenarioTitle: params.scenarioTitle,
    categoryName: params.categoryName,
  });
  const search = new URLSearchParams({
    text: captionWithoutUrl,
  });
  const safeUrl = normalizeHttpUrl(params.appUrl);
  if (safeUrl) {
    search.set('url', safeUrl);
  }
  return `https://twitter.com/intent/tweet?${search.toString()}`;
}
