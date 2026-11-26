import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import JSZip from 'jszip';
import {
  Archive,
  Check,
  CheckSquare,
  Columns2,
  Copy,
  Download,
  FileText,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Heart,
  HelpCircle,
  History,
  Info,
  LogOut,
  Maximize2,
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Square,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { MySpaceDashboard } from '../components/MySpaceDashboard';
import { PhotoLightboxModal } from '../components/PhotoLightboxModal';
import { PhotoComparisonModal } from '../components/PhotoComparisonModal';
import { FloatingBatchToolbar } from '../components/FloatingBatchToolbar';
import { MySpaceOnboardingTour } from '../components/MySpaceOnboardingTour';
import type { VisualProfileData } from '../shared/rules';
import { getPreferredAiModelOption } from '../shared/aiModels';
import {
  canCompareSelectedPhotos,
  resolveComparisonPair,
  swapComparisonPair,
} from '../shared/photoCompare';
import {
  ARTISTIC_FILTERS,
  SOCIAL_EXPORT_FORMATS,
  buildDownloadFilename,
  getArtisticFilter,
  renderBlobWithArtisticFilter,
  type ArtisticFilterId,
  type SocialExportFormatId,
} from '../shared/artisticFilters';
import { formatPhotoExifMetadata } from '../shared/photoMetadata';
import { buildShareCaption } from '../shared/socialShare';
import {
  SUGGESTED_FOLDER_NAMES,
  applyFolderToGenerations,
  clearDeletedFolderFromGenerations,
  filterGenerationsByFolder,
  getFolderCounts,
  validateNewFolderName,
  validateRenameFolder,
  type FolderItem,
} from '../shared/photoFolders';
import {
  applyBatchFilterToMap,
  buildPhotoRecreateUrl,
  extractPromptHistoryEntries,
  filterMySpacePhotos,
} from '../shared/mySpaceFilters';
import {
  PRESET_PHOTO_TAGS,
  addTagToList,
  getTagCounts,
  hasTag,
  togglePhotoTag,
} from '../shared/photoTags';
import { exportAlbumToPdfBlob } from '../shared/pdfAlbumExport';

const FILTER_PREFS_STORAGE_KEY = 'pf_gallery_filters';
const TOUR_SEEN_STORAGE_KEY = 'pf_myspace_tour_done_v1';

function loadSavedFilters(): Record<string, ArtisticFilterId> {
  try {
    const raw = window.localStorage.getItem(FILTER_PREFS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ArtisticFilterId>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function shouldOpenOnboardingTour(): boolean {
  try {
    return window.localStorage.getItem(TOUR_SEEN_STORAGE_KEY) !== '1';
  } catch {
    return false;
  }
}

type TabId =
  | 'fotos'
  | 'favoritos'
  | 'prompts'
  | 'historico'
  | 'referencias'
  | 'perfil'
  | 'creditos'
  | 'assinatura';

interface GenerationItem {
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
  createdAt: string;
}

interface FaceItem {
  id: string;
  url: string;
  createdAt: string;
}

interface LedgerItem {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

interface PaymentItem {
  id: string;
  planId: string;
  amountBrl: number;
  status: string;
  method: string;
  createdAt: string;
}

export function MySpacePage() {
  const { user, apiFetch, getMediaUrl, logout, refreshUser } = useAuth();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabId) || 'fotos';
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  const [generations, setGenerations] = useState<GenerationItem[]>([]);
  const [faces, setFaces] = useState<FaceItem[]>([]);
  const [profile, setProfile] = useState<VisualProfileData | null>(null);
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [subscription, setSubscription] = useState<{
    planId: string;
    subscriptionStatus: string;
    payments: PaymentItem[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState<'all' | '7d' | '30d'>('all');
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [folderFilter, setFolderFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [showNewFolderForm, setShowNewFolderForm] = useState(false);
  const [newFolderInput, setNewFolderInput] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<string | null>(null);
  const [folderFeedback, setFolderFeedback] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);
  const [batchTargetFolderId, setBatchTargetFolderId] = useState<string>('');
  const [movingBatch, setMovingBatch] = useState(false);
  const [taggingBatch, setTaggingBatch] = useState(false);
  const [deletingBatch, setDeletingBatch] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [editingTagsPhotoId, setEditingTagsPhotoId] = useState<string | null>(null);
  const [cardCustomTagInput, setCardCustomTagInput] = useState('');
  const [cardTagError, setCardTagError] = useState<string | null>(null);
  const [tourOpen, setTourOpen] = useState<boolean>(shouldOpenOnboardingTour);
  const [tourStep, setTourStep] = useState(0);
  const [promptHistoryQuery, setPromptHistoryQuery] = useState('');
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);
  const [expandedExifIds, setExpandedExifIds] = useState<string[]>([]);
  const [lightboxItem, setLightboxItem] = useState<GenerationItem | null>(null);
  const [compareLightboxFilter, setCompareLightboxFilter] = useState(false);
  const [comparePairIds, setComparePairIds] = useState<[string, string] | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [exportFormat, setExportFormat] = useState<SocialExportFormatId>('original');
  const [appliedFilters, setAppliedFilters] = useState<Record<string, ArtisticFilterId>>(
    loadSavedFilters
  );

  const canCompareSelection = canCompareSelectedPhotos(selectedIds);
  const activeComparisonPair = useMemo(
    () =>
      comparePairIds
        ? resolveComparisonPair(generations, comparePairIds)
        : null,
    [generations, comparePairIds]
  );

  const handleOpenComparison = () => {
    const pair = resolveComparisonPair(generations, selectedIds);
    if (!pair) return;
    setComparePairIds([pair[0].id, pair[1].id]);
  };

  const loadSpaceData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [genRes, profRes, credRes, subRes, foldersRes] = await Promise.all([
        apiFetch('/api/generations'),
        apiFetch('/api/profile'),
        apiFetch('/api/credits'),
        apiFetch('/api/subscription'),
        apiFetch('/api/folders').catch(() => null),
      ]);

      if (!genRes.ok || !profRes.ok || !credRes.ok || !subRes.ok) {
        setErrorMsg('Não foi possível carregar alguns dados do seu espaço agora. Tente novamente.');
        return;
      }

      const [genData, profData, credData, subData] = await Promise.all([
        genRes.json(),
        profRes.json(),
        credRes.json(),
        subRes.json(),
      ]);

      setGenerations(genData.generations || []);
      setFaces(profData.faces || []);
      setProfile(profData.profile || null);
      setLedger(credData.ledger || []);
      setSubscription(subData);

      if (foldersRes && foldersRes.ok) {
        const foldersData = (await foldersRes.json()) as { folders?: FolderItem[] };
        setFolders(foldersData.folders || []);
      }
    } catch {
      setErrorMsg('Falha temporária ao carregar seu espaço pessoal. Atualize a página.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSpaceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchTab = (tab: TabId) => {
    setActiveTab(tab);
    searchParams.set('tab', tab);
    setSearchParams(searchParams, { replace: true });
  };

  const uniqueCategories = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of generations) {
      map.set(g.categoryId, g.categoryName);
    }
    return Array.from(map.entries());
  }, [generations]);

  const favoriteCount = useMemo(
    () => generations.filter((g) => g.favorite).length,
    [generations]
  );

  const folderCounts = useMemo(
    () => getFolderCounts(generations, folders),
    [generations, folders]
  );

  const folderById = useMemo(() => {
    const map = new Map<string, FolderItem>();
    for (const folder of folders) {
      map.set(folder.id, folder);
    }
    return map;
  }, [folders]);

  const tagStats = useMemo(() => getTagCounts(generations), [generations]);

  const quickBarTags = useMemo(() => {
    const core: string[] = ['Retrato', 'Paisagem', 'Artístico'];
    for (const tag of tagStats.availableTags) {
      if (
        !core.some((c) => c.toLowerCase() === tag.toLowerCase()) &&
        (tagStats.countsByTag[tag] || 0) > 0
      ) {
        core.push(tag);
      }
    }
    return core;
  }, [tagStats]);

  const filteredPhotos = useMemo(() => {
    return filterMySpacePhotos(generations, {
      searchQuery,
      categoryFilter,
      folderFilter,
      tagFilter,
      dateFilter,
      onlyFavorites: activeTab === 'favoritos' || onlyFavorites,
      folders,
    });
  }, [generations, folders, activeTab, onlyFavorites, categoryFilter, folderFilter, tagFilter, dateFilter, searchQuery]);

  const promptHistoryEntries = useMemo(
    () => extractPromptHistoryEntries(generations, folders, promptHistoryQuery),
    [generations, folders, promptHistoryQuery]
  );

  const closeOnboardingTour = () => {
    setTourOpen(false);
    try {
      window.localStorage.setItem(TOUR_SEEN_STORAGE_KEY, '1');
    } catch {
      // Optional storage
    }
  };

  const setPhotoFilter = (id: string, filterId: ArtisticFilterId) => {
    setAppliedFilters((prev) => {
      const next = applyBatchFilterToMap(prev, [id], filterId);
      try {
        window.localStorage.setItem(FILTER_PREFS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage quota errors for optional UI preference
      }
      return next;
    });
    if (filterId === 'original') {
      setCompareLightboxFilter(false);
    }
  };

  const handleApplyBatchFilter = (filterId: ArtisticFilterId) => {
    if (selectedIds.length === 0) return;
    setAppliedFilters((prev) => {
      const next = applyBatchFilterToMap(prev, selectedIds, filterId);
      try {
        window.localStorage.setItem(FILTER_PREFS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage quota errors
      }
      return next;
    });
    const filterLabel = getArtisticFilter(filterId).label;
    const msg = `Filtro "${filterLabel}" aplicado em ${selectedIds.length} foto${selectedIds.length > 1 ? 's' : ''}.`;
    setFolderFeedback({
      type: 'success',
      text: msg,
    });
    addToast({
      variant: 'success',
      title: 'Filtro aplicado em lote',
      description: msg,
    });
  };

  const handleCreateFolderByName = async (rawName: string) => {
    setFolderFeedback(null);
    const check = validateNewFolderName(folders, rawName);
    if (check.ok === false) {
      setFolderFeedback({ type: 'error', text: check.error });
      return;
    }

    try {
      const res = await apiFetch('/api/folders', {
        method: 'POST',
        body: JSON.stringify({ name: check.name }),
      });
      const data = (await res.json()) as { folder?: FolderItem; error?: string };
      if (!res.ok || !data.folder) {
        setFolderFeedback({
          type: 'error',
          text: data.error || 'Não foi possível criar a pasta.',
        });
        return;
      }
      setFolders((prev) => [...prev, data.folder!]);
      setNewFolderInput('');
      setShowNewFolderForm(false);
      setFolderFeedback({
        type: 'success',
        text: `Pasta "${data.folder.name}" criada.`,
      });
    } catch {
      setFolderFeedback({
        type: 'error',
        text: 'Erro de conexão ao criar a pasta.',
      });
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleCreateFolderByName(newFolderInput);
  };

  const handleRenameFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFolderId) return;
    setFolderFeedback(null);

    const check = validateRenameFolder(folders, editingFolderId, editingFolderName);
    if (check.ok === false) {
      setFolderFeedback({ type: 'error', text: check.error });
      return;
    }

    try {
      const res = await apiFetch(`/api/folders/${editingFolderId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: check.name }),
      });
      const data = (await res.json()) as { folder?: FolderItem; error?: string };
      if (!res.ok || !data.folder) {
        setFolderFeedback({
          type: 'error',
          text: data.error || 'Não foi possível renomear a pasta.',
        });
        return;
      }
      setFolders((prev) =>
        prev.map((f) => (f.id === data.folder!.id ? data.folder! : f))
      );
      setEditingFolderId(null);
      setEditingFolderName('');
      setFolderFeedback({
        type: 'success',
        text: `Pasta renomeada para "${data.folder.name}".`,
      });
    } catch {
      setFolderFeedback({
        type: 'error',
        text: 'Erro de conexão ao renomear a pasta.',
      });
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    setFolderFeedback(null);
    const target = folderById.get(folderId);
    try {
      const res = await apiFetch(`/api/folders/${folderId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setFolderFeedback({
          type: 'error',
          text: data.error || 'Não foi possível excluir a pasta.',
        });
        return;
      }
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      setGenerations((prev) => clearDeletedFolderFromGenerations(prev, folderId));
      setLightboxItem((prev) =>
        prev && prev.folderId === folderId ? { ...prev, folderId: undefined } : prev
      );
      if (folderFilter === folderId) setFolderFilter('all');
      if (batchTargetFolderId === folderId) setBatchTargetFolderId('');
      setConfirmDeleteFolderId(null);
      setFolderFeedback({
        type: 'success',
        text: target
          ? `Pasta "${target.name}" excluída. Suas fotos permanecem em "Sem pasta".`
          : 'Pasta excluída.',
      });
    } catch {
      setFolderFeedback({
        type: 'error',
        text: 'Erro de conexão ao excluir a pasta.',
      });
    }
  };

  const handleAssignPhotoFolder = async (photoId: string, targetFolderId: string | null) => {
    setFolderFeedback(null);
    try {
      const res = await apiFetch(`/api/generations/${photoId}/folder`, {
        method: 'PATCH',
        body: JSON.stringify({ folderId: targetFolderId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        folderId?: string | null;
        error?: string;
      };
      if (!res.ok) {
        setFolderFeedback({
          type: 'error',
          text: data.error || 'Não foi possível mover a foto para a pasta.',
        });
        return;
      }
      const nextFolderId = data.folderId ?? null;
      setGenerations((prev) =>
        applyFolderToGenerations(prev, [photoId], nextFolderId)
      );
      setLightboxItem((prev) =>
        prev && prev.id === photoId
          ? { ...prev, folderId: nextFolderId ?? undefined }
          : prev
      );
    } catch {
      setFolderFeedback({
        type: 'error',
        text: 'Erro de conexão ao atualizar a pasta da foto.',
      });
    }
  };

  const handleUpdatePhotoTags = async (photoId: string, nextTags: string[]) => {
    setErrorMsg(null);
    try {
      const res = await apiFetch(`/api/generations/${photoId}/tags`, {
        method: 'PATCH',
        body: JSON.stringify({ tags: nextTags }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        tags?: string[];
        error?: string;
      };
      if (!res.ok) {
        setErrorMsg(data.error || 'Não foi possível atualizar as tags da foto.');
        return;
      }
      const savedTags = data.tags ?? nextTags;
      setGenerations((prev) =>
        prev.map((g) => (g.id === photoId ? { ...g, tags: savedTags } : g))
      );
      setLightboxItem((prev) =>
        prev && prev.id === photoId ? { ...prev, tags: savedTags } : prev
      );
    } catch {
      setErrorMsg('Erro de conexão ao salvar as tags da foto.');
    }
  };

  const handleBatchAddTag = async (tagName: string) => {
    if (selectedIds.length === 0) return;
    setTaggingBatch(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch('/api/generations/batch-tags', {
        method: 'POST',
        body: JSON.stringify({
          generationIds: selectedIds,
          tag: tagName,
          action: 'add',
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        updated?: Array<{ id: string; tags: string[] }>;
        tag?: string;
        error?: string;
      };
      if (!res.ok || !data.updated) {
        setErrorMsg(data.error || 'Não foi possível aplicar a tag às fotos selecionadas.');
        return;
      }
      const updatedMap = new Map(data.updated.map((u) => [u.id, u.tags]));
      setGenerations((prev) =>
        prev.map((g) => (updatedMap.has(g.id) ? { ...g, tags: updatedMap.get(g.id)! } : g))
      );
      setLightboxItem((prev) =>
        prev && updatedMap.has(prev.id)
          ? { ...prev, tags: updatedMap.get(prev.id)! }
          : prev
      );
      const appliedLabel = data.tag || tagName;
      addToast({
        variant: 'success',
        title: 'Tag aplicada em lote',
        description: `Tag "${appliedLabel}" adicionada em ${data.updated.length} foto${
          data.updated.length > 1 ? 's' : ''
        }.`,
      });
    } catch {
      setErrorMsg('Erro de conexão ao aplicar tag em lote.');
    } finally {
      setTaggingBatch(false);
    }
  };

  const handleBatchMoveToFolder = async () => {
    if (selectedIds.length === 0) return;
    setMovingBatch(true);
    setFolderFeedback(null);
    const targetId = batchTargetFolderId || null;

    try {
      const res = await apiFetch('/api/generations/batch-folder', {
        method: 'POST',
        body: JSON.stringify({
          generationIds: selectedIds,
          folderId: targetId,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        updatedIds?: string[];
        folderId?: string | null;
        error?: string;
      };
      if (!res.ok) {
        setFolderFeedback({
          type: 'error',
          text: data.error || 'Não foi possível mover as fotos selecionadas.',
        });
        return;
      }
      const updatedIds = data.updatedIds ?? selectedIds;
      const resolvedFolderId = data.folderId ?? null;
      setGenerations((prev) =>
        applyFolderToGenerations(prev, updatedIds, resolvedFolderId)
      );
      const targetName = resolvedFolderId
        ? folderById.get(resolvedFolderId)?.name || 'pasta selecionada'
        : 'Sem pasta';
      const msg = `${updatedIds.length} foto${updatedIds.length > 1 ? 's' : ''} movida${updatedIds.length > 1 ? 's' : ''} para ${targetName}.`;
      setFolderFeedback({
        type: 'success',
        text: msg,
      });
      addToast({
        variant: 'success',
        title: 'Fotos movidas com sucesso',
        description: msg,
      });
      setSelectedIds([]);
    } catch {
      setFolderFeedback({
        type: 'error',
        text: 'Erro de conexão ao mover fotos em lote.',
      });
    } finally {
      setMovingBatch(false);
    }
  };

  const handleBatchDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    setDeletingBatch(true);
    setFolderFeedback(null);
    setErrorMsg(null);
    try {
      const res = await apiFetch('/api/generations/batch-delete', {
        method: 'POST',
        body: JSON.stringify({ generationIds: selectedIds }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        deletedIds?: string[];
        error?: string;
      };
      if (!res.ok) {
        setErrorMsg(data.error || 'Não foi possível excluir as fotografias selecionadas.');
        return;
      }
      const deletedSet = new Set(data.deletedIds ?? selectedIds);
      setGenerations((prev) => prev.filter((g) => !deletedSet.has(g.id)));
      setSelectedIds((prev) => prev.filter((id) => !deletedSet.has(id)));
      if (lightboxItem && deletedSet.has(lightboxItem.id)) {
        setLightboxItem(null);
      }
      const msg = `${deletedSet.size} fotografia${deletedSet.size > 1 ? 's' : ''} excluída${deletedSet.size > 1 ? 's' : ''} com sucesso.`;
      setFolderFeedback({
        type: 'success',
        text: msg,
      });
      addToast({
        variant: 'success',
        title: 'Exclusão em lote concluída',
        description: msg,
      });
    } catch {
      setErrorMsg('Erro de conexão ao excluir fotografias em lote.');
    } finally {
      setDeletingBatch(false);
    }
  };

  const handleSelectCurrentFolderPhotos = () => {
    const scopeItems = filterGenerationsByFolder(generations, folderFilter, folders);
    const scopeIds = scopeItems.map((item) => item.id);
    if (scopeIds.length === 0) return;
    const allInScopeSelected = scopeIds.every((id) => selectedIds.includes(id));
    if (allInScopeSelected) {
      const removeSet = new Set(scopeIds);
      setSelectedIds((prev) => prev.filter((id) => !removeSet.has(id)));
    } else {
      const merged = new Set(selectedIds);
      for (const id of scopeIds) merged.add(id);
      setSelectedIds(Array.from(merged));
    }
  };

  const handleExportPdfAlbum = async (itemsToExport: GenerationItem[], albumTitle: string) => {
    if (itemsToExport.length === 0) return;
    setExportingPdf(true);
    setErrorMsg(null);
    try {
      const { blob, filename } = await exportAlbumToPdfBlob({
        albumTitle,
        photos: itemsToExport.map((g) => ({
          id: g.id,
          scenarioTitle: g.scenarioTitle,
          categoryName: g.categoryName,
          promptUsed: g.promptUsed,
          createdAt: g.createdAt,
          url: g.url,
          folderName: g.folderId ? folderById.get(g.folderId)?.name ?? null : null,
        })),
        appliedFilters,
        fetchImageBlob: async (url) => {
          const res = await apiFetch(url);
          if (!res.ok) throw new Error('Falha ao carregar imagem para o PDF.');
          return res.blob();
        },
      });
      triggerBlobDownload(blob, filename);
      const msg = `Álbum "${albumTitle}" exportado em PDF (${itemsToExport.length} foto${itemsToExport.length > 1 ? 's' : ''}).`;
      setFolderFeedback({
        type: 'success',
        text: msg,
      });
      addToast({
        variant: 'success',
        title: 'Álbum PDF exportado',
        description: msg,
      });
    } catch {
      setErrorMsg('Não foi possível exportar o álbum em PDF agora. Tente novamente.');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleCopyPrompt = async (entryId: string, promptText: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(promptText);
      }
      setCopiedPromptId(entryId);
      window.setTimeout(() => {
        setCopiedPromptId((curr) => (curr === entryId ? null : curr));
      }, 2000);
    } catch {
      // Clipboard optional
    }
  };

  const buildRecreateUrl = (item: GenerationItem): string => buildPhotoRecreateUrl(item);

  const toggleSelectPhoto = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleExifPanel = (id: string) => {
    setExpandedExifIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const allFilteredSelected =
    filteredPhotos.length > 0 &&
    filteredPhotos.every((item) => selectedIds.includes(item.id));

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      const visibleIds = new Set(filteredPhotos.map((item) => item.id));
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.has(id)));
    } else {
      const merged = new Set(selectedIds);
      for (const item of filteredPhotos) {
        merged.add(item.id);
      }
      setSelectedIds(Array.from(merged));
    }
  };

  const handleToggleFavorite = async (id: string) => {
    const res = await apiFetch(`/api/generations/${id}/favorite`, { method: 'PATCH' });
    if (res.ok) {
      const data = (await res.json()) as { favorite: boolean };
      setGenerations((prev) =>
        prev.map((g) => (g.id === id ? { ...g, favorite: data.favorite } : g))
      );
      if (lightboxItem?.id === id) {
        setLightboxItem((prev) => (prev ? { ...prev, favorite: data.favorite } : null));
      }
    }
  };

  const handleDeleteGeneration = async (id: string) => {
    const res = await apiFetch(`/api/generations/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setGenerations((prev) => prev.filter((g) => g.id !== id));
      setSelectedIds((prev) => prev.filter((item) => item !== id));
      if (lightboxItem?.id === id) setLightboxItem(null);
    }
  };

  const triggerBlobDownload = (blob: Blob, filename: string) => {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };

  const handleDownloadImage = async (
    item: GenerationItem,
    formatOverride?: SocialExportFormatId
  ) => {
    setDownloadingId(item.id);
    setErrorMsg(null);
    const activeFormat = formatOverride ?? exportFormat;
    try {
      const res = await apiFetch(item.url);
      if (!res.ok) {
        throw new Error('Falha ao baixar imagem');
      }
      const rawBlob = await res.blob();
      const filterId = appliedFilters[item.id] ?? 'original';
      const { blob, ext } = await renderBlobWithArtisticFilter(
        rawBlob,
        filterId,
        activeFormat
      );
      const filename = buildDownloadFilename(
        item.scenarioTitle,
        item.id,
        filterId,
        ext,
        activeFormat
      );
      triggerBlobDownload(blob, filename);
    } catch {
      setErrorMsg('Não foi possível baixar esta fotografia agora. Tente novamente.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleShareInstagram = async (
    item: GenerationItem
  ): Promise<{ mode: 'native' | 'downloaded'; message: string }> => {
    const res = await apiFetch(item.url);
    if (!res.ok) {
      throw new Error('Falha ao carregar imagem para o Instagram.');
    }
    const rawBlob = await res.blob();
    const filterId = appliedFilters[item.id] ?? 'original';
    const targetFormat = exportFormat === 'original' ? 'instagram' : exportFormat;
    const { blob, ext } = await renderBlobWithArtisticFilter(
      rawBlob,
      filterId,
      targetFormat
    );
    const filename = buildDownloadFilename(
      item.scenarioTitle,
      item.id,
      filterId,
      ext,
      targetFormat
    );
    const caption = buildShareCaption({
      scenarioTitle: item.scenarioTitle,
      categoryName: item.categoryName,
      appUrl: window.location.origin,
    });

    const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
    const navWithShare = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
      share?: (data: ShareData) => Promise<void>;
    };

    if (navWithShare.share && navWithShare.canShare?.({ files: [file] })) {
      try {
        await navWithShare.share({
          files: [file],
          title: item.scenarioTitle,
          text: caption,
        });
        return {
          mode: 'native',
          message: 'Compartilhamento enviado ao menu nativo do dispositivo.',
        };
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return {
            mode: 'native',
            message: 'Compartilhamento cancelado.',
          };
        }
      }
    }

    triggerBlobDownload(blob, filename);
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(caption);
        copied = true;
      }
    } catch {
      copied = false;
    }

    return {
      mode: 'downloaded',
      message: copied
        ? 'Foto baixada no formato Instagram (4:5) e legenda copiada! Publique no Instagram.'
        : 'Foto baixada no formato Instagram (4:5)! Abra o Instagram para publicar.',
    };
  };

  const handleDownloadZip = async () => {
    const selectedItems = generations.filter((g) => selectedIds.includes(g.id));
    if (selectedItems.length === 0) return;

    setDownloadingZip(true);
    setErrorMsg(null);
    try {
      const zip = new JSZip();
      for (let i = 0; i < selectedItems.length; i++) {
        const item = selectedItems[i];
        const res = await apiFetch(item.url);
        if (!res.ok) {
          throw new Error(`Falha ao baixar ${item.scenarioTitle}`);
        }
        const rawBlob = await res.blob();
        const filterId = appliedFilters[item.id] ?? 'original';
        const { blob, ext } = await renderBlobWithArtisticFilter(
          rawBlob,
          filterId,
          exportFormat
        );
        const prefix = String(i + 1).padStart(2, '0');
        const baseName = buildDownloadFilename(
          item.scenarioTitle,
          item.id,
          filterId,
          ext,
          exportFormat
        );
        zip.file(`${prefix}-${baseName}`, blob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const formatSuffix = exportFormat !== 'original' ? `-${exportFormat}` : '';
      triggerBlobDownload(
        zipBlob,
        `promptface-selecao-${selectedItems.length}${formatSuffix}.zip`
      );
      addToast({
        variant: 'success',
        title: 'Pacote ZIP gerado',
        description: `${selectedItems.length} fotografia${selectedItems.length > 1 ? 's' : ''} empacotada${selectedItems.length > 1 ? 's' : ''} para download.`,
      });
    } catch {
      setErrorMsg('Não foi possível gerar o arquivo ZIP com as fotos selecionadas. Tente novamente.');
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleCancelSubscription = async () => {
    const res = await apiFetch('/api/subscription/cancel', { method: 'POST' });
    if (res.ok) {
      await refreshUser();
      await loadSpaceData();
    }
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: 'fotos', label: 'Minhas fotografias' },
    { id: 'favoritos', label: 'Favoritos' },
    { id: 'prompts', label: 'Histórico de prompts' },
    { id: 'historico', label: 'Histórico de gerações' },
    { id: 'referencias', label: 'Minhas referências faciais' },
    { id: 'perfil', label: 'Meu perfil visual' },
    { id: 'creditos', label: 'Meus créditos' },
    { id: 'assinatura', label: 'Minha assinatura' },
  ];

  const activeFolderDisplayName =
    folderFilter === 'all'
      ? 'Todas as fotografias'
      : folderFilter === 'unfiled'
      ? 'Sem pasta'
      : folderById.get(folderFilter)?.name || 'Álbum PromptFace';

  const currentFolderScopeCount = filterGenerationsByFolder(
    generations,
    folderFilter,
    folders
  ).length;

  return (
    <div
      className={`mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14 space-y-8 ${
        selectedIds.length > 0 ? 'pb-32' : ''
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-[#8B5CF6]">
            Área pessoal · {user?.email}
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-slate-950 dark:text-white">
            Meu Espaço
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setTourStep(0);
              setTourOpen((prev) => !prev);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-800 hover:text-slate-950 hover:border-violet-700 dark:border-white/15 dark:bg-[#17171F] dark:text-[#A1A1AA] dark:hover:text-white dark:hover:border-[#8B5CF6] transition-colors whitespace-nowrap"
          >
            <HelpCircle className="w-3.5 h-3.5 text-violet-700 dark:text-[#A855F7]" aria-hidden="true" />
            <span>Guia rápido</span>
          </button>
          {user?.role === 'admin' && (
            <Link
              to="/admin"
              className="px-4 py-2.5 rounded-xl border border-violet-700 text-xs font-semibold uppercase tracking-wider text-violet-950 hover:bg-violet-50 dark:border-[#7C3AED] dark:text-white dark:hover:bg-[#7C3AED]/15"
            >
              Painel Admin
            </Link>
          )}
          <Link
            to="/criar"
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white"
          >
            Nova foto
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-800 hover:text-slate-950 dark:border-white/15 dark:bg-transparent dark:text-[#A1A1AA] dark:hover:text-white"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            Sair
          </button>
        </div>
      </div>

      {/* Guia interativo na primeira visita */}
      <MySpaceOnboardingTour
        open={tourOpen}
        stepIndex={tourStep}
        onChangeStep={(idx) => setTourStep(idx)}
        onClose={closeOnboardingTour}
      />

      {/* Tabs */}
      <div role="tablist" aria-label="Abas do Meu Espaço" className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-white/10 pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => switchTab(tab.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === tab.id
                ? 'bg-[#7C3AED] text-white'
                : 'bg-white text-slate-700 border border-slate-300 hover:text-slate-950 dark:bg-[#17171F] dark:text-[#A1A1AA] dark:border-white/10 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div className="rounded-2xl border border-red-600/45 bg-red-50 dark:border-red-500/40 dark:bg-red-950/30 p-6 flex items-center justify-between gap-4">
          <p className="text-sm text-red-950 dark:text-red-200">{errorMsg}</p>
          <button
            type="button"
            onClick={() => void loadSpaceData()}
            className="px-4 py-2 rounded-xl border border-red-600/45 text-xs font-medium text-red-950 dark:border-white/20 dark:text-white"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {loading ? (
        <div className="h-64 rounded-2xl skeleton-violet border border-slate-300 dark:border-white/10" />
      ) : (
        <>
          {!errorMsg && (
            <MySpaceDashboard
              generations={generations}
              remainingCredits={user?.credits ?? 0}
              planId={subscription?.planId ?? user?.planId}
              ledger={ledger}
            />
          )}
          {/* TAB 1 & 2: GALLERY & FAVORITES */}
          {(activeTab === 'fotos' || activeTab === 'favoritos') && (
            <div className="space-y-6">
              <div
                className={`flex flex-col lg:flex-row lg:flex-wrap gap-3 rounded-2xl transition-all ${
                  tourOpen && tourStep === 2 ? 'ring-2 ring-[#A855F7]/70 p-2 bg-violet-50/70 dark:bg-[#17171F]/50' : ''
                }`}
              >
                <div className="relative w-full lg:flex-1 lg:min-w-[280px]">
                  <Search className="w-4 h-4 text-slate-500 dark:text-[#A1A1AA] absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por nome, pasta, tag ou prompt"
                    aria-label="Buscar fotografias por nome, pasta, tag ou prompt"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-950 placeholder:text-slate-500 dark:bg-[#17171F] dark:border-white/15 dark:text-white"
                  />
                </div>
                <select
                  aria-label="Filtrar por categoria"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-950 dark:bg-[#17171F] dark:border-white/15 dark:text-white"
                >
                  <option value="all">Todas as categorias</option>
                  {uniqueCategories.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filtrar por pasta"
                  value={folderFilter}
                  onChange={(e) => setFolderFilter(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-950 dark:bg-[#17171F] dark:border-white/15 dark:text-white"
                >
                  <option value="all">Todas as pastas ({folderCounts.total})</option>
                  <option value="unfiled">Sem pasta ({folderCounts.unfiled})</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      Pasta: {folder.name} ({folderCounts.byFolderId[folder.id] || 0})
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filtrar por tag"
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-950 dark:bg-[#17171F] dark:border-white/15 dark:text-white"
                >
                  <option value="all">Todas as tags ({generations.length})</option>
                  <option value="untagged">Sem tags ({tagStats.untaggedCount})</option>
                  {tagStats.availableTags.map((tagName) => (
                    <option key={tagName} value={tagName}>
                      Tag: {tagName} ({tagStats.countsByTag[tagName] || 0})
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filtrar por data"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as 'all' | '7d' | '30d')}
                  className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-950 dark:bg-[#17171F] dark:border-white/15 dark:text-white"
                >
                  <option value="all">Qualquer data</option>
                  <option value="7d">Últimos 7 dias</option>
                  <option value="30d">Últimos 30 dias</option>
                </select>
                {activeTab === 'fotos' && (
                  <button
                    type="button"
                    aria-pressed={onlyFavorites}
                    onClick={() => setOnlyFavorites((prev) => !prev)}
                    className={`inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-colors whitespace-nowrap ${
                      onlyFavorites
                        ? 'bg-pink-50 border-pink-600 text-pink-950 dark:bg-[#EC4899]/15 dark:border-[#EC4899] dark:text-white'
                        : 'bg-white border-slate-300 text-slate-700 hover:text-slate-950 dark:bg-[#17171F] dark:border-white/15 dark:text-[#A1A1AA] dark:hover:text-white'
                    }`}
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        onlyFavorites ? 'fill-[#EC4899] text-[#EC4899]' : ''
                      }`}
                      aria-hidden="true"
                    />
                    <span>Somente favoritas ({favoriteCount})</span>
                  </button>
                )}
              </div>

              {/* Pastas (Folders) navigation & CRUD panel */}
              <section
                aria-label="Pastas da biblioteca"
                className={`rounded-2xl border pf-card-surface p-4 space-y-3 transition-all shadow-sm dark:shadow-none ${
                  tourOpen && tourStep === 0
                    ? 'border-[#A855F7] ring-2 ring-[#A855F7]/40'
                    : 'border-slate-300 dark:border-white/10'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-violet-700 dark:text-[#8B5CF6]" aria-hidden="true" />
                    <h2 className="font-display text-sm font-semibold text-slate-950 dark:text-white">
                      Pastas por tema ou evento
                    </h2>
                    <span className="text-xs text-slate-700 dark:text-[#A1A1AA]">
                      ({folders.length} {folders.length === 1 ? 'pasta' : 'pastas'})
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {currentFolderScopeCount > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={handleSelectCurrentFolderPhotos}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 text-xs font-medium text-slate-950 hover:border-violet-700 dark:border-white/15 dark:bg-[#08080C] dark:text-white dark:hover:border-[#8B5CF6] transition-colors whitespace-nowrap"
                        >
                          <CheckSquare className="w-3.5 h-3.5 text-violet-700 dark:text-[#8B5CF6]" aria-hidden="true" />
                          <span>Selecionar pasta ({currentFolderScopeCount})</span>
                        </button>
                        <button
                          type="button"
                          disabled={exportingPdf}
                          onClick={() =>
                            void handleExportPdfAlbum(
                              filterGenerationsByFolder(generations, folderFilter, folders),
                              activeFolderDisplayName
                            )
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-50 text-xs font-medium text-slate-950 hover:border-violet-700 dark:border-white/15 dark:bg-[#08080C] dark:text-white dark:hover:border-[#A855F7] disabled:opacity-50 transition-colors whitespace-nowrap"
                        >
                          <FileText className="w-3.5 h-3.5 text-violet-700 dark:text-[#A855F7]" aria-hidden="true" />
                          <span>{exportingPdf ? 'Gerando PDF...' : 'Exportar álbum PDF'}</span>
                        </button>
                      </>
                    )}

                    {!showNewFolderForm && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewFolderForm(true);
                          setFolderFeedback(null);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-violet-700 bg-violet-100 text-xs font-semibold text-violet-950 hover:bg-violet-200 dark:border-[#7C3AED]/70 dark:bg-[#7C3AED]/15 dark:text-white dark:hover:bg-[#7C3AED]/30 transition-colors whitespace-nowrap"
                      >
                        <FolderPlus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Nova pasta</span>
                      </button>
                    )}
                  </div>
                </div>

                {showNewFolderForm && (
                  <div className="rounded-xl border border-violet-500/45 bg-slate-50 dark:border-[#8B5CF6]/40 dark:bg-[#08080C] p-3 space-y-2.5">
                    <form onSubmit={handleCreateFolder} className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={newFolderInput}
                        onChange={(e) => setNewFolderInput(e.target.value)}
                        placeholder="Ex.: Viagens, Formatura, LinkedIn"
                        aria-label="Nome da nova pasta"
                        maxLength={32}
                        className="flex-1 min-w-[180px] px-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-950 focus:outline-none focus:border-violet-700 dark:bg-[#17171F] dark:border-white/15 dark:text-white dark:focus:border-[#8B5CF6]"
                      />
                      <button
                        type="submit"
                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white hover:brightness-110"
                      >
                        Criar pasta
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewFolderForm(false);
                          setNewFolderInput('');
                        }}
                        className="px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-700 hover:text-slate-950 dark:border-white/15 dark:text-[#A1A1AA] dark:hover:text-white"
                      >
                        Cancelar
                      </button>
                    </form>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-slate-700 dark:text-[#A1A1AA]">Sugestões rápidas:</span>
                      {SUGGESTED_FOLDER_NAMES.filter(
                        (s) => !folders.some((f) => f.name.toLowerCase() === s.toLowerCase())
                      ).map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => void handleCreateFolderByName(suggestion)}
                          className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-[11px] text-slate-800 hover:text-slate-950 hover:border-violet-700 dark:border-white/10 dark:bg-[#17171F] dark:text-[#A1A1AA] dark:hover:text-white dark:hover:border-[#8B5CF6] transition-colors"
                        >
                          + {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFolderFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                      folderFilter === 'all'
                        ? 'bg-[#7C3AED] border-[#A855F7] text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-800 hover:text-slate-950 dark:bg-[#08080C] dark:border-white/10 dark:text-[#A1A1AA] dark:hover:text-white'
                    }`}
                  >
                    Todas ({folderCounts.total})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFolderFilter(folderFilter === 'unfiled' ? 'all' : 'unfiled')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors ${
                      folderFilter === 'unfiled'
                        ? 'bg-[#7C3AED] border-[#A855F7] text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-800 hover:text-slate-950 dark:bg-[#08080C] dark:border-white/10 dark:text-[#A1A1AA] dark:hover:text-white'
                    }`}
                  >
                    Sem pasta ({folderCounts.unfiled})
                  </button>

                  {folders.map((folder) => {
                    const isActive = folderFilter === folder.id;
                    const count = folderCounts.byFolderId[folder.id] || 0;

                    if (editingFolderId === folder.id) {
                      return (
                        <form
                          key={folder.id}
                          onSubmit={handleRenameFolder}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl border border-violet-700 bg-slate-50 dark:border-[#8B5CF6] dark:bg-[#08080C]"
                        >
                          <input
                            type="text"
                            value={editingFolderName}
                            onChange={(e) => setEditingFolderName(e.target.value)}
                            aria-label={`Novo nome para ${folder.name}`}
                            maxLength={32}
                            className="w-32 px-2 py-1 rounded-lg bg-white border border-slate-300 text-xs text-slate-950 focus:outline-none dark:bg-[#17171F] dark:border-white/15 dark:text-white"
                          />
                          <button
                            type="submit"
                            aria-label={`Salvar nome da pasta ${folder.name}`}
                            className="p-1.5 rounded-lg bg-[#7C3AED] text-white hover:brightness-110"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Cancelar renomeação"
                            onClick={() => {
                              setEditingFolderId(null);
                              setEditingFolderName('');
                            }}
                            className="p-1.5 rounded-lg text-slate-700 hover:text-slate-950 dark:text-[#A1A1AA] dark:hover:text-white"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </form>
                      );
                    }

                    if (confirmDeleteFolderId === folder.id) {
                      return (
                        <div
                          key={folder.id}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-red-600/50 bg-red-50 text-xs text-red-950 dark:border-red-500/50 dark:bg-red-950/30 dark:text-white"
                        >
                          <span>Excluir "{folder.name}"?</span>
                          <button
                            type="button"
                            onClick={() => void handleDeleteFolder(folder.id)}
                            className="px-2 py-0.5 rounded-md bg-red-600 text-white font-medium hover:bg-red-500"
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteFolderId(null)}
                            className="px-2 py-0.5 rounded-md border border-slate-300 text-slate-800 hover:text-slate-950 dark:border-white/15 dark:text-[#A1A1AA] dark:hover:text-white"
                          >
                            Cancelar
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={folder.id}
                        className={`inline-flex items-center rounded-xl border transition-colors ${
                          isActive
                            ? 'bg-[#7C3AED] border-[#A855F7] text-white'
                            : 'bg-slate-50 border-slate-300 text-slate-800 hover:border-slate-500 dark:bg-[#08080C] dark:border-white/10 dark:text-[#A1A1AA] dark:hover:border-white/25'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setFolderFilter(isActive ? 'all' : folder.id)}
                          className={`inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 text-xs font-medium ${
                            isActive ? 'text-white' : 'text-slate-900 hover:text-slate-950 dark:text-white/90 dark:hover:text-white'
                          }`}
                        >
                          {isActive ? (
                            <FolderOpen className="w-3.5 h-3.5" aria-hidden="true" />
                          ) : (
                            <Folder className="w-3.5 h-3.5 text-violet-700 dark:text-[#8B5CF6]" aria-hidden="true" />
                          )}
                          <span>{folder.name}</span>
                          <span className="text-[11px] opacity-80 font-mono-num">({count})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmDeleteFolderId(null);
                            setEditingFolderId(folder.id);
                            setEditingFolderName(folder.name);
                          }}
                          aria-label={`Renomear pasta ${folder.name}`}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isActive
                              ? 'text-white/80 hover:text-white hover:bg-white/10'
                              : 'text-slate-600 hover:text-slate-950 dark:text-[#A1A1AA] dark:hover:text-white'
                          }`}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingFolderId(null);
                            setConfirmDeleteFolderId(folder.id);
                          }}
                          aria-label={`Excluir pasta ${folder.name}`}
                          className={`p-1.5 pr-2.5 rounded-lg transition-colors ${
                            isActive
                              ? 'text-white/80 hover:text-red-200 hover:bg-white/10'
                              : 'text-slate-600 hover:text-red-700 dark:text-[#A1A1AA] dark:hover:text-red-400'
                          }`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}

                  {folders.length === 0 && !showNewFolderForm && (
                    <div className="flex flex-wrap items-center gap-1.5 pl-1">
                      <span className="text-xs text-slate-700 dark:text-[#A1A1AA]">Comece rápido:</span>
                      {SUGGESTED_FOLDER_NAMES.slice(0, 3).map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => void handleCreateFolderByName(suggestion)}
                          className="px-2.5 py-1 rounded-xl border border-dashed border-slate-400 text-xs text-slate-700 hover:text-slate-950 hover:border-violet-700 dark:border-white/20 dark:text-[#A1A1AA] dark:hover:text-white dark:hover:border-[#8B5CF6] transition-colors"
                        >
                          + {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {folderFeedback && (
                  <div
                    role="status"
                    className={`rounded-xl px-3 py-2 text-xs flex items-center justify-between gap-2 ${
                      folderFeedback.type === 'error'
                        ? 'border border-red-600/45 bg-red-50 text-red-950 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-200'
                        : 'border border-emerald-600/45 bg-emerald-50 text-emerald-950 dark:border-emerald-500/35 dark:bg-emerald-950/25 dark:text-emerald-200'
                    }`}
                  >
                    <span>{folderFeedback.text}</span>
                    <button
                      type="button"
                      onClick={() => setFolderFeedback(null)}
                      aria-label="Fechar aviso de pasta"
                      className="text-current opacity-80 hover:opacity-100"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </section>

              {/* Barra rápida de organização por Tags */}
              <section
                aria-label="Tags de organização"
                data-testid="myspace-tags-bar"
                className="rounded-2xl border border-slate-300 dark:border-white/10 pf-card-surface px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm dark:shadow-none"
              >
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-violet-700 dark:text-[#A855F7]" aria-hidden="true" />
                  <h2 className="font-display text-xs sm:text-sm font-semibold text-slate-950 dark:text-white">
                    Tags para organização
                  </h2>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTagFilter('all')}
                    className={`px-3 py-1 rounded-xl text-xs font-medium border transition-colors ${
                      tagFilter === 'all'
                        ? 'bg-[#7C3AED] border-[#A855F7] text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-800 hover:text-slate-950 dark:bg-[#08080C] dark:border-white/10 dark:text-[#A1A1AA] dark:hover:text-white'
                    }`}
                  >
                    Todas ({generations.length})
                  </button>
                  {quickBarTags.map((tagName) => {
                    const active = tagFilter.toLowerCase() === tagName.toLowerCase();
                    const count = tagStats.countsByTag[tagName] || 0;
                    return (
                      <button
                        key={tagName}
                        type="button"
                        onClick={() => setTagFilter(active ? 'all' : tagName)}
                        className={`px-3 py-1 rounded-xl text-xs font-medium border transition-colors ${
                          active
                            ? 'bg-[#7C3AED] border-[#A855F7] text-white'
                            : 'bg-slate-50 border-slate-300 text-slate-800 hover:text-slate-950 dark:bg-[#08080C] dark:border-white/10 dark:text-[#A1A1AA] dark:hover:text-white'
                        }`}
                      >
                        {tagName} <span className="font-mono-num opacity-80">({count})</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setTagFilter(tagFilter === 'untagged' ? 'all' : 'untagged')}
                    className={`px-3 py-1 rounded-xl text-xs font-medium border transition-colors ${
                      tagFilter === 'untagged'
                        ? 'bg-[#7C3AED] border-[#A855F7] text-white'
                        : 'bg-slate-50 border-slate-300 text-slate-800 hover:text-slate-950 dark:bg-[#08080C] dark:border-white/10 dark:text-[#A1A1AA] dark:hover:text-white'
                    }`}
                  >
                    Sem tags <span className="font-mono-num opacity-80">({tagStats.untaggedCount})</span>
                  </button>
                </div>
              </section>

              {filteredPhotos.length > 0 && (
                <div className="rounded-2xl border border-slate-300 dark:border-white/10 pf-card-surface px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm dark:shadow-none">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-950 hover:border-violet-700 dark:border-white/15 dark:text-white dark:hover:border-[#8B5CF6] transition-colors"
                    >
                      {allFilteredSelected ? (
                        <CheckSquare className="w-4 h-4 text-violet-700 dark:text-[#8B5CF6]" aria-hidden="true" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500 dark:text-[#A1A1AA]" aria-hidden="true" />
                      )}
                      <span>{allFilteredSelected ? 'Limpar seleção' : 'Selecionar todas'}</span>
                    </button>
                    <span className="text-xs text-slate-700 dark:text-[#A1A1AA]">
                      {selectedIds.length === 1
                        ? '1 selecionada · selecione mais 1 para comparar lado a lado'
                        : selectedIds.length === 2
                        ? '2 selecionadas · prontas para comparar lado a lado'
                        : selectedIds.length > 2
                        ? `${selectedIds.length} selecionadas`
                        : 'Selecione fotos para comparar, mover para pastas ou baixar em ZIP'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {canCompareSelection && (
                      <button
                        type="button"
                        onClick={handleOpenComparison}
                        aria-label="Comparar as 2 fotos selecionadas lado a lado"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-violet-700 bg-violet-100 text-xs font-semibold text-violet-950 hover:bg-violet-200 dark:border-[#A855F7] dark:bg-[#7C3AED]/20 dark:text-white dark:hover:bg-[#7C3AED]/35 transition-colors whitespace-nowrap"
                      >
                        <Columns2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Comparar lado a lado (2)</span>
                      </button>
                    )}
                    {selectedIds.length > 0 && (
                      <div className="inline-flex flex-wrap items-center gap-1.5">
                        <select
                          aria-label="Pasta de destino para seleção"
                          value={batchTargetFolderId}
                          onChange={(e) => setBatchTargetFolderId(e.target.value)}
                          className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
                        >
                          <option value="">Sem pasta</option>
                          {folders.map((folder) => (
                            <option key={folder.id} value={folder.id}>
                              Pasta: {folder.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => void handleBatchMoveToFolder()}
                          disabled={movingBatch}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-violet-700 bg-violet-100 text-xs font-semibold text-violet-950 hover:bg-violet-200 dark:border-[#7C3AED] dark:bg-[#7C3AED]/15 dark:text-white dark:hover:bg-[#7C3AED]/30 disabled:opacity-50 transition-colors"
                        >
                          <FolderInput className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{movingBatch ? 'Movendo...' : 'Mover seleção'}</span>
                        </button>
                      </div>
                    )}
                    <select
                      aria-label="Formato para redes sociais"
                      value={exportFormat}
                      onChange={(e) => setExportFormat(e.target.value as SocialExportFormatId)}
                      className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
                    >
                      {SOCIAL_EXPORT_FORMATS.map((fmt) => (
                        <option key={fmt.id} value={fmt.id}>
                          Exportar: {fmt.label}
                        </option>
                      ))}
                    </select>
                    {selectedIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedIds([])}
                        className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs text-slate-700 hover:text-slate-950 dark:border-white/10 dark:text-[#A1A1AA] dark:hover:text-white transition-colors"
                      >
                        Desmarcar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleDownloadZip()}
                      disabled={selectedIds.length === 0 || downloadingZip}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all disabled:opacity-45 ${
                        selectedIds.length > 0
                          ? 'bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white shadow-lg shadow-[#7C3AED]/20 hover:brightness-110'
                          : 'border border-slate-300 bg-slate-100 text-slate-600 dark:border-white/15 dark:bg-[#08080C] dark:text-[#A1A1AA]'
                      }`}
                    >
                      <Archive className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        {downloadingZip
                          ? 'Gerando ZIP...'
                          : `Baixar ZIP (${selectedIds.length})`}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {filteredPhotos.length === 0 ? (
                <div className="rounded-2xl border border-slate-300 dark:border-white/10 pf-card-surface p-12 text-center space-y-4 shadow-sm dark:shadow-none">
                  <p className="font-display text-lg font-semibold text-slate-950 dark:text-white">
                    Nenhum resultado encontrado
                  </p>
                  <p className="text-sm text-slate-700 dark:text-[#A1A1AA]">
                    {generations.length === 0
                      ? 'Você ainda não gerou nenhuma fotografia.'
                      : 'Nenhuma foto corresponde aos filtros aplicados.'}
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    {(searchQuery || categoryFilter !== 'all' || folderFilter !== 'all' || tagFilter !== 'all' || dateFilter !== 'all' || onlyFavorites) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setCategoryFilter('all');
                          setFolderFilter('all');
                          setTagFilter('all');
                          setDateFilter('all');
                          setOnlyFavorites(false);
                        }}
                        className="px-4 py-2.5 rounded-xl border border-violet-700 text-xs font-semibold uppercase tracking-wider text-violet-950 dark:border-[#7C3AED] dark:text-white"
                      >
                        Limpar filtros
                      </button>
                    )}
                    <Link
                      to="/criar"
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white"
                    >
                      Criar nova foto
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                  {filteredPhotos.map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    const activeFilterId = appliedFilters[item.id] ?? 'original';
                    const activeFilter = getArtisticFilter(activeFilterId);
                    const isExifOpen = expandedExifIds.includes(item.id);
                    const isTagEditorOpen = editingTagsPhotoId === item.id;
                    const itemTags = item.tags ?? [];
                    const exif = formatPhotoExifMetadata({
                      scenarioTitle: item.scenarioTitle,
                      categoryName: item.categoryName,
                      promptUsed: item.promptUsed,
                      createdAt: item.createdAt,
                      appliedFilterId: activeFilterId,
                      aspectRatio: item.aspectRatio,
                      mimeType: item.mimeType,
                      mode: item.mode,
                      model: item.model,
                      provider: item.provider,
                      synthIdMarked: item.synthIdMarked,
                      costCredits: item.costCredits,
                    });
                    return (
                      <article
                        key={item.id}
                        className={`rounded-2xl border pf-card-surface overflow-hidden flex flex-col transition-colors shadow-sm dark:shadow-none ${
                          isSelected
                            ? 'border-violet-700 ring-1 ring-violet-600/40 dark:border-[#8B5CF6] dark:ring-[#8B5CF6]/50'
                            : 'border-slate-300 hover:border-slate-400 dark:border-white/10 dark:hover:border-white/20'
                        }`}
                      >
                        <div className="relative aspect-[3/4] overflow-hidden bg-[#08080C] group">
                          <button
                            type="button"
                            onClick={() => {
                              setCompareLightboxFilter(false);
                              setLightboxItem(item);
                            }}
                            aria-label={`Visualizar ${item.scenarioTitle} em resolução completa`}
                            className="block w-full h-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
                          >
                            <ImageWithFallback
                              src={getMediaUrl(item.url)}
                              alt={item.scenarioTitle}
                              showSkeleton
                              className={`w-full h-full object-cover object-center transition-all duration-200 group-hover:scale-[1.02] ${activeFilter.cssClass}`}
                            />
                          </button>
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={isSelected}
                            aria-label={`Selecionar ${item.scenarioTitle}`}
                            onClick={() => toggleSelectPhoto(item.id)}
                            className={`absolute top-2.5 left-2.5 p-2 rounded-lg transition-colors ${
                              isSelected
                                ? 'bg-[#7C3AED] text-white'
                                : 'bg-[#08080C]/80 text-white hover:bg-[#7C3AED]/80'
                            }`}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4" aria-hidden="true" />
                            ) : (
                              <Square className="w-4 h-4" aria-hidden="true" />
                            )}
                          </button>
                          <div className="absolute top-2.5 right-2.5 flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setCompareLightboxFilter(false);
                                setLightboxItem(item);
                              }}
                              aria-label={`Ampliar ${item.scenarioTitle}`}
                              className="p-2 rounded-lg bg-[#08080C]/80 text-white hover:bg-[#7C3AED]"
                            >
                              <Maximize2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              aria-pressed={item.favorite}
                              onClick={() => handleToggleFavorite(item.id)}
                              aria-label={
                                item.favorite
                                  ? `Remover dos favoritos: ${item.scenarioTitle}`
                                  : `Favoritar ${item.scenarioTitle}`
                              }
                              className="p-2 rounded-lg bg-[#08080C]/80 text-white hover:bg-[#EC4899]"
                            >
                              <Heart
                                className={`w-4 h-4 ${
                                  item.favorite ? 'fill-[#EC4899] text-[#EC4899]' : ''
                                }`}
                              />
                            </button>
                          </div>
                          <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
                            <span className="text-[11px] text-white/90 bg-[#08080C]/80 px-2 py-0.5 rounded">
                              Foto gerada por IA
                            </span>
                            {activeFilter.id !== 'original' && (
                              <span className="text-[11px] text-white bg-[#7C3AED]/90 px-2 py-0.5 rounded">
                                {activeFilter.label}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs text-slate-700 dark:text-[#A1A1AA]">
                                {item.categoryName} · {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                              </p>
                              <h2 className="font-display text-sm font-semibold text-slate-950 dark:text-white truncate">
                                {item.scenarioTitle}
                              </h2>
                            </div>
                            <button
                              type="button"
                              aria-expanded={isExifOpen}
                              aria-label={`Metadados EXIF: ${item.scenarioTitle}`}
                              onClick={() => toggleExifPanel(item.id)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium shrink-0 transition-colors ${
                                isExifOpen
                                  ? 'bg-violet-100 border-violet-700 text-violet-950 dark:bg-[#7C3AED]/20 dark:border-[#8B5CF6] dark:text-white'
                                  : 'bg-slate-50 border-slate-300 text-slate-700 hover:text-slate-950 dark:bg-[#08080C] dark:border-white/10 dark:text-[#A1A1AA] dark:hover:text-white'
                              }`}
                            >
                              <Info className="w-3 h-3" aria-hidden="true" />
                              <span>EXIF</span>
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="flex items-center gap-1.5">
                              <Palette className="w-3.5 h-3.5 text-violet-700 dark:text-[#8B5CF6] shrink-0" aria-hidden="true" />
                              <select
                                aria-label={`Filtro artístico: ${item.scenarioTitle}`}
                                value={activeFilterId}
                                onChange={(e) =>
                                  setPhotoFilter(item.id, e.target.value as ArtisticFilterId)
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
                              >
                                {ARTISTIC_FILTERS.map((f) => (
                                  <option key={f.id} value={f.id}>
                                    Filtro: {f.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Folder className="w-3.5 h-3.5 text-violet-700 dark:text-[#8B5CF6] shrink-0" aria-hidden="true" />
                              <select
                                aria-label={`Pasta: ${item.scenarioTitle}`}
                                value={item.folderId && folderById.has(item.folderId) ? item.folderId : ''}
                                onChange={(e) =>
                                  void handleAssignPhotoFolder(item.id, e.target.value || null)
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
                              >
                                <option value="">Sem pasta</option>
                                  {folders.map((folder) => (
                                    <option key={folder.id} value={folder.id}>
                                      Pasta: {folder.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Tags da fotografia + editor inline */}
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {itemTags.map((tagName) => (
                                  <span
                                    key={tagName}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border border-violet-600/40 bg-violet-50 text-[11px] font-medium text-violet-950 dark:border-[#8B5CF6]/45 dark:bg-[#7C3AED]/15 dark:text-violet-100"
                                  >
                                    <span>{tagName}</span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleUpdatePhotoTags(
                                          item.id,
                                          togglePhotoTag(itemTags, tagName)
                                        )
                                      }
                                      aria-label={`Remover tag ${tagName} de ${item.scenarioTitle}`}
                                      className="text-violet-700 hover:text-slate-950 dark:text-violet-300 dark:hover:text-white"
                                    >
                                      <X className="w-3 h-3" aria-hidden="true" />
                                    </button>
                                  </span>
                                ))}
                                <button
                                  type="button"
                                  aria-expanded={isTagEditorOpen}
                                  aria-label={`Gerenciar tags: ${item.scenarioTitle}`}
                                  onClick={() => {
                                    setCardTagError(null);
                                    setCardCustomTagInput('');
                                    setEditingTagsPhotoId((curr) =>
                                      curr === item.id ? null : item.id
                                    );
                                  }}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-medium transition-colors ${
                                    isTagEditorOpen
                                      ? 'bg-[#7C3AED] border-[#A855F7] text-white'
                                      : 'border-dashed border-slate-400 text-slate-700 hover:text-slate-950 hover:border-violet-700 dark:border-white/25 dark:text-[#A1A1AA] dark:hover:text-white dark:hover:border-[#8B5CF6]'
                                  }`}
                                >
                                  <Tag className="w-3 h-3" aria-hidden="true" />
                                  <span>{itemTags.length === 0 ? 'Adicionar tag' : '+ Tag'}</span>
                                </button>
                              </div>

                              {isTagEditorOpen && (
                                <div
                                  data-testid={`card-tag-editor-${item.id}`}
                                  className="rounded-xl border border-slate-300 bg-slate-50 dark:border-white/15 dark:bg-[#08080C] p-2.5 space-y-2"
                                >
                                  <div className="flex flex-wrap gap-1.5">
                                    {PRESET_PHOTO_TAGS.map((tagName) => {
                                      const active = hasTag(itemTags, tagName);
                                      return (
                                        <button
                                          key={tagName}
                                          type="button"
                                          aria-pressed={active}
                                          onClick={() =>
                                            void handleUpdatePhotoTags(
                                              item.id,
                                              togglePhotoTag(itemTags, tagName)
                                            )
                                          }
                                          className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                                            active
                                              ? 'bg-[#7C3AED] border-[#A855F7] text-white'
                                              : 'bg-white border-slate-300 text-slate-800 hover:border-violet-700 dark:bg-[#17171F] dark:border-white/15 dark:text-[#A1A1AA] dark:hover:text-white'
                                          }`}
                                        >
                                          {tagName}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <form
                                    onSubmit={(e) => {
                                      e.preventDefault();
                                      const res = addTagToList(itemTags, cardCustomTagInput);
                                      if (res.ok === false) {
                                        setCardTagError(res.error);
                                        return;
                                      }
                                      setCardTagError(null);
                                      setCardCustomTagInput('');
                                      void handleUpdatePhotoTags(item.id, res.tags);
                                    }}
                                    className="flex items-center gap-1.5"
                                  >
                                    <input
                                      type="text"
                                      value={cardCustomTagInput}
                                      onChange={(e) => setCardCustomTagInput(e.target.value)}
                                      placeholder="Tag personalizada..."
                                      aria-label={`Nova tag para ${item.scenarioTitle}`}
                                      maxLength={24}
                                      className="flex-1 min-w-0 px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-xs text-slate-950 focus:outline-none focus:border-violet-700 dark:bg-[#17171F] dark:border-white/15 dark:text-white"
                                    />
                                    <button
                                      type="submit"
                                      aria-label={`Adicionar tag personalizada em ${item.scenarioTitle}`}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#7C3AED] text-[11px] font-medium text-white hover:brightness-110 shrink-0"
                                    >
                                      <Plus className="w-3 h-3" aria-hidden="true" />
                                      <span>Salvar</span>
                                    </button>
                                  </form>
                                  {cardTagError && (
                                    <p role="alert" className="text-[11px] text-red-700 dark:text-red-300">
                                      {cardTagError}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>

                          {isExifOpen && (
                            <dl
                              data-testid={`exif-panel-${item.id}`}
                              className="rounded-xl border border-slate-300 bg-slate-50 dark:border-white/10 dark:bg-[#08080C] p-3 space-y-2 text-xs"
                            >
                              <div>
                                <dt className="text-[11px] uppercase tracking-wider text-slate-700 dark:text-[#A1A1AA]">
                                  Prompt utilizado
                                </dt>
                                <dd className="mt-0.5 text-slate-950 dark:text-white/95 leading-relaxed break-words">
                                  {exif.prompt}
                                </dd>
                              </div>
                              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 dark:border-white/10">
                                <div>
                                  <dt className="text-[11px] text-slate-700 dark:text-[#A1A1AA]">Modelo de IA</dt>
                                  <dd className="font-medium text-slate-950 dark:text-white">{exif.modelLabel}</dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] text-slate-700 dark:text-[#A1A1AA]">Criação</dt>
                                  <dd className="font-mono-num text-slate-950 dark:text-white">{exif.createdAtFormatted}</dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] text-slate-700 dark:text-[#A1A1AA]">Filtro aplicado</dt>
                                  <dd className="text-violet-700 dark:text-[#A855F7] font-semibold">{exif.appliedFilterLabel}</dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] text-slate-700 dark:text-[#A1A1AA]">Proporção · Formato</dt>
                                  <dd className="font-mono-num text-slate-950 dark:text-white">
                                    {exif.aspectRatio} · {exif.formatLabel}
                                  </dd>
                                </div>
                              </div>
                            </dl>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <div className="flex items-center gap-3">
                              <Link
                                to={`/studio?foto=${item.id}`}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-700 dark:text-[#8B5CF6] hover:underline"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                                Studio
                              </Link>
                              <Link
                                to={buildRecreateUrl(item)}
                                aria-label={`Recriar ${item.scenarioTitle}`}
                                className="inline-flex items-center gap-1 text-xs text-slate-700 hover:text-slate-950 dark:text-[#A1A1AA] dark:hover:text-white"
                              >
                                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                                Recriar
                              </Link>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void handleDownloadImage(item)}
                                disabled={downloadingId === item.id}
                                aria-label={`Download ${item.scenarioTitle}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-700 text-xs font-medium text-violet-950 hover:bg-violet-50 dark:border-[#7C3AED]/70 dark:text-white dark:hover:bg-[#7C3AED]/20 disabled:opacity-50 transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>{downloadingId === item.id ? 'Baixando...' : 'Download'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteGeneration(item.id)}
                                aria-label={`Excluir ${item.scenarioTitle}`}
                                className="p-2 rounded-lg border border-slate-300 text-slate-700 hover:text-red-700 dark:border-white/10 dark:text-[#A1A1AA] dark:hover:text-red-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: PROMPT HISTORY */}
          {activeTab === 'prompts' && (
            <section
              aria-labelledby="historico-prompts-titulo"
              className="space-y-5"
            >
              <div className="rounded-2xl border border-slate-300 dark:border-white/10 pf-card-surface p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm dark:shadow-none">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-violet-700 dark:text-[#A855F7]">
                    <History className="w-4 h-4" aria-hidden="true" />
                    <span>Biblioteca de criações anteriores</span>
                  </div>
                  <h2
                    id="historico-prompts-titulo"
                    className="mt-1 font-display text-lg font-semibold text-slate-950 dark:text-white"
                  >
                    Histórico de prompts utilizados ({promptHistoryEntries.length})
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-700 dark:text-[#A1A1AA]">
                    Reaproveite combinações de roupa, ambiente, luz e estilo diretamente no Criador.
                  </p>
                </div>

                <div className="relative sm:w-80">
                  <Search
                    className="w-4 h-4 text-slate-500 dark:text-[#A1A1AA] absolute left-3.5 top-1/2 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={promptHistoryQuery}
                    onChange={(e) => setPromptHistoryQuery(e.target.value)}
                    placeholder="Buscar palavra-chave no prompt ou pasta"
                    aria-label="Buscar no histórico de prompts"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
                  />
                </div>
              </div>

              {promptHistoryEntries.length === 0 ? (
                <div className="rounded-2xl border border-slate-300 dark:border-white/10 pf-card-surface p-10 text-center space-y-3 shadow-sm dark:shadow-none">
                  <p className="text-sm text-slate-700 dark:text-[#A1A1AA]">
                    {generations.length === 0
                      ? 'Nenhum prompt registrado ainda. Gere sua primeira foto para salvar o estilo aqui.'
                      : 'Nenhum prompt encontrado para essa busca.'}
                  </p>
                  {generations.length === 0 && (
                    <Link
                      to="/criar"
                      className="inline-flex px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white"
                    >
                      Criar fotografia
                    </Link>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {promptHistoryEntries.map((entry) => (
                    <article
                      key={entry.id}
                      data-testid={`prompt-history-card-${entry.id}`}
                      className="rounded-2xl border border-slate-300 dark:border-white/10 pf-card-surface p-4 flex gap-4 items-start shadow-sm dark:shadow-none"
                    >
                      <div className="w-20 aspect-[3/4] rounded-xl overflow-hidden bg-slate-200 dark:bg-[#08080C] shrink-0">
                        <ImageWithFallback
                          src={getMediaUrl(entry.url)}
                          alt={entry.scenarioTitle}
                          showSkeleton
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex-1 min-w-0 space-y-2">
                        <div>
                          <p className="text-[11px] text-slate-700 dark:text-[#A1A1AA]">
                            {entry.categoryName}
                            {entry.folderName ? ` · Pasta: ${entry.folderName}` : ''} ·{' '}
                            {new Date(entry.createdAt).toLocaleDateString('pt-BR')}
                          </p>
                          <h3 className="font-display text-sm font-semibold text-slate-950 dark:text-white truncate">
                            {entry.scenarioTitle}
                          </h3>
                        </div>

                        <p className="text-xs text-slate-900 bg-slate-50 border border-slate-300 dark:text-white/90 dark:bg-[#08080C] dark:border-white/10 rounded-xl p-2.5 leading-relaxed break-words">
                          {entry.promptUsed}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          <Link
                            to={entry.recreateUrl}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7C3AED] text-xs font-medium text-white hover:brightness-110 transition-all whitespace-nowrap"
                          >
                            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Reutilizar estilo</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => void handleCopyPrompt(entry.id, entry.promptUsed)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-xs font-medium text-slate-800 hover:text-slate-950 dark:border-white/15 dark:bg-[#08080C] dark:text-[#A1A1AA] dark:hover:text-white transition-colors whitespace-nowrap"
                          >
                            {copiedPromptId === entry.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                                <span className="text-emerald-800 dark:text-emerald-300">Copiado</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Copiar prompt</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* TAB 3: GENERATION HISTORY */}
          {activeTab === 'historico' && (
            <div className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] overflow-x-auto shadow-sm dark:shadow-none">
              {generations.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-700 dark:text-[#A1A1AA]">
                  Nenhuma geração registrada até o momento.
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-[#A1A1AA]">
                    <tr>
                      <th className="py-3.5 px-5">Data</th>
                      <th className="py-3.5 px-5">Cenário e prompt</th>
                      <th className="py-3.5 px-5 text-right">Custo</th>
                      <th className="py-3.5 px-5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                    {generations.map((g) => (
                      <tr key={g.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02]">
                        <td className="py-3 px-5 text-xs text-slate-700 dark:text-[#A1A1AA] font-mono-num whitespace-nowrap">
                          {new Date(g.createdAt).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-3 px-5">
                          <p className="text-slate-950 dark:text-white font-medium">{g.scenarioTitle}</p>
                          {g.promptUsed && (
                            <p className="mt-0.5 text-xs text-slate-700 dark:text-[#A1A1AA] line-clamp-2">
                              {g.promptUsed}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-5 text-right font-mono-num text-slate-950 dark:text-white whitespace-nowrap">
                          {g.costCredits} créditos
                        </td>
                        <td className="py-3 px-5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">Concluída</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 4: FACE REFERENCES */}
          {activeTab === 'referencias' && (
            <div className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-6 space-y-6 shadow-sm dark:shadow-none">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-slate-950 dark:text-white">
                    Minhas referências faciais ({faces.length})
                  </h2>
                  <p className="text-xs text-slate-700 dark:text-[#A1A1AA]">
                    Todas as fotos enviadas são privadas e protegidas por LGPD.
                  </p>
                </div>
                <Link
                  to="/perfil-visual"
                  className="px-4 py-2.5 rounded-xl border border-violet-700 text-xs font-semibold uppercase tracking-wider text-violet-950 hover:bg-violet-50 dark:border-[#7C3AED] dark:text-white dark:hover:bg-[#7C3AED]/15"
                >
                  Gerenciar fotos
                </Link>
              </div>
              {faces.length === 0 ? (
                <p className="text-sm text-slate-700 dark:text-[#A1A1AA]">Nenhuma foto de referência enviada.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {faces.map((f) => (
                    <div
                      key={f.id}
                      className="aspect-[3/4] rounded-xl overflow-hidden border border-slate-300 bg-slate-100 dark:border-white/10 dark:bg-[#08080C]"
                    >
                      <ImageWithFallback
                        src={getMediaUrl(f.url)}
                        alt="Referência facial"
                        showSkeleton
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: VISUAL PROFILE */}
          {activeTab === 'perfil' && (
            <div className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-6 space-y-5 shadow-sm dark:shadow-none">
              <div className="flex items-center justify-between gap-4">
                <h2 className="font-display text-lg font-semibold text-slate-950 dark:text-white">
                  Resumo do Perfil Visual
                </h2>
                <Link
                  to="/perfil-visual"
                  className="px-4 py-2.5 rounded-xl border border-violet-700 text-xs font-semibold uppercase tracking-wider text-violet-950 hover:bg-violet-50 dark:border-[#7C3AED] dark:text-white dark:hover:bg-[#7C3AED]/15"
                >
                  Editar Perfil Visual
                </Link>
              </div>
              {profile ? (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-xs text-slate-700 dark:text-[#A1A1AA]">Olhos</dt>
                    <dd className="text-slate-950 dark:text-white">{profile.eyeColor || 'Não informado'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-700 dark:text-[#A1A1AA]">Cabelo</dt>
                    <dd className="text-slate-950 dark:text-white">{profile.hairColorStyle || 'Não informado'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-700 dark:text-[#A1A1AA]">Barba / bigode</dt>
                    <dd className="text-slate-950 dark:text-white">{profile.beardMustache || 'Não informado'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-700 dark:text-[#A1A1AA]">Tom de pele</dt>
                    <dd className="text-slate-950 dark:text-white">{profile.skinTone || 'Não informado'}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-slate-700 dark:text-[#A1A1AA]">Modelo de IA preferido</dt>
                    <dd className="font-medium text-violet-700 dark:text-[#A855F7]">
                      {getPreferredAiModelOption(profile.preferredModel ?? user?.preferredModel).label}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-slate-700 dark:text-[#A1A1AA]">
                  Você ainda não preencheu os detalhes opcionais do seu Perfil Visual.
                </p>
              )}
            </div>
          )}

          {/* TAB 6: CREDITS */}
          {activeTab === 'creditos' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-6 flex flex-wrap items-center justify-between gap-4 shadow-sm dark:shadow-none">
                <div>
                  <p className="text-xs text-slate-700 dark:text-[#A1A1AA]">Saldo disponível</p>
                  <p className="font-display text-3xl font-bold text-slate-950 dark:text-white font-mono-num">
                    {user?.credits ?? 0} créditos
                  </p>
                </div>
                <Link
                  to="/planos"
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white"
                >
                  Ver planos mensais
                </Link>
              </div>

              <div className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] overflow-x-auto shadow-sm dark:shadow-none">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-[#A1A1AA]">
                    <tr>
                      <th className="py-3.5 px-5">Data</th>
                      <th className="py-3.5 px-5">Movimentação</th>
                      <th className="py-3.5 px-5 text-right">Variação</th>
                      <th className="py-3.5 px-5 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-white/5">
                    {ledger.map((entry) => (
                      <tr key={entry.id}>
                        <td className="py-3 px-5 text-xs text-slate-700 dark:text-[#A1A1AA] font-mono-num whitespace-nowrap">
                          {new Date(entry.createdAt).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-3 px-5 text-slate-950 dark:text-white">{entry.description}</td>
                        <td
                          className={`py-3 px-5 text-right font-mono-num font-semibold ${
                            entry.amount > 0
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : entry.amount < 0
                              ? 'text-amber-700 dark:text-amber-300'
                              : 'text-slate-700 dark:text-[#A1A1AA]'
                          }`}
                        >
                          {entry.amount > 0 ? `+${entry.amount}` : entry.amount}
                        </td>
                        <td className="py-3 px-5 text-right font-mono-num text-slate-950 dark:text-white">
                          {entry.balanceAfter}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 7: SUBSCRIPTION */}
          {activeTab === 'assinatura' && (
            <div className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-6 space-y-6 shadow-sm dark:shadow-none">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-700 dark:text-[#A1A1AA]">Plano atual</p>
                  <h2 className="font-display text-xl font-bold text-slate-950 dark:text-white uppercase">
                    {subscription?.planId === 'free_trial'
                      ? 'Créditos iniciais de boas-vindas'
                      : subscription?.planId}
                  </h2>
                  <p className="mt-1 text-xs text-slate-700 dark:text-[#A1A1AA]">
                    Status: {subscription?.subscriptionStatus === 'active' ? 'Ativa' : 'Sem assinatura recorrente ativa'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link
                    to="/planos"
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white"
                  >
                    Alterar / Assinar plano
                  </Link>
                  {subscription?.subscriptionStatus === 'active' && (
                    <button
                      type="button"
                      onClick={handleCancelSubscription}
                      className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-700 hover:text-slate-950 dark:border-white/15 dark:text-[#A1A1AA] dark:hover:text-white"
                    >
                      Cancelar renovação
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-white/10">
                <h3 className="font-display text-sm font-semibold text-slate-950 dark:text-white mb-3">
                  Histórico de pagamentos
                </h3>
                {!subscription?.payments?.length ? (
                  <p className="text-sm text-slate-700 dark:text-[#A1A1AA]">Nenhum pagamento registrado ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {subscription.payments.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between text-xs py-2 border-b border-slate-200 dark:border-white/5"
                      >
                        <span className="text-slate-950 dark:text-white uppercase">
                          Plano {p.planId} · {p.method}
                        </span>
                        <span className="text-slate-700 dark:text-[#A1A1AA] font-mono-num">
                          R$ {p.amountBrl.toFixed(2).replace('.', ',')} · {p.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Barra de ferramentas flutuante para ações em lote */}
      {(activeTab === 'fotos' || activeTab === 'favoritos') && (
        <FloatingBatchToolbar
          selectedCount={selectedIds.length}
          folders={folders}
          batchTargetFolderId={batchTargetFolderId}
          onChangeTargetFolderId={setBatchTargetFolderId}
          onMoveToFolder={handleBatchMoveToFolder}
          movingBatch={movingBatch}
          onApplyBatchFilter={handleApplyBatchFilter}
          onApplyBatchTag={handleBatchAddTag}
          taggingBatch={taggingBatch}
          onExportPdf={() =>
            handleExportPdfAlbum(
              generations.filter((g) => selectedIds.includes(g.id)),
              selectedIds.length === 1
                ? generations.find((g) => g.id === selectedIds[0])?.scenarioTitle || 'Seleção PromptFace'
                : `Seleção PromptFace (${selectedIds.length} fotos)`
            )
          }
          exportingPdf={exportingPdf}
          onDownloadZip={handleDownloadZip}
          downloadingZip={downloadingZip}
          onDeleteSelected={handleBatchDeleteSelected}
          deletingBatch={deletingBatch}
          onCompareSelected={handleOpenComparison}
          onClearSelection={() => setSelectedIds([])}
        />
      )}

      {/* Modal de Comparação Lado a Lado */}
      {activeComparisonPair && (
        <PhotoComparisonModal
          pair={activeComparisonPair}
          onSwap={() =>
            setComparePairIds((prev) => (prev ? swapComparisonPair(prev) : null))
          }
          onClose={() => setComparePairIds(null)}
          getMediaUrl={getMediaUrl}
          appliedFilters={appliedFilters}
          buildRecreateUrl={buildRecreateUrl}
          onToggleFavorite={handleToggleFavorite}
          onDownload={(item) => handleDownloadImage(item)}
          onOpenLightbox={(item) => {
            setComparePairIds(null);
            setCompareLightboxFilter(false);
            setLightboxItem(item);
          }}
          downloadingId={downloadingId}
        />
      )}

      {/* Lightbox Modal em resolução completa */}
      {lightboxItem && (
        <PhotoLightboxModal
          item={lightboxItem}
          items={filteredPhotos}
          onSelectItem={(nextItem) => {
            setCompareLightboxFilter(false);
            setLightboxItem(nextItem);
          }}
          onClose={() => {
            setCompareLightboxFilter(false);
            setLightboxItem(null);
          }}
          getMediaUrl={getMediaUrl}
          appliedFilterId={appliedFilters[lightboxItem.id] ?? 'original'}
          onSetFilter={setPhotoFilter}
          compareFilter={compareLightboxFilter}
          onToggleCompareFilter={() => setCompareLightboxFilter((prev) => !prev)}
          folders={folders}
          folderById={folderById}
          onAssignFolder={handleAssignPhotoFolder}
          onUpdateTags={handleUpdatePhotoTags}
          exportFormat={exportFormat}
          onChangeExportFormat={setExportFormat}
          buildRecreateUrl={buildRecreateUrl}
          onToggleFavorite={handleToggleFavorite}
          onDownload={handleDownloadImage}
          onShareInstagram={handleShareInstagram}
          downloading={downloadingId === lightboxItem.id}
        />
      )}
    </div>
  );
}
