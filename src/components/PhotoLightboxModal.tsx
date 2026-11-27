import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Globe,
  Heart,
  Info,
  Instagram,
  Maximize2,
  MessageCircle,
  Minimize2,
  MoveHorizontal,
  Palette,
  Plus,
  RotateCcw,
  Share2,
  Tag,
  Twitter,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';
import { ImageCompareSlider } from './BeforeAfterSlider';
import { ButtonSpinner } from './ButtonSpinner';
import {
  ARTISTIC_FILTERS,
  SOCIAL_EXPORT_FORMATS,
  getArtisticFilter,
  getSocialExportFormat,
  type ArtisticFilterId,
  type SocialExportFormatId,
} from '../shared/artisticFilters';
import { formatPhotoExifMetadata } from '../shared/photoMetadata';
import type { FolderItem } from '../shared/photoFolders';
import {
  PRESET_PHOTO_TAGS,
  addTagToList,
  hasTag,
  togglePhotoTag,
} from '../shared/photoTags';
import {
  buildShareCaption,
  buildTwitterShareUrl,
  buildWhatsAppShareUrl,
} from '../shared/socialShare';

export interface LightboxPhotoItem {
  id: string;
  scenarioId?: string;
  scenarioTitle: string;
  categoryId: string;
  categoryName: string;
  promptUsed?: string;
  aspectRatio?: string;
  mimeType?: string;
  mode?: 'preset' | 'free' | 'variation';
  model?: string;
  provider?: string;
  url: string;
  costCredits: number;
  status: string;
  favorite: boolean;
  folderId?: string;
  tags?: string[];
  synthIdMarked: boolean;
  /** Foto publicada na Galeria da Comunidade (opt-in do dono). */
  isPublic: boolean;
  createdAt: string;
}

interface PhotoLightboxModalProps {
  item: LightboxPhotoItem;
  items: LightboxPhotoItem[];
  onSelectItem: (item: LightboxPhotoItem) => void;
  onClose: () => void;
  getMediaUrl: (path: string) => string;
  appliedFilterId: ArtisticFilterId;
  onSetFilter: (photoId: string, filterId: ArtisticFilterId) => void;
  compareFilter: boolean;
  onToggleCompareFilter: () => void;
  folders: FolderItem[];
  folderById: Map<string, FolderItem>;
  onAssignFolder: (photoId: string, folderId: string | null) => Promise<void>;
  onUpdateTags?: (photoId: string, nextTags: string[]) => Promise<void>;
  exportFormat: SocialExportFormatId;
  onChangeExportFormat: (format: SocialExportFormatId) => void;
  buildRecreateUrl: (item: LightboxPhotoItem) => string;
  onToggleFavorite: (photoId: string) => Promise<void>;
  /** Publica/remove a foto da Galeria da Comunidade. */
  onTogglePublic?: (photoId: string) => Promise<void>;
  onDownload: (item: LightboxPhotoItem, formatOverride?: SocialExportFormatId) => Promise<void>;
  onShareInstagram: (item: LightboxPhotoItem) => Promise<{
    mode: 'native' | 'downloaded';
    message: string;
  }>;
  downloading: boolean;
}

