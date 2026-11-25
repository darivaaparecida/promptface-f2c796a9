export type ArtisticFilterId =
  | 'original'
  | 'bw'
  | 'vintage'
  | 'cinematic'
  | 'golden'
  | 'noir';

export type SocialExportFormatId = 'original' | 'stories' | 'instagram' | 'square';

export interface ArtisticFilterOption {
  id: ArtisticFilterId;
  label: string;
  cssClass: string;
  canvasFilter: string;
}

export interface SocialExportFormatOption {
  id: SocialExportFormatId;
  label: string;
  shortLabel: string;
  ratio: number | null;
  targetWidth: number | null;
  targetHeight: number | null;
}

export const ARTISTIC_FILTERS: ArtisticFilterOption[] = [
  {
    id: 'original',
    label: 'Original',
    cssClass: 'pf-filter-original',
    canvasFilter: 'none',
  },
  {
    id: 'bw',
    label: 'Preto e Branco',
    cssClass: 'pf-filter-bw',
    canvasFilter: 'grayscale(100%) contrast(1.15)',
  },
  {
    id: 'vintage',
    label: 'Vintage',
    cssClass: 'pf-filter-vintage',
    canvasFilter: 'sepia(55%) contrast(1.08) brightness(0.96) saturate(0.9)',
  },
  {
    id: 'cinematic',
    label: 'Cinematográfico',
    cssClass: 'pf-filter-cinematic',
    canvasFilter: 'contrast(1.2) saturate(1.15) brightness(0.93)',
  },
  {
    id: 'golden',
    label: 'Golden Hour',
    cssClass: 'pf-filter-golden',
    canvasFilter: 'sepia(22%) saturate(1.35) brightness(1.03) contrast(1.04)',
  },
  {
    id: 'noir',
    label: 'Noir Dramático',
    cssClass: 'pf-filter-noir',
    canvasFilter: 'grayscale(100%) contrast(1.4) brightness(0.9)',
  },
];

export const SOCIAL_EXPORT_FORMATS: SocialExportFormatOption[] = [
  {
    id: 'original',
    label: 'Formato original',
    shortLabel: 'Original',
    ratio: null,
    targetWidth: null,
    targetHeight: null,
  },
  {
    id: 'stories',
    label: 'Stories / Reels (9:16)',
    shortLabel: '9:16 Stories',
    ratio: 9 / 16,
    targetWidth: 1080,
    targetHeight: 1920,
  },
  {
    id: 'instagram',
    label: 'Feed Instagram (4:5)',
    shortLabel: '4:5 Feed',
    ratio: 4 / 5,
    targetWidth: 1080,
    targetHeight: 1350,
  },
  {
    id: 'square',
    label: 'Perfil / Quadrado (1:1)',
    shortLabel: '1:1 Perfil',
    ratio: 1,
    targetWidth: 1080,
    targetHeight: 1080,
  },
];

export function getArtisticFilter(id: ArtisticFilterId | undefined): ArtisticFilterOption {
  return ARTISTIC_FILTERS.find((f) => f.id === id) || ARTISTIC_FILTERS[0];
}

export function getSocialExportFormat(
  id: SocialExportFormatId | undefined
): SocialExportFormatOption {
  return SOCIAL_EXPORT_FORMATS.find((f) => f.id === id) || SOCIAL_EXPORT_FORMATS[0];
}

export function calculateCoverCropRect(
  sourceWidth: number,
  sourceHeight: number,
  targetRatio: number
): { sx: number; sy: number; sw: number; sh: number } {
  const srcRatio = sourceWidth / sourceHeight;
  if (Math.abs(srcRatio - targetRatio) < 0.001) {
    return { sx: 0, sy: 0, sw: sourceWidth, sh: sourceHeight };
  }
  if (srcRatio > targetRatio) {
    const sw = Math.round(sourceHeight * targetRatio);
    const sx = Math.round((sourceWidth - sw) / 2);
    return { sx, sy: 0, sw, sh: sourceHeight };
  }
  const sh = Math.round(sourceWidth / targetRatio);
  // Slight upward bias (35% from top) preserves faces/heads better in portrait crops
  const sy = Math.round((sourceHeight - sh) * 0.35);
  return { sx: 0, sy, sw: sourceWidth, sh };
}

export function buildDownloadFilename(
  scenarioTitle: string,
  fallbackId: string,
  filterId: ArtisticFilterId,
  ext: string,
  formatId: SocialExportFormatId = 'original'
): string {
  const slug = scenarioTitle
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const base = slug || fallbackId;
  const filterSuffix = filterId !== 'original' ? `-${filterId}` : '';
  const formatSuffix = formatId !== 'original' ? `-${formatId}` : '';
  return `promptface-${base}${filterSuffix}${formatSuffix}.${ext}`;
}

export function getExtensionFromMime(mimeType: string): 'jpg' | 'webp' | 'png' {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  return 'png';
}

export async function renderBlobWithArtisticFilter(
  sourceBlob: Blob,
  filterId: ArtisticFilterId,
  formatId: SocialExportFormatId = 'original'
): Promise<{ blob: Blob; ext: 'jpg' | 'webp' | 'png' }> {
  const filter = getArtisticFilter(filterId);
  const format = getSocialExportFormat(formatId);
  const needsFilter = filter.id !== 'original' && filter.canvasFilter !== 'none';
  const needsCrop = format.id !== 'original' && format.ratio !== null;

  if (!needsFilter && !needsCrop) {
    return {
      blob: sourceBlob,
      ext: getExtensionFromMime(sourceBlob.type),
    };
  }

  const objectUrl = URL.createObjectURL(sourceBlob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Falha ao processar imagem com filtro.'));
      el.src = objectUrl;
    });

    const natW = img.naturalWidth || img.width;
    const natH = img.naturalHeight || img.height;

    const crop =
      needsCrop && format.ratio
        ? calculateCoverCropRect(natW, natH, format.ratio)
        : { sx: 0, sy: 0, sw: natW, sh: natH };

    const canvas = document.createElement('canvas');
    if (needsCrop && format.targetWidth && format.targetHeight) {
      canvas.width = format.targetWidth;
      canvas.height = format.targetHeight;
    } else {
      canvas.width = crop.sw;
      canvas.height = crop.sh;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { blob: sourceBlob, ext: getExtensionFromMime(sourceBlob.type) };
    }
    ctx.filter = needsFilter ? filter.canvasFilter : 'none';
    ctx.drawImage(
      img,
      crop.sx,
      crop.sy,
      crop.sw,
      crop.sh,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const targetMime =
      sourceBlob.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const filteredBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Falha ao exportar imagem filtrada.'))),
        targetMime,
        0.92
      );
    });

    return {
      blob: filteredBlob,
      ext: getExtensionFromMime(targetMime),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
