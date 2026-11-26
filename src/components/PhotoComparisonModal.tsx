import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeftRight,
  Columns2,
  Download,
  Heart,
  Maximize2,
  MoveHorizontal,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';
import { ImageCompareSlider } from './BeforeAfterSlider';
import {
  getArtisticFilter,
  type ArtisticFilterId,
} from '../shared/artisticFilters';
import { formatPhotoExifMetadata } from '../shared/photoMetadata';
import { summarizePhotoComparison } from '../shared/photoCompare';
import type { LightboxPhotoItem } from './PhotoLightboxModal';

interface PhotoComparisonModalProps {
  pair: [LightboxPhotoItem, LightboxPhotoItem];
  onSwap: () => void;
  onClose: () => void;
  getMediaUrl: (path: string) => string;
  appliedFilters: Record<string, ArtisticFilterId>;
  buildRecreateUrl: (item: LightboxPhotoItem) => string;
  onToggleFavorite: (photoId: string) => Promise<void>;
  onDownload: (item: LightboxPhotoItem) => Promise<void>;
  onOpenLightbox: (item: LightboxPhotoItem) => void;
  downloadingId: string | null;
}

export function PhotoComparisonModal({
  pair,
  onSwap,
  onClose,
  getMediaUrl,
  appliedFilters,
  buildRecreateUrl,
  onToggleFavorite,
  onDownload,
  onOpenLightbox,
  downloadingId,
}: PhotoComparisonModalProps) {
  const [photoA, photoB] = pair;
  const [viewMode, setViewMode] = useState<'side-by-side' | 'slider'>('side-by-side');
  const [dimsMap, setDimsMap] = useState<Record<string, { width: number; height: number }>>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const comparison = summarizePhotoComparison(photoA, photoB);
  const filterA = getArtisticFilter(appliedFilters[photoA.id] ?? 'original');
  const filterB = getArtisticFilter(appliedFilters[photoB.id] ?? 'original');
  const urlA = getMediaUrl(photoA.url);
  const urlB = getMediaUrl(photoB.url);

  const slots: Array<{
    slotLabel: string;
    item: LightboxPhotoItem;
    filter: ReturnType<typeof getArtisticFilter>;
    url: string;
  }> = [
    { slotLabel: 'Variação A', item: photoA, filter: filterA, url: urlA },
    { slotLabel: 'Variação B', item: photoB, filter: filterB, url: urlB },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Comparação lado a lado de fotografias"
      data-testid="photo-comparison-modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-slate-950/80 dark:bg-[#08080C]/95 backdrop-blur-md flex items-center justify-center p-3 sm:p-6"
    >
      <div className="relative max-w-6xl w-full max-h-[94vh] overflow-y-auto rounded-2xl border border-slate-300 bg-white dark:border-white/15 dark:bg-[#17171F] shadow-2xl flex flex-col">
        {/* Cabeçalho */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-slate-300 dark:border-white/10">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-[#A855F7]">
                <Columns2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Comparação de variações</span>
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-slate-300 bg-slate-100 text-[11px] font-medium text-slate-800 dark:border-white/15 dark:bg-[#08080C] dark:text-[#A1A1AA]">
                {comparison.arePromptsIdentical
                  ? 'Mesmo prompt · Nova tentativa'
                  : 'Prompts diferentes'}
              </span>
            </div>
            <h2 className="mt-0.5 font-display text-sm sm:text-base font-semibold text-slate-950 dark:text-white truncate">
              {photoA.scenarioTitle} × {photoB.scenarioTitle}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Modo de exibição comparativa"
              className="inline-flex rounded-xl border border-slate-300 bg-slate-100 p-0.5 dark:border-white/15 dark:bg-[#08080C]"
            >
              <button
                type="button"
                aria-pressed={viewMode === 'side-by-side'}
                onClick={() => setViewMode('side-by-side')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  viewMode === 'side-by-side'
                    ? 'bg-[#7C3AED] text-white'
                    : 'text-slate-700 hover:text-slate-950 dark:text-[#A1A1AA] dark:hover:text-white'
                }`}
              >
                <Columns2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Lado a lado</span>
              </button>
              <button
                type="button"
                aria-pressed={viewMode === 'slider'}
                onClick={() => setViewMode('slider')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  viewMode === 'slider'
                    ? 'bg-[#7C3AED] text-white'
                    : 'text-slate-700 hover:text-slate-950 dark:text-[#A1A1AA] dark:hover:text-white'
                }`}
              >
                <MoveHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Slider sobreposto</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onSwap}
              aria-label="Inverter posições das duas fotos"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-100 text-xs font-medium text-slate-800 hover:text-slate-950 hover:border-violet-700 dark:border-white/15 dark:bg-[#08080C] dark:text-[#A1A1AA] dark:hover:text-white dark:hover:border-[#8B5CF6] transition-colors whitespace-nowrap"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Inverter lados</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar comparação"
              className="p-2 rounded-lg bg-slate-100 border border-slate-300 text-slate-950 hover:bg-[#7C3AED] hover:text-white dark:bg-[#08080C] dark:border-white/15 dark:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Corpo da comparação */}
        <div className="p-4 sm:p-6 space-y-5">
          {viewMode === 'slider' && (
            <div className="rounded-2xl border border-slate-300 bg-slate-950 dark:border-white/10 dark:bg-[#08080C] p-4 flex flex-col items-center gap-3">
              <div className="max-w-sm w-full">
                <ImageCompareSlider
                  title={`Comparação ${photoA.scenarioTitle} e ${photoB.scenarioTitle}`}
                  beforeImage={urlA}
                  afterImage={urlB}
                  beforeLabel="Variação A"
                  afterLabel="Variação B"
                  beforeClassName={filterA.cssClass}
                  afterClassName={filterB.cssClass}
                  objectPositionClass="object-contain"
                />
              </div>
              <p className="text-xs text-slate-300 dark:text-[#A1A1AA]">
                Arraste o controle central para comparar enquadramento, iluminação e detalhes entre as variações A e B.
              </p>
            </div>
          )}

          {/* Grid Lado a Lado (sempre visível para prompts/detalhes e fotos no modo lado a lado) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {slots.map(({ slotLabel, item, filter, url }) => {
              const exif = formatPhotoExifMetadata({
                scenarioTitle: item.scenarioTitle,
                categoryName: item.categoryName,
                promptUsed: item.promptUsed,
                createdAt: item.createdAt,
                appliedFilterId: filter.id,
                aspectRatio: item.aspectRatio,
                mimeType: item.mimeType,
                mode: item.mode,
                model: item.model,
                provider: item.provider,
                dimensions: dimsMap[item.id] ?? null,
                synthIdMarked: item.synthIdMarked,
                costCredits: item.costCredits,
              });

              return (
                <section
                  key={item.id}
                  data-testid={`compare-card-${item.id}`}
                  className="rounded-2xl border border-slate-300 bg-slate-50 dark:border-white/10 dark:bg-[#08080C] overflow-hidden flex flex-col"
                >
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-violet-700 dark:text-[#A855F7]">
                        <Sparkles className="w-3 h-3" aria-hidden="true" />
                        <span>{slotLabel}</span>
                      </span>
                      <h3 className="font-display text-sm font-semibold text-slate-950 dark:text-white truncate">
                        {item.scenarioTitle}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenLightbox(item)}
                      aria-label={`Ampliar ${item.scenarioTitle}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-[11px] font-medium text-slate-800 hover:border-violet-700 dark:border-white/15 dark:bg-[#17171F] dark:text-[#A1A1AA] dark:hover:text-white"
                    >
                      <Maximize2 className="w-3 h-3" aria-hidden="true" />
                      <span>Ampliar</span>
                    </button>
                  </div>

                  {viewMode === 'side-by-side' && (
                    <div className="relative bg-slate-950 flex items-center justify-center p-3 h-[340px] sm:h-[400px]">
                      <ImageWithFallback
                        src={url}
                        alt={`${slotLabel}: ${item.scenarioTitle}`}
                        onLoad={(e) => {
                          const img = e.currentTarget;
                          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                            setDimsMap((prev) => ({
                              ...prev,
                              [item.id]: {
                                width: img.naturalWidth,
                                height: img.naturalHeight,
                              },
                            }));
                          }
                        }}
                        className={`max-h-full max-w-full w-auto h-auto object-contain rounded-lg ${filter.cssClass}`}
                      />
                    </div>
                  )}

                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#17171F] p-3 space-y-1">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-slate-600 dark:text-[#A1A1AA]">
                          Prompt utilizado
                        </p>
                        <p className="text-xs text-slate-950 dark:text-white/95 leading-relaxed break-words">
                          {exif.prompt}
                        </p>
                      </div>

                      <dl className="grid grid-cols-2 gap-2.5 text-xs">
                        <div>
                          <dt className="text-[11px] text-slate-600 dark:text-[#A1A1AA]">Modelo de IA</dt>
                          <dd className="font-medium text-slate-950 dark:text-white truncate">
                            {exif.modelLabel}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-slate-600 dark:text-[#A1A1AA]">Dimensões</dt>
                          <dd className="font-mono-num text-slate-950 dark:text-white">
                            {exif.dimensionsLabel}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-slate-600 dark:text-[#A1A1AA]">Filtro aplicado</dt>
                          <dd className="text-violet-700 dark:text-[#A855F7] font-medium">
                            {exif.appliedFilterLabel}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] text-slate-600 dark:text-[#A1A1AA]">Data de criação</dt>
                          <dd className="font-mono-num text-slate-950 dark:text-white">
                            {exif.createdAtFormatted}
                          </dd>
                        </div>
                      </dl>

                      {(item.tags?.length ?? 0) > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {item.tags!.map((tagName) => (
                            <span
                              key={tagName}
                              className="px-2 py-0.5 rounded-md border border-violet-600/40 bg-violet-50 text-[11px] font-medium text-violet-950 dark:border-[#8B5CF6]/45 dark:bg-[#7C3AED]/15 dark:text-violet-100"
                            >
                              {tagName}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        aria-pressed={item.favorite}
                        onClick={() => void onToggleFavorite(item.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
                          item.favorite
                            ? 'bg-pink-50 border-pink-600 text-pink-950 dark:bg-[#EC4899]/15 dark:border-[#EC4899] dark:text-white'
                            : 'border-slate-300 bg-white text-slate-800 hover:text-slate-950 dark:border-white/15 dark:bg-[#17171F] dark:text-[#A1A1AA] dark:hover:text-white'
                        }`}
                      >
                        <Heart
                          className={`w-3.5 h-3.5 ${
                            item.favorite ? 'fill-[#EC4899] text-[#EC4899]' : ''
                          }`}
                          aria-hidden="true"
                        />
                        <span>{item.favorite ? 'Escolhida (Favorita)' : 'Escolher como favorita'}</span>
                      </button>

                      <div className="flex items-center gap-2">
                        <Link
                          to={buildRecreateUrl(item)}
                          onClick={onClose}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-800 hover:text-slate-950 dark:border-white/15 dark:bg-[#17171F] dark:text-[#A1A1AA] dark:hover:text-white"
                        >
                          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Recriar</span>
                        </Link>
                        <button
                          type="button"
                          disabled={downloadingId === item.id}
                          onClick={() => void onDownload(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold text-white hover:brightness-110 disabled:opacity-50"
                        >
                          <Download className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{downloadingId === item.id ? 'Baixando...' : 'Baixar'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