export function PhotoLightboxModal({
  item,
  items,
  onSelectItem,
  onClose,
  getMediaUrl,
  appliedFilterId,
  onSetFilter,
  compareFilter,
  onToggleCompareFilter,
  folders,
  folderById,
  onAssignFolder,
  onUpdateTags,
  exportFormat,
  onChangeExportFormat,
  buildRecreateUrl,
  onToggleFavorite,
  onTogglePublic,
  onDownload,
  onShareInstagram,
  downloading,
}: PhotoLightboxModalProps) {
  const [fullResolutionZoom, setFullResolutionZoom] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dialogCardRef = useRef<HTMLDivElement>(null);
  const [naturalDimensions, setNaturalDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [showDetails, setShowDetails] = useState(true);
  const [customTagInput, setCustomTagInput] = useState('');
  const [tagError, setTagError] = useState<string | null>(null);
  const [savingTags, setSavingTags] = useState(false);
  const [togglingFavorite, setTogglingFavorite] = useState(false);
  const [togglingPublic, setTogglingPublic] = useState(false);
  const [sharingInstagram, setSharingInstagram] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<{
    network: 'whatsapp' | 'instagram' | 'twitter';
    text: string;
  } | null>(null);

  const currentIndex = items.findIndex((p) => p.id === item.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < items.length - 1;

  const filterObj = getArtisticFilter(appliedFilterId);
  const selectedFormatObj = getSocialExportFormat(exportFormat);
  const canCompare = appliedFilterId !== 'original';

  const appOrigin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : undefined;

  const sharePayload = {
    scenarioTitle: item.scenarioTitle,
    categoryName: item.categoryName,
    appUrl: appOrigin,
  };
  const whatsappShareUrl = buildWhatsAppShareUrl(sharePayload);
  const twitterShareUrl = buildTwitterShareUrl(sharePayload);

  const handleCopyShareCaption = async (network: 'whatsapp' | 'twitter', label: string) => {
    const caption = buildShareCaption(sharePayload);
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(caption);
      }
    } catch {
      // Clipboard optional
    }
    setShareFeedback({
      network,
      text: `Compartilhamento no ${label} aberto em nova aba.`,
    });
  };

  const handleInstagramClick = async () => {
    setSharingInstagram(true);
    setShareFeedback(null);
    try {
      const result = await onShareInstagram(item);
      setShareFeedback({
        network: 'instagram',
        text: result.message,
      });
    } catch {
      setShareFeedback({
        network: 'instagram',
        text: 'Não foi possível preparar a imagem para o Instagram agora.',
      });
    } finally {
      setSharingInstagram(false);
    }
  };

  const exif = formatPhotoExifMetadata({
    scenarioTitle: item.scenarioTitle,
    categoryName: item.categoryName,
    promptUsed: item.promptUsed,
    createdAt: item.createdAt,
    appliedFilterId,
    aspectRatio: item.aspectRatio,
    mimeType: item.mimeType,
    mode: item.mode,
    model: item.model,
    provider: item.provider,
    dimensions: naturalDimensions,
    synthIdMarked: item.synthIdMarked,
    costCredits: item.costCredits,
  });

  const itemTags = item.tags ?? [];

  const handleToggleTagInModal = async (tagName: string) => {
    if (!onUpdateTags) return;
    setTagError(null);
    setSavingTags(true);
    try {
      const nextTags = togglePhotoTag(itemTags, tagName);
      await onUpdateTags(item.id, nextTags);
    } finally {
      setSavingTags(false);
    }
  };

  const handleAddCustomTagInModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onUpdateTags) return;
    const res = addTagToList(itemTags, customTagInput);
    if (res.ok === false) {
      setTagError(res.error);
      return;
    }
    setTagError(null);
    setCustomTagInput('');
    setSavingTags(true);
    try {
      await onUpdateTags(item.id, res.tags);
    } finally {
      setSavingTags(false);
    }
  };

  const handleFavoriteClick = async () => {
    setTogglingFavorite(true);
    try {
      await onToggleFavorite(item.id);
    } finally {
      setTogglingFavorite(false);
    }
  };

  const handlePublicClick = async () => {
    if (!onTogglePublic) return;
    setTogglingPublic(true);
    try {
      await onTogglePublic(item.id);
    } finally {
      setTogglingPublic(false);
    }
  };

  useEffect(() => {
    setNaturalDimensions(null);
    setFullResolutionZoom(false);
    setShareFeedback(null);
    setCustomTagInput('');
    setTagError(null);
  }, [item.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft' && hasPrev) {
        e.preventDefault();
        onSelectItem(items[currentIndex - 1]);
      } else if (e.key === 'ArrowRight' && hasNext) {
        e.preventDefault();
        onSelectItem(items[currentIndex + 1]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onSelectItem, items, currentIndex, hasPrev, hasNext]);

  useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen((prev) => prev);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      if (document.fullscreenElement && document.exitFullscreen) {
        void document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  const toggleFullscreenMode = () => {
    const next = !isFullscreen;
    setIsFullscreen(next);
    if (next) {
      const target = dialogCardRef.current;
      if (target?.requestFullscreen) {
        void target.requestFullscreen().catch(() => {});
      }
    } else if (document.fullscreenElement && document.exitFullscreen) {
      void document.exitFullscreen().catch(() => {});
    }
  };

  const resolvedUrl = getMediaUrl(item.url);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.scenarioTitle}
      data-testid="photo-lightbox-modal"
      data-fullscreen={isFullscreen ? 'true' : 'false'}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className={`fixed inset-0 z-50 bg-slate-950/80 dark:bg-[#08080C]/95 backdrop-blur-md flex items-center justify-center ${
        isFullscreen ? 'p-0' : 'p-3 sm:p-6'
      }`}
    >
      <div
        ref={dialogCardRef}
        className={`relative overflow-y-auto bg-white dark:bg-[#17171F] shadow-2xl flex flex-col ${
          isFullscreen
            ? 'w-screen h-screen max-w-none max-h-none rounded-none border-0'
            : 'max-w-6xl w-full max-h-[94vh] rounded-2xl border border-slate-300 dark:border-white/15'
        }`}
      >
        {/* Cabeçalho do Lightbox */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-slate-300 dark:border-white/10">
          <div className="min-w-0">
            <p className="text-xs text-slate-700 dark:text-[#A1A1AA]">
              {item.categoryName}
              {currentIndex >= 0 && items.length > 1
                ? ` · Foto ${currentIndex + 1} de ${items.length}`
                : ''}
              {naturalDimensions
                ? ` · ${naturalDimensions.width} × ${naturalDimensions.height} px`
                : ''}
            </p>
            <h2 className="font-display text-sm sm:text-base font-semibold text-slate-950 dark:text-white truncate">
              {item.scenarioTitle}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {!compareFilter && (
              <button
                type="button"
                aria-pressed={fullResolutionZoom}
                onClick={() => setFullResolutionZoom((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
                  fullResolutionZoom
                    ? 'bg-[#7C3AED] border-[#A855F7] text-white'
                    : 'bg-slate-100 border-slate-300 text-slate-800 hover:text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-[#A1A1AA] dark:hover:text-white'
                }`}
              >
                {fullResolutionZoom ? (
                  <>
                    <ZoomOut className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Ajustar à tela</span>
                  </>
                ) : (
                  <>
                    <ZoomIn className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Resolução real (1:1)</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              aria-pressed={isFullscreen}
              onClick={toggleFullscreenMode}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
                isFullscreen
                  ? 'bg-[#7C3AED] border-[#A855F7] text-white'
                  : 'bg-slate-100 border-slate-300 text-slate-800 hover:text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-[#A1A1AA] dark:hover:text-white'
              }`}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Sair da tela cheia</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Tela cheia</span>
                </>
              )}
            </button>

            <button
              type="button"
              aria-expanded={showDetails}
              onClick={() => setShowDetails((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap ${
                showDetails
                  ? 'bg-violet-100 border-violet-700 text-violet-950 dark:bg-[#7C3AED]/20 dark:border-[#8B5CF6] dark:text-white'
                  : 'bg-slate-100 border-slate-300 text-slate-800 hover:text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-[#A1A1AA] dark:hover:text-white'
              }`}
            >
              <Info className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Detalhes</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar visualização"
              className="p-2 rounded-lg bg-slate-100 border border-slate-300 text-slate-950 hover:bg-[#7C3AED] hover:text-white dark:bg-[#08080C] dark:border-white/15 dark:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Palco da imagem em resolução completa */}
        <div
          className={`relative overflow-hidden bg-slate-950 dark:bg-[#08080C] flex items-center justify-center min-h-[260px] sm:min-h-[320px] ${
            isFullscreen ? 'flex-1 shrink-0 min-h-[45vh]' : 'shrink-0'
          }`}
        >
          {hasPrev && (
            <button
              type="button"
              onClick={() => onSelectItem(items[currentIndex - 1])}
              aria-label="Fotografia anterior"
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-full bg-[#08080C]/85 border border-white/15 text-white hover:bg-[#7C3AED] transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {hasNext && (
            <button
              type="button"
              onClick={() => onSelectItem(items[currentIndex + 1])}
              aria-label="Próxima fotografia"
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2.5 rounded-full bg-[#08080C]/85 border border-white/15 text-white hover:bg-[#7C3AED] transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          {compareFilter && canCompare ? (
            <div className="max-w-sm w-full mx-auto py-3 px-4">
              <ImageCompareSlider
                title={item.scenarioTitle}
                beforeImage={resolvedUrl}
                afterImage={resolvedUrl}
                beforeLabel="Original"
                afterLabel={filterObj.label}
                beforeClassName="pf-filter-original"
                afterClassName={filterObj.cssClass}
                objectPositionClass="object-contain"
              />
            </div>
          ) : fullResolutionZoom ? (
            <div
              data-testid="lightbox-fullres-scroll"
              className={`w-full overflow-auto p-4 flex ${
                isFullscreen ? 'max-h-[68vh]' : 'max-h-[54vh]'
              }`}
            >
              <img
                src={resolvedUrl}
                alt={item.scenarioTitle}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                    setNaturalDimensions({
                      width: img.naturalWidth,
                      height: img.naturalHeight,
                    });
                  }
                }}
                className={`max-w-none h-auto w-auto m-auto block transition-all duration-200 ${filterObj.cssClass}`}
              />
            </div>
          ) : (
            <div className="w-full flex items-center justify-center p-3 sm:p-4">
              <ImageWithFallback
                src={resolvedUrl}
                alt={item.scenarioTitle}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                    setNaturalDimensions({
                      width: img.naturalWidth,
                      height: img.naturalHeight,
                    });
                  }
                }}
                className={`max-w-full w-auto h-auto object-contain block transition-all duration-200 ${
                  isFullscreen
                    ? 'max-h-[64vh]'
                    : showDetails
                    ? 'max-h-[40vh] sm:max-h-[44vh]'
                    : 'max-h-[48vh] sm:max-h-[54vh]'
                } ${filterObj.cssClass}`}
              />
            </div>
          )}
        </div>

        {/* Filtros artísticos */}
        <div className="shrink-0 px-4 sm:px-5 pt-3 pb-3 border-t border-slate-300 dark:border-white/10 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-[#A1A1AA]">
              <Palette className="w-3.5 h-3.5 text-violet-700 dark:text-[#8B5CF6]" aria-hidden="true" />
              <span>Filtros artísticos</span>
            </div>
            {canCompare && (
              <button
                type="button"
                aria-pressed={compareFilter}
                onClick={onToggleCompareFilter}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-medium transition-colors ${
                  compareFilter
                    ? 'bg-[#7C3AED] border-[#A855F7] text-white'
                    : 'bg-slate-100 border-slate-300 text-slate-800 hover:text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-[#A1A1AA] dark:hover:text-white'
                }`}
              >
                <MoveHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{compareFilter ? 'Sair da comparação' : 'Comparar Original × Filtro'}</span>
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {ARTISTIC_FILTERS.map((f) => {
              const isActive = appliedFilterId === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onSetFilter(item.id, f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    isActive
                      ? 'bg-[#7C3AED] border-[#A855F7] text-white'
                      : 'bg-slate-100 text-slate-800 border-slate-300 hover:text-slate-950 dark:bg-[#08080C] dark:text-[#A1A1AA] dark:border-white/10 dark:hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Painel de detalhes técnicos da fotografia */}
        {showDetails && (
          <div className="shrink-0 px-4 sm:px-5 pb-3">
            <div
              data-testid="lightbox-details-panel"
              className="rounded-xl border border-slate-300 bg-slate-100 dark:border-white/10 dark:bg-[#08080C] p-3.5 sm:p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-950 dark:text-white">
                  <Info className="w-3.5 h-3.5 text-violet-700 dark:text-[#8B5CF6]" aria-hidden="true" />
                  <span>Detalhes técnicos da fotografia</span>
                </div>
                <span className="text-[11px] font-mono-num text-slate-600 dark:text-[#A1A1AA]">
                  {exif.costLabel} · {exif.signatureLabel}
                </span>
              </div>

              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <dt className="text-[11px] text-slate-600 dark:text-[#A1A1AA]">Modelo de IA</dt>
                  <dd className="mt-0.5 font-medium text-slate-950 dark:text-white break-words">
                    {exif.modelLabel}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-600 dark:text-[#A1A1AA]">Data de criação</dt>
                  <dd className="mt-0.5 font-mono-num text-slate-950 dark:text-white">
                    {exif.createdAtFormatted}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-600 dark:text-[#A1A1AA]">Dimensões</dt>
                  <dd className="mt-0.5 font-mono-num text-slate-950 dark:text-white">
                    {exif.dimensionsLabel}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-600 dark:text-[#A1A1AA]">Proporção · Formato</dt>
                  <dd className="mt-0.5 font-mono-num text-slate-950 dark:text-white">
                    {exif.aspectRatio} · {exif.formatLabel}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-600 dark:text-[#A1A1AA]">Filtro aplicado</dt>
                  <dd className="mt-0.5 text-violet-700 dark:text-[#A855F7] font-medium">
                    {exif.appliedFilterLabel}
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] text-slate-600 dark:text-[#A1A1AA]">Modo de criação</dt>
                  <dd className="mt-0.5 text-slate-950 dark:text-white">{exif.modeLabel}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-[11px] text-slate-600 dark:text-[#A1A1AA]">Prompt utilizado</dt>
                  <dd className="mt-0.5 text-slate-950 dark:text-white/95 leading-relaxed break-words">
                    {exif.prompt}
                  </dd>
                </div>
              </dl>

              {onUpdateTags && (
                <div className="pt-2.5 border-t border-slate-300 dark:border-white/10 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 dark:text-[#A1A1AA]">
                      <Tag className="w-3.5 h-3.5 text-violet-700 dark:text-[#8B5CF6]" aria-hidden="true" />
                      <span>Tags de organização</span>
                    </div>
                    <form onSubmit={handleAddCustomTagInModal} className="inline-flex items-center gap-1.5">
                      <input
                        type="text"
                        value={customTagInput}
                        onChange={(e) => setCustomTagInput(e.target.value)}
                        placeholder="Nova tag..."
                        aria-label="Adicionar tag personalizada no modal"
                        maxLength={24}
                        className="w-28 sm:w-36 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-xs text-slate-950 focus:outline-none focus:border-violet-700 dark:bg-[#17171F] dark:border-white/15 dark:text-white dark:focus:border-[#8B5CF6]"
                      />
                      <button
                        type="submit"
                        disabled={savingTags}
                        aria-label="Salvar nova tag"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#7C3AED] text-[11px] font-medium text-white hover:brightness-110 disabled:opacity-60"
                      >
                        {savingTags ? (
                          <ButtonSpinner size="xs" />
                        ) : (
                          <Plus className="w-3 h-3" aria-hidden="true" />
                        )}
                        <span>{savingTags ? 'Salvando...' : 'Adicionar'}</span>
                      </button>
                    </form>
                  </div>

                  {tagError && (
                    <p role="alert" className="text-[11px] text-red-700 dark:text-red-300">
                      {tagError}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5">
                    {PRESET_PHOTO_TAGS.map((tagName) => {
                      const active = hasTag(itemTags, tagName);
                      return (
                        <button
                          key={tagName}
                          type="button"
                          disabled={savingTags}
                          aria-pressed={active}
                          onClick={() => void handleToggleTagInModal(tagName)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors disabled:opacity-60 ${
                            active
                              ? 'bg-[#7C3AED] border-[#A855F7] text-white'
                              : 'bg-white border-slate-300 text-slate-700 hover:text-slate-950 dark:bg-[#17171F] dark:border-white/15 dark:text-[#A1A1AA] dark:hover:text-white'
                          }`}
                        >
                          {tagName}
                        </button>
                      );
                    })}
                    {itemTags
                      .filter(
                        (tag) =>
                          !PRESET_PHOTO_TAGS.some(
                            (preset) => preset.toLowerCase() === tag.toLowerCase()
                          )
                      )
                      .map((customTag) => (
                        <button
                          key={customTag}
                          type="button"
                          onClick={() => void handleToggleTagInModal(customTag)}
                          aria-label={`Remover tag ${customTag}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#7C3AED] border border-[#A855F7] text-[11px] font-medium text-white"
                        >
                          <span>{customTag}</span>
                          <X className="w-3 h-3" aria-hidden="true" />
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Compartilhamento social */}
        <div
          data-testid="lightbox-social-share"
          className="shrink-0 px-4 sm:px-5 py-3 border-t border-slate-300 dark:border-white/10 space-y-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-[#A1A1AA]">
              <Share2 className="w-3.5 h-3.5 text-violet-700 dark:text-[#8B5CF6]" aria-hidden="true" />
              <span>Compartilhar criação</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a
                href={whatsappShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => void handleCopyShareCaption('whatsapp', 'WhatsApp')}
                aria-label="Compartilhar no WhatsApp"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-600/45 bg-emerald-50 text-xs font-medium text-emerald-900 hover:bg-emerald-100 dark:border-emerald-500/35 dark:bg-emerald-950/25 dark:text-emerald-200 dark:hover:bg-emerald-900/40 transition-colors whitespace-nowrap"
              >
                <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" />
                <span>WhatsApp</span>
              </a>

              <button
                type="button"
                onClick={() => void handleInstagramClick()}
                disabled={sharingInstagram}
                aria-label="Compartilhar no Instagram"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-pink-600/45 bg-pink-50 text-xs font-medium text-pink-900 hover:bg-pink-100 dark:border-[#EC4899]/40 dark:bg-[#EC4899]/15 dark:text-pink-100 dark:hover:bg-[#EC4899]/25 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {sharingInstagram ? (
                  <ButtonSpinner size="sm" />
                ) : (
                  <Instagram className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>{sharingInstagram ? 'Preparando...' : 'Instagram'}</span>
              </button>

              <a
                href={twitterShareUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => void handleCopyShareCaption('twitter', 'Twitter')}
                aria-label="Compartilhar no Twitter"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-sky-600/45 bg-sky-50 text-xs font-medium text-sky-900 hover:bg-sky-100 dark:border-sky-400/35 dark:bg-sky-950/25 dark:text-sky-200 dark:hover:bg-sky-900/40 transition-colors whitespace-nowrap"
              >
                <Twitter className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Twitter</span>
              </a>
            </div>
          </div>

          {shareFeedback && (
            <div
              role="status"
              className="rounded-xl border border-slate-300 bg-slate-100 text-slate-900 dark:border-white/10 dark:bg-[#08080C] dark:text-[#E4E4E7] px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2"
            >
              <span>{shareFeedback.text}</span>
              <div className="flex items-center gap-3">
                {shareFeedback.network === 'instagram' && (
                  <a
                    href="https://www.instagram.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-violet-700 hover:text-slate-950 dark:text-[#A855F7] dark:hover:text-white"
                  >
                    <span>Abrir Instagram</span>
                    <ExternalLink className="w-3 h-3" aria-hidden="true" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setShareFeedback(null)}
                  aria-label="Fechar aviso de compartilhamento"
                  className="text-slate-600 hover:text-slate-950 dark:text-[#A1A1AA] dark:hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé de ações */}
        <div className="shrink-0 px-4 sm:px-5 py-3.5 border-t border-slate-300 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-700 dark:text-[#A1A1AA]">
            Foto gerada por IA · {item.categoryName}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Pasta da foto"
              value={item.folderId && folderById.has(item.folderId) ? item.folderId : ''}
              onChange={(e) => void onAssignFolder(item.id, e.target.value || null)}
              className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
            >
              <option value="">Sem pasta</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  Pasta: {folder.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Formato para download"
              value={exportFormat}
              onChange={(e) => onChangeExportFormat(e.target.value as SocialExportFormatId)}
              className="px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
            >
              {SOCIAL_EXPORT_FORMATS.map((fmt) => (
                <option key={fmt.id} value={fmt.id}>
                  {fmt.label}
                </option>
              ))}
            </select>
            <Link
              to={buildRecreateUrl(item)}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-slate-100 text-xs font-medium text-slate-800 hover:text-slate-950 dark:border-white/15 dark:bg-[#08080C] dark:text-[#A1A1AA] dark:hover:text-white"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Recriar</span>
            </Link>
            <button
              type="button"
              disabled={togglingFavorite}
              aria-pressed={item.favorite}
              onClick={() => void handleFavoriteClick()}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-medium transition-colors disabled:opacity-60 ${
                item.favorite
                  ? 'bg-pink-50 border-pink-600 text-pink-950 dark:bg-[#EC4899]/15 dark:border-[#EC4899] dark:text-white'
                  : 'border-slate-300 bg-slate-100 text-slate-800 hover:text-slate-950 dark:border-white/15 dark:bg-[#08080C] dark:text-[#A1A1AA] dark:hover:text-white'
              }`}
            >
              {togglingFavorite ? (
                <ButtonSpinner size="md" />
              ) : (
                <Heart
                  className={`w-4 h-4 ${
                    item.favorite ? 'fill-[#EC4899] text-[#EC4899]' : ''
                  }`}
                  aria-hidden="true"
                />
              )}
              <span>{item.favorite ? 'Favorita' : 'Favoritar'}</span>
            </button>
            {onTogglePublic && (
              <button
                type="button"
                disabled={togglingPublic}
                aria-pressed={item.isPublic ?? false}
                title="Quem visitar a Galeria da Comunidade poderá ver e curtir esta foto"
                onClick={() => void handlePublicClick()}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-medium transition-colors disabled:opacity-60 ${
                  item.isPublic
                    ? 'bg-violet-100 border-violet-700 text-violet-950 dark:bg-[#7C3AED]/20 dark:border-[#8B5CF6] dark:text-white'
                    : 'border-slate-300 bg-slate-100 text-slate-800 hover:text-slate-950 dark:border-white/15 dark:bg-[#08080C] dark:text-[#A1A1AA] dark:hover:text-white'
                }`}
              >
                {togglingPublic ? (
                  <ButtonSpinner size="md" />
                ) : (
                  <Globe
                    className={`w-4 h-4 ${item.isPublic ? 'text-[#7C3AED] dark:text-[#A855F7]' : ''}`}
                    aria-hidden="true"
                  />
                )}
                <span>{item.isPublic ? 'Na Galeria' : 'Compartilhar na Galeria'}</span>
              </button>
            )}
            {exportFormat !== 'original' && (
              <button
                type="button"
                onClick={() => void onDownload(item, 'original')}
                disabled={downloading}
                aria-label="Baixar imagem em alta resolução original"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-violet-700/70 bg-violet-100 text-xs font-medium text-violet-950 hover:bg-violet-200 dark:border-[#7C3AED]/70 dark:bg-[#7C3AED]/15 dark:text-white dark:hover:bg-[#7C3AED]/30 disabled:opacity-50 whitespace-nowrap"
              >
                {downloading ? (
                  <ButtonSpinner size="sm" />
                ) : (
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>Alta resolução</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => void onDownload(item)}
              disabled={downloading}
              aria-label={
                exportFormat === 'original'
                  ? 'Baixar imagem em alta resolução'
                  : `Baixar imagem no formato ${selectedFormatObj.shortLabel}`
              }
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white hover:brightness-110 disabled:opacity-50 whitespace-nowrap"
            >
              {downloading ? (
                <ButtonSpinner size="md" />
              ) : (
                <Download className="w-4 h-4" aria-hidden="true" />
              )}
              <span>
                {downloading
                  ? 'Baixando...'
                  : exportFormat === 'original'
                  ? 'Baixar alta resolução'
                  : `Baixar (${selectedFormatObj.shortLabel})`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
