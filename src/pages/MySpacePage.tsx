import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import JSZip from 'jszip';
import {
  Archive,
  Check,
  CheckSquare,
  Download,
  Folder,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Heart,
  Info,
  LogOut,
  Maximize2,
  MoveHorizontal,
  Palette,
  Pencil,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { ImageCompareSlider } from '../components/BeforeAfterSlider';
import type { VisualProfileData } from '../shared/rules';
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

const FILTER_PREFS_STORAGE_KEY = 'pf_gallery_filters';

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

type TabId =
  | 'fotos'
  | 'favoritos'
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
  url: string;
  costCredits: number;
  status: string;
  favorite: boolean;
  folderId?: string;
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
  const [expandedExifIds, setExpandedExifIds] = useState<string[]>([]);
  const [lightboxItem, setLightboxItem] = useState<GenerationItem | null>(null);
  const [compareLightboxFilter, setCompareLightboxFilter] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [exportFormat, setExportFormat] = useState<SocialExportFormatId>('original');
  const [appliedFilters, setAppliedFilters] = useState<Record<string, ArtisticFilterId>>(
    loadSavedFilters
  );

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

  const filteredPhotos = useMemo(() => {
    const now = Date.now();
    const q = searchQuery.trim().toLowerCase();
    const folderMatched = filterGenerationsByFolder(generations, folderFilter, folders);
    return folderMatched.filter((g) => {
      if ((activeTab === 'favoritos' || onlyFavorites) && !g.favorite) return false;
      if (categoryFilter !== 'all' && g.categoryId !== categoryFilter) return false;
      if (dateFilter !== 'all') {
        const ageDays = (now - new Date(g.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        if (dateFilter === '7d' && ageDays > 7) return false;
        if (dateFilter === '30d' && ageDays > 30) return false;
      }
      if (!q) return true;
      return (
        g.scenarioTitle.toLowerCase().includes(q) ||
        g.categoryName.toLowerCase().includes(q) ||
        (g.promptUsed?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [generations, folders, activeTab, onlyFavorites, categoryFilter, folderFilter, dateFilter, searchQuery]);

  const setPhotoFilter = (id: string, filterId: ArtisticFilterId) => {
    setAppliedFilters((prev) => {
      const next: Record<string, ArtisticFilterId> = { ...prev, [id]: filterId };
      if (filterId === 'original') {
        delete next[id];
      }
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
      setFolderFeedback({
        type: 'success',
        text: `${updatedIds.length} foto${updatedIds.length > 1 ? 's' : ''} movida${updatedIds.length > 1 ? 's' : ''} para ${targetName}.`,
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

  const buildRecreateUrl = (item: GenerationItem): string => {
    if (item.mode === 'free' || !item.scenarioId) {
      const promptParam = encodeURIComponent(item.promptUsed || item.scenarioTitle);
      return `/criar?modo=livre&prompt=${promptParam}`;
    }
    return `/criar?cenario=${encodeURIComponent(item.scenarioId)}`;
  };

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
    URL.revokeObjectURL(objectUrl);
  };

  const handleDownloadImage = async (item: GenerationItem) => {
    setDownloadingId(item.id);
    setErrorMsg(null);
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
        exportFormat
      );
      const filename = buildDownloadFilename(
        item.scenarioTitle,
        item.id,
        filterId,
        ext,
        exportFormat
      );
      triggerBlobDownload(blob, filename);
    } catch {
      setErrorMsg('Não foi possível baixar esta fotografia agora. Tente novamente.');
    } finally {
      setDownloadingId(null);
    }
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
    { id: 'historico', label: 'Histórico de gerações' },
    { id: 'referencias', label: 'Minhas referências faciais' },
    { id: 'perfil', label: 'Meu perfil visual' },
    { id: 'creditos', label: 'Meus créditos' },
    { id: 'assinatura', label: 'Minha assinatura' },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[#8B5CF6]">
            Área pessoal · {user?.email}
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-white">
            Meu Espaço
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {user?.role === 'admin' && (
            <Link
              to="/admin"
              className="px-4 py-2.5 rounded-xl border border-[#7C3AED] text-xs font-semibold uppercase tracking-wider text-white hover:bg-[#7C3AED]/15"
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
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/15 text-xs font-medium text-[#A1A1AA] hover:text-white"
          >
            <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
            Sair
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Abas do Meu Espaço" className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
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
                : 'bg-[#17171F] text-[#A1A1AA] border border-white/10 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div className="rounded-2xl border border-red-500/40 bg-red-950/30 p-6 flex items-center justify-between gap-4">
          <p className="text-sm text-red-200">{errorMsg}</p>
          <button
            type="button"
            onClick={() => void loadSpaceData()}
            className="px-4 py-2 rounded-xl border border-white/20 text-xs text-white"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {loading ? (
        <div className="h-64 rounded-2xl skeleton-violet border border-white/10" />
      ) : (
        <>
          {/* TAB 1 & 2: GALLERY & FAVORITES */}
          {(activeTab === 'fotos' || activeTab === 'favoritos') && (
            <div className="space-y-6">
              <div className="flex flex-col lg:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-[#A1A1AA] absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por cenário, categoria ou prompt"
                    aria-label="Buscar fotografias"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#17171F] border border-white/15 text-sm text-white"
                  />
                </div>
                <select
                  aria-label="Filtrar por categoria"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl bg-[#17171F] border border-white/15 text-sm text-white"
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
                  className="px-3.5 py-2.5 rounded-xl bg-[#17171F] border border-white/15 text-sm text-white"
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
                  aria-label="Filtrar por data"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as 'all' | '7d' | '30d')}
                  className="px-3.5 py-2.5 rounded-xl bg-[#17171F] border border-white/15 text-sm text-white"
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
                        ? 'bg-[#EC4899]/15 border-[#EC4899] text-white'
                        : 'bg-[#17171F] border-white/15 text-[#A1A1AA] hover:text-white'
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
                className="rounded-2xl border border-white/10 pf-card-surface p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-[#8B5CF6]" aria-hidden="true" />
                    <h2 className="font-display text-sm font-semibold text-white">
                      Pastas por tema ou evento
                    </h2>
                    <span className="text-xs text-[#A1A1AA]">
                      ({folders.length} {folders.length === 1 ? 'pasta' : 'pastas'})
                    </span>
                  </div>

                  {!showNewFolderForm && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewFolderForm(true);
                        setFolderFeedback(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#7C3AED]/70 bg-[#7C3AED]/15 text-xs font-medium text-white hover:bg-[#7C3AED]/30 transition-colors"
                    >
                      <FolderPlus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Nova pasta</span>
                    </button>
                  )}
                </div>

                {showNewFolderForm && (
                  <div className="rounded-xl border border-[#8B5CF6]/40 bg-[#08080C] p-3 space-y-2.5">
                    <form onSubmit={handleCreateFolder} className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={newFolderInput}
                        onChange={(e) => setNewFolderInput(e.target.value)}
                        placeholder="Ex.: Viagens, Formatura, LinkedIn"
                        aria-label="Nome da nova pasta"
                        maxLength={32}
                        className="flex-1 min-w-[180px] px-3 py-2 rounded-xl bg-[#17171F] border border-white/15 text-xs text-white focus:outline-none focus:border-[#8B5CF6]"
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
                        className="px-3 py-2 rounded-xl border border-white/15 text-xs text-[#A1A1AA] hover:text-white"
                      >
                        Cancelar
                      </button>
                    </form>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] text-[#A1A1AA]">Sugestões rápidas:</span>
                      {SUGGESTED_FOLDER_NAMES.filter(
                        (s) => !folders.some((f) => f.name.toLowerCase() === s.toLowerCase())
                      ).map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => void handleCreateFolderByName(suggestion)}
                          className="px-2.5 py-1 rounded-lg border border-white/10 bg-[#17171F] text-[11px] text-[#A1A1AA] hover:text-white hover:border-[#8B5CF6] transition-colors"
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
                        : 'bg-[#08080C] border-white/10 text-[#A1A1AA] hover:text-white'
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
                        : 'bg-[#08080C] border-white/10 text-[#A1A1AA] hover:text-white'
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
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl border border-[#8B5CF6] bg-[#08080C]"
                        >
                          <input
                            type="text"
                            value={editingFolderName}
                            onChange={(e) => setEditingFolderName(e.target.value)}
                            aria-label={`Novo nome para ${folder.name}`}
                            maxLength={32}
                            className="w-32 px-2 py-1 rounded-lg bg-[#17171F] border border-white/15 text-xs text-white focus:outline-none"
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
                            className="p-1.5 rounded-lg text-[#A1A1AA] hover:text-white"
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
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-red-500/50 bg-red-950/30 text-xs text-white"
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
                            className="px-2 py-0.5 rounded-md border border-white/15 text-[#A1A1AA] hover:text-white"
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
                            : 'bg-[#08080C] border-white/10 text-[#A1A1AA] hover:border-white/25'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setFolderFilter(isActive ? 'all' : folder.id)}
                          className={`inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 text-xs font-medium ${
                            isActive ? 'text-white' : 'text-white/90 hover:text-white'
                          }`}
                        >
                          {isActive ? (
                            <FolderOpen className="w-3.5 h-3.5" aria-hidden="true" />
                          ) : (
                            <Folder className="w-3.5 h-3.5 text-[#8B5CF6]" aria-hidden="true" />
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
                              : 'text-[#A1A1AA] hover:text-white'
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
                              : 'text-[#A1A1AA] hover:text-red-400'
                          }`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}

                  {folders.length === 0 && !showNewFolderForm && (
                    <div className="flex flex-wrap items-center gap-1.5 pl-1">
                      <span className="text-xs text-[#A1A1AA]">Comece rápido:</span>
                      {SUGGESTED_FOLDER_NAMES.slice(0, 3).map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => void handleCreateFolderByName(suggestion)}
                          className="px-2.5 py-1 rounded-xl border border-dashed border-white/20 text-xs text-[#A1A1AA] hover:text-white hover:border-[#8B5CF6] transition-colors"
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
                        ? 'border border-red-500/40 bg-red-950/30 text-red-200'
                        : 'border border-emerald-500/35 bg-emerald-950/25 text-emerald-200'
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

              {filteredPhotos.length > 0 && (
                <div className="rounded-2xl border border-white/10 pf-card-surface px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/15 text-xs font-medium text-white hover:border-[#8B5CF6] transition-colors"
                    >
                      {allFilteredSelected ? (
                        <CheckSquare className="w-4 h-4 text-[#8B5CF6]" aria-hidden="true" />
                      ) : (
                        <Square className="w-4 h-4 text-[#A1A1AA]" aria-hidden="true" />
                      )}
                      <span>{allFilteredSelected ? 'Limpar seleção' : 'Selecionar todas'}</span>
                    </button>
                    <span className="text-xs text-[#A1A1AA]">
                      {selectedIds.length > 0
                        ? `${selectedIds.length} selecionada${selectedIds.length > 1 ? 's' : ''}`
                        : 'Selecione fotos para mover para uma pasta ou baixar em ZIP'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {selectedIds.length > 0 && (
                      <div className="inline-flex flex-wrap items-center gap-1.5">
                        <select
                          aria-label="Pasta de destino para seleção"
                          value={batchTargetFolderId}
                          onChange={(e) => setBatchTargetFolderId(e.target.value)}
                          className="px-3 py-2 rounded-xl bg-[#08080C] border border-white/15 text-xs text-white"
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
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#7C3AED] bg-[#7C3AED]/15 text-xs font-medium text-white hover:bg-[#7C3AED]/30 disabled:opacity-50 transition-colors"
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
                      className="px-3 py-2 rounded-xl bg-[#08080C] border border-white/15 text-xs text-white"
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
                        className="px-3 py-1.5 rounded-xl border border-white/10 text-xs text-[#A1A1AA] hover:text-white transition-colors"
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
                          : 'border border-white/15 bg-[#08080C] text-[#A1A1AA]'
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
                <div className="rounded-2xl border border-white/10 pf-card-surface p-12 text-center space-y-4">
                  <p className="font-display text-lg font-semibold text-white">
                    Nenhum resultado encontrado
                  </p>
                  <p className="text-sm text-[#A1A1AA]">
                    {generations.length === 0
                      ? 'Você ainda não gerou nenhuma fotografia.'
                      : 'Nenhuma foto corresponde aos filtros aplicados.'}
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    {(searchQuery || categoryFilter !== 'all' || folderFilter !== 'all' || dateFilter !== 'all' || onlyFavorites) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setCategoryFilter('all');
                          setFolderFilter('all');
                          setDateFilter('all');
                          setOnlyFavorites(false);
                        }}
                        className="px-4 py-2.5 rounded-xl border border-[#7C3AED] text-xs font-semibold uppercase tracking-wider text-white"
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
                    const exif = formatPhotoExifMetadata({
                      scenarioTitle: item.scenarioTitle,
                      categoryName: item.categoryName,
                      promptUsed: item.promptUsed,
                      createdAt: item.createdAt,
                      appliedFilterId: activeFilterId,
                      aspectRatio: item.aspectRatio,
                      mimeType: item.mimeType,
                      mode: item.mode,
                      synthIdMarked: item.synthIdMarked,
                      costCredits: item.costCredits,
                    });
                    return (
                      <article
                        key={item.id}
                        className={`rounded-2xl border pf-card-surface overflow-hidden flex flex-col transition-colors ${
                          isSelected
                            ? 'border-[#8B5CF6] ring-1 ring-[#8B5CF6]/50'
                            : 'border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="relative aspect-[3/4] overflow-hidden bg-[#08080C]">
                          <ImageWithFallback
                            src={getMediaUrl(item.url)}
                            alt={item.scenarioTitle}
                            className={`w-full h-full object-cover object-center transition-all duration-200 ${activeFilter.cssClass}`}
                          />
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
                              <p className="text-xs text-[#A1A1AA]">
                                {item.categoryName} · {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                              </p>
                              <h2 className="font-display text-sm font-semibold text-white truncate">
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
                                  ? 'bg-[#7C3AED]/20 border-[#8B5CF6] text-white'
                                  : 'bg-[#08080C] border-white/10 text-[#A1A1AA] hover:text-white'
                              }`}
                            >
                              <Info className="w-3 h-3" aria-hidden="true" />
                              <span>EXIF</span>
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="flex items-center gap-1.5">
                              <Palette className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0" aria-hidden="true" />
                              <select
                                aria-label={`Filtro artístico: ${item.scenarioTitle}`}
                                value={activeFilterId}
                                onChange={(e) =>
                                  setPhotoFilter(item.id, e.target.value as ArtisticFilterId)
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg bg-[#08080C] border border-white/15 text-xs text-white"
                              >
                                {ARTISTIC_FILTERS.map((f) => (
                                  <option key={f.id} value={f.id}>
                                    Filtro: {f.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Folder className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0" aria-hidden="true" />
                              <select
                                aria-label={`Pasta: ${item.scenarioTitle}`}
                                value={item.folderId && folderById.has(item.folderId) ? item.folderId : ''}
                                onChange={(e) =>
                                  void handleAssignPhotoFolder(item.id, e.target.value || null)
                                }
                                className="w-full px-2.5 py-1.5 rounded-lg bg-[#08080C] border border-white/15 text-xs text-white"
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

                          {isExifOpen && (
                            <dl
                              data-testid={`exif-panel-${item.id}`}
                              className="rounded-xl border border-white/10 bg-[#08080C] p-3 space-y-2 text-xs"
                            >
                              <div>
                                <dt className="text-[11px] uppercase tracking-wider text-[#A1A1AA]">
                                  Prompt utilizado
                                </dt>
                                <dd className="mt-0.5 text-white/95 leading-relaxed break-words">
                                  {exif.prompt}
                                </dd>
                              </div>
                              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/10">
                                <div>
                                  <dt className="text-[11px] text-[#A1A1AA]">Criação</dt>
                                  <dd className="font-mono-num text-white">{exif.createdAtFormatted}</dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] text-[#A1A1AA]">Filtro aplicado</dt>
                                  <dd className="text-[#A855F7] font-medium">{exif.appliedFilterLabel}</dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] text-[#A1A1AA]">Proporção · Formato</dt>
                                  <dd className="font-mono-num text-white">
                                    {exif.aspectRatio} · {exif.formatLabel}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-[11px] text-[#A1A1AA]">Modo · Origem</dt>
                                  <dd className="text-white">
                                    {exif.modeLabel} · {exif.signatureLabel}
                                  </dd>
                                </div>
                              </div>
                            </dl>
                          )}

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <div className="flex items-center gap-3">
                              <Link
                                to={`/studio?foto=${item.id}`}
                                className="inline-flex items-center gap-1.5 text-xs text-[#8B5CF6] hover:underline"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                                Studio
                              </Link>
                              <Link
                                to={buildRecreateUrl(item)}
                                aria-label={`Recriar ${item.scenarioTitle}`}
                                className="inline-flex items-center gap-1 text-xs text-[#A1A1AA] hover:text-white"
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
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#7C3AED]/70 text-xs font-medium text-white hover:bg-[#7C3AED]/20 disabled:opacity-50 transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>{downloadingId === item.id ? 'Baixando...' : 'Download'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteGeneration(item.id)}
                                aria-label={`Excluir ${item.scenarioTitle}`}
                                className="p-2 rounded-lg border border-white/10 text-[#A1A1AA] hover:text-red-400"
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

          {/* TAB 3: GENERATION HISTORY */}
          {activeTab === 'historico' && (
            <div className="rounded-2xl border border-white/10 bg-[#17171F] overflow-x-auto">
              {generations.length === 0 ? (
                <div className="p-10 text-center text-sm text-[#A1A1AA]">
                  Nenhuma geração registrada até o momento.
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-white/10 text-xs text-[#A1A1AA]">
                    <tr>
                      <th className="py-3.5 px-5">Data</th>
                      <th className="py-3.5 px-5">Cenário</th>
                      <th className="py-3.5 px-5 text-right">Custo</th>
                      <th className="py-3.5 px-5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {generations.map((g) => (
                      <tr key={g.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-5 text-xs text-[#A1A1AA] font-mono-num whitespace-nowrap">
                          {new Date(g.createdAt).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-3 px-5 text-white">{g.scenarioTitle}</td>
                        <td className="py-3 px-5 text-right font-mono-num text-white">
                          {g.costCredits} créditos
                        </td>
                        <td className="py-3 px-5 text-xs text-emerald-400">Concluída</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* TAB 4: FACE REFERENCES */}
          {activeTab === 'referencias' && (
            <div className="rounded-2xl border border-white/10 bg-[#17171F] p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg font-semibold text-white">
                    Minhas referências faciais ({faces.length})
                  </h2>
                  <p className="text-xs text-[#A1A1AA]">
                    Todas as fotos enviadas são privadas e protegidas por LGPD.
                  </p>
                </div>
                <Link
                  to="/perfil-visual"
                  className="px-4 py-2.5 rounded-xl border border-[#7C3AED] text-xs font-semibold uppercase tracking-wider text-white"
                >
                  Gerenciar fotos
                </Link>
              </div>
              {faces.length === 0 ? (
                <p className="text-sm text-[#A1A1AA]">Nenhuma foto de referência enviada.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {faces.map((f) => (
                    <div
                      key={f.id}
                      className="aspect-[3/4] rounded-xl overflow-hidden border border-white/10 bg-[#08080C]"
                    >
                      <ImageWithFallback
                        src={getMediaUrl(f.url)}
                        alt="Referência facial"
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
            <div className="rounded-2xl border border-white/10 bg-[#17171F] p-6 space-y-5">
              <div className="flex items-center justify-between gap-4">
                <h2 className="font-display text-lg font-semibold text-white">
                  Resumo do Perfil Visual
                </h2>
                <Link
                  to="/perfil-visual"
                  className="px-4 py-2.5 rounded-xl border border-[#7C3AED] text-xs font-semibold uppercase tracking-wider text-white"
                >
                  Editar Perfil Visual
                </Link>
              </div>
              {profile ? (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-xs text-[#A1A1AA]">Olhos</dt>
                    <dd className="text-white">{profile.eyeColor || 'Não informado'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#A1A1AA]">Cabelo</dt>
                    <dd className="text-white">{profile.hairColorStyle || 'Não informado'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#A1A1AA]">Barba / bigode</dt>
                    <dd className="text-white">{profile.beardMustache || 'Não informado'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[#A1A1AA]">Tom de pele</dt>
                    <dd className="text-white">{profile.skinTone || 'Não informado'}</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-[#A1A1AA]">
                  Você ainda não preencheu os detalhes opcionais do seu Perfil Visual.
                </p>
              )}
            </div>
          )}

          {/* TAB 6: CREDITS */}
          {activeTab === 'creditos' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-white/10 bg-[#17171F] p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-[#A1A1AA]">Saldo disponível</p>
                  <p className="font-display text-3xl font-bold text-white font-mono-num">
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

              <div className="rounded-2xl border border-white/10 bg-[#17171F] overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-white/10 text-xs text-[#A1A1AA]">
                    <tr>
                      <th className="py-3.5 px-5">Data</th>
                      <th className="py-3.5 px-5">Movimentação</th>
                      <th className="py-3.5 px-5 text-right">Variação</th>
                      <th className="py-3.5 px-5 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {ledger.map((entry) => (
                      <tr key={entry.id}>
                        <td className="py-3 px-5 text-xs text-[#A1A1AA] font-mono-num whitespace-nowrap">
                          {new Date(entry.createdAt).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-3 px-5 text-white">{entry.description}</td>
                        <td
                          className={`py-3 px-5 text-right font-mono-num ${
                            entry.amount > 0
                              ? 'text-emerald-400'
                              : entry.amount < 0
                              ? 'text-amber-300'
                              : 'text-[#A1A1AA]'
                          }`}
                        >
                          {entry.amount > 0 ? `+${entry.amount}` : entry.amount}
                        </td>
                        <td className="py-3 px-5 text-right font-mono-num text-white">
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
            <div className="rounded-2xl border border-white/10 bg-[#17171F] p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-[#A1A1AA]">Plano atual</p>
                  <h2 className="font-display text-xl font-bold text-white uppercase">
                    {subscription?.planId === 'free_trial'
                      ? 'Créditos iniciais de boas-vindas'
                      : subscription?.planId}
                  </h2>
                  <p className="mt-1 text-xs text-[#A1A1AA]">
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
                      className="px-4 py-2.5 rounded-xl border border-white/15 text-xs text-[#A1A1AA] hover:text-white"
                    >
                      Cancelar renovação
                    </button>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <h3 className="font-display text-sm font-semibold text-white mb-3">
                  Histórico de pagamentos
                </h3>
                {!subscription?.payments?.length ? (
                  <p className="text-sm text-[#A1A1AA]">Nenhum pagamento registrado ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {subscription.payments.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between text-xs py-2 border-b border-white/5"
                      >
                        <span className="text-white uppercase">
                          Plano {p.planId} · {p.method}
                        </span>
                        <span className="text-[#A1A1AA] font-mono-num">
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

      {/* Lightbox Modal */}
      {lightboxItem && (() => {
        const lightboxFilterId = appliedFilters[lightboxItem.id] ?? 'original';
        const lightboxFilterObj = getArtisticFilter(lightboxFilterId);
        const canCompareLightbox = lightboxFilterId !== 'original';
        const lightboxExif = formatPhotoExifMetadata({
          scenarioTitle: lightboxItem.scenarioTitle,
          categoryName: lightboxItem.categoryName,
          promptUsed: lightboxItem.promptUsed,
          createdAt: lightboxItem.createdAt,
          appliedFilterId: lightboxFilterId,
          aspectRatio: lightboxItem.aspectRatio,
          mimeType: lightboxItem.mimeType,
          mode: lightboxItem.mode,
          synthIdMarked: lightboxItem.synthIdMarked,
          costCredits: lightboxItem.costCredits,
        });
        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={lightboxItem.scenarioTitle}
            className="fixed inset-0 z-50 bg-[#08080C]/95 backdrop-blur-md flex items-center justify-center p-4"
          >
            <div className="relative max-w-3xl w-full max-h-[92vh] overflow-y-auto rounded-2xl border border-white/15 bg-[#17171F]">
              <button
                type="button"
                onClick={() => {
                  setCompareLightboxFilter(false);
                  setLightboxItem(null);
                }}
                aria-label="Fechar visualização"
                className="absolute top-3 right-3 z-20 p-2 rounded-lg bg-[#08080C]/85 text-white hover:bg-[#7C3AED]"
              >
                <X className="w-5 h-5" />
              </button>
              {compareLightboxFilter && canCompareLightbox ? (
                <div className="max-w-md mx-auto bg-[#08080C]">
                  <ImageCompareSlider
                    title={lightboxItem.scenarioTitle}
                    beforeImage={getMediaUrl(lightboxItem.url)}
                    afterImage={getMediaUrl(lightboxItem.url)}
                    beforeLabel="Original"
                    afterLabel={lightboxFilterObj.label}
                    beforeClassName="pf-filter-original"
                    afterClassName={lightboxFilterObj.cssClass}
                    objectPositionClass="object-contain"
                  />
                </div>
              ) : (
                <ImageWithFallback
                  src={getMediaUrl(lightboxItem.url)}
                  alt={lightboxItem.scenarioTitle}
                  className={`w-full max-h-[55vh] object-contain bg-[#08080C] transition-all duration-200 ${lightboxFilterObj.cssClass}`}
                />
              )}
              <div className="px-4 pt-3 pb-3 border-t border-white/10 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-[#A1A1AA]">
                    <Palette className="w-3.5 h-3.5 text-[#8B5CF6]" aria-hidden="true" />
                    <span>Filtros artísticos</span>
                  </div>
                  {canCompareLightbox && (
                    <button
                      type="button"
                      aria-pressed={compareLightboxFilter}
                      onClick={() => setCompareLightboxFilter((prev) => !prev)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-medium transition-colors ${
                        compareLightboxFilter
                          ? 'bg-[#7C3AED] border-[#A855F7] text-white'
                          : 'bg-[#08080C] border-white/15 text-[#A1A1AA] hover:text-white'
                      }`}
                    >
                      <MoveHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{compareLightboxFilter ? 'Sair da comparação' : 'Comparar Original × Filtro'}</span>
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {ARTISTIC_FILTERS.map((f) => {
                    const isActive = lightboxFilterId === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => setPhotoFilter(lightboxItem.id, f.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          isActive
                            ? 'bg-[#7C3AED] border-[#A855F7] text-white'
                            : 'bg-[#08080C] text-[#A1A1AA] border-white/10 hover:text-white'
                        }`}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="px-4 pb-3">
                <div className="rounded-xl border border-white/10 bg-[#08080C] p-3.5 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-white">
                    <Info className="w-3.5 h-3.5 text-[#8B5CF6]" aria-hidden="true" />
                    <span>Metadados da imagem (EXIF)</span>
                  </div>
                  <dl className="space-y-2 text-xs">
                    <div>
                      <dt className="text-[11px] uppercase tracking-wider text-[#A1A1AA]">
                        Prompt utilizado
                      </dt>
                      <dd className="mt-0.5 text-white/95 leading-relaxed break-words">
                        {lightboxExif.prompt}
                      </dd>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-white/10">
                      <div>
                        <dt className="text-[11px] text-[#A1A1AA]">Data de criação</dt>
                        <dd className="font-mono-num text-white">{lightboxExif.createdAtFormatted}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-[#A1A1AA]">Filtro aplicado</dt>
                        <dd className="text-[#A855F7] font-medium">{lightboxExif.appliedFilterLabel}</dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-[#A1A1AA]">Proporção · Formato</dt>
                        <dd className="font-mono-num text-white">
                          {lightboxExif.aspectRatio} · {lightboxExif.formatLabel}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-[#A1A1AA]">Modo · Origem</dt>
                        <dd className="text-white">
                          {lightboxExif.modeLabel} · {lightboxExif.signatureLabel}
                        </dd>
                      </div>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="p-4 pt-1 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-[#A1A1AA]">Foto gerada por IA · {lightboxItem.categoryName}</p>
                  <p className="text-sm font-medium text-white">{lightboxItem.scenarioTitle}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    aria-label="Pasta da foto"
                    value={
                      lightboxItem.folderId && folderById.has(lightboxItem.folderId)
                        ? lightboxItem.folderId
                        : ''
                    }
                    onChange={(e) =>
                      void handleAssignPhotoFolder(lightboxItem.id, e.target.value || null)
                    }
                    className="px-3 py-2 rounded-xl bg-[#08080C] border border-white/15 text-xs text-white"
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
                    onChange={(e) => setExportFormat(e.target.value as SocialExportFormatId)}
                    className="px-3 py-2 rounded-xl bg-[#08080C] border border-white/15 text-xs text-white"
                  >
                    {SOCIAL_EXPORT_FORMATS.map((fmt) => (
                      <option key={fmt.id} value={fmt.id}>
                        {fmt.label}
                      </option>
                    ))}
                  </select>
                  <Link
                    to={buildRecreateUrl(lightboxItem)}
                    onClick={() => setLightboxItem(null)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/15 bg-[#08080C] text-xs font-medium text-[#A1A1AA] hover:text-white"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Recriar</span>
                  </Link>
                  <button
                    type="button"
                    aria-pressed={lightboxItem.favorite}
                    onClick={() => void handleToggleFavorite(lightboxItem.id)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-medium transition-colors ${
                      lightboxItem.favorite
                        ? 'bg-[#EC4899]/15 border-[#EC4899] text-white'
                        : 'border-white/15 bg-[#08080C] text-[#A1A1AA] hover:text-white'
                    }`}
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        lightboxItem.favorite ? 'fill-[#EC4899] text-[#EC4899]' : ''
                      }`}
                      aria-hidden="true"
                    />
                    <span>{lightboxItem.favorite ? 'Favorita' : 'Favoritar'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDownloadImage(lightboxItem)}
                    disabled={downloadingId === lightboxItem.id}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white hover:brightness-110 disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" aria-hidden="true" />
                    <span>{downloadingId === lightboxItem.id ? 'Baixando...' : 'Download'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
