import { useEffect, useState } from 'react';
import {
  Archive,
  Columns2,
  FileText,
  FolderInput,
  Palette,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { ARTISTIC_FILTERS, type ArtisticFilterId } from '../shared/artisticFilters';
import type { FolderItem } from '../shared/photoFolders';
import { PRESET_PHOTO_TAGS } from '../shared/photoTags';

interface FloatingBatchToolbarProps {
  selectedCount: number;
  folders: FolderItem[];
  batchTargetFolderId: string;
  onChangeTargetFolderId: (folderId: string) => void;
  onMoveToFolder: () => Promise<void>;
  movingBatch: boolean;
  onApplyBatchFilter: (filterId: ArtisticFilterId) => void;
  onApplyBatchTag?: (tagName: string) => Promise<void>;
  taggingBatch?: boolean;
  onExportPdf: () => Promise<void>;
  exportingPdf: boolean;
  onDownloadZip: () => Promise<void>;
  downloadingZip: boolean;
  onDeleteSelected: () => Promise<void>;
  deletingBatch: boolean;
  onCompareSelected?: () => void;
  onClearSelection: () => void;
}

export function FloatingBatchToolbar({
  selectedCount,
  folders,
  batchTargetFolderId,
  onChangeTargetFolderId,
  onMoveToFolder,
  movingBatch,
  onApplyBatchFilter,
  onApplyBatchTag,
  taggingBatch = false,
  onExportPdf,
  exportingPdf,
  onDownloadZip,
  downloadingZip,
  onDeleteSelected,
  deletingBatch,
  onCompareSelected,
  onClearSelection,
}: FloatingBatchToolbarProps) {
  const [batchFilterId, setBatchFilterId] = useState<ArtisticFilterId>('cinematic');
  const [batchTag, setBatchTag] = useState<string>(PRESET_PHOTO_TAGS[0]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    setConfirmingDelete(false);
  }, [selectedCount]);

  if (selectedCount <= 0) return null;

  return (
    <div
      role="region"
      aria-label="Barra de ações em lote"
      data-testid="floating-batch-toolbar"
      className="fixed bottom-4 inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 z-40 max-w-6xl w-auto sm:w-[calc(100%-2rem)] rounded-2xl border border-violet-600/50 bg-white/95 dark:border-[#8B5CF6]/55 dark:bg-[#17171F]/95 backdrop-blur-xl shadow-2xl shadow-slate-900/20 dark:shadow-black/70 px-4 py-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="font-display text-xs sm:text-sm font-semibold text-slate-950 dark:text-white font-mono-num whitespace-nowrap">
            {selectedCount} {selectedCount === 1 ? 'foto selecionada' : 'fotos selecionadas'}
          </span>
          <button
            type="button"
            onClick={onClearSelection}
            aria-label="Limpar seleção atual"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 bg-slate-100 text-xs text-slate-800 hover:text-slate-950 hover:border-slate-500 dark:border-white/15 dark:bg-[#08080C] dark:text-[#A1A1AA] dark:hover:text-white transition-colors whitespace-nowrap"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Limpar</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedCount === 2 && onCompareSelected && (
            <button
              type="button"
              onClick={onCompareSelected}
              aria-label="Comparar as 2 fotos selecionadas lado a lado"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-violet-700 bg-violet-100 text-xs font-semibold text-violet-950 hover:bg-violet-200 dark:border-[#A855F7] dark:bg-[#7C3AED]/25 dark:text-white dark:hover:bg-[#7C3AED]/40 transition-colors whitespace-nowrap"
            >
              <Columns2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Comparar lado a lado</span>
            </button>
          )}
          {/* Aplicar mesmo filtro artístico em lote */}
          <div className="inline-flex items-center gap-1.5">
            <select
              aria-label="Filtro para aplicar em lote"
              value={batchFilterId}
              onChange={(e) => setBatchFilterId(e.target.value as ArtisticFilterId)}
              className="px-2.5 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
            >
              {ARTISTIC_FILTERS.map((f) => (
                <option key={f.id} value={f.id}>
                  Filtro: {f.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onApplyBatchFilter(batchFilterId)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-violet-700/60 bg-violet-100 text-xs font-medium text-violet-950 hover:bg-violet-200 dark:border-[#8B5CF6]/60 dark:bg-[#7C3AED]/20 dark:text-white dark:hover:bg-[#7C3AED]/35 transition-colors whitespace-nowrap"
            >
              <Palette className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Aplicar filtro</span>
            </button>
          </div>

          {/* Aplicar tag em lote */}
          {onApplyBatchTag && (
            <div className="inline-flex items-center gap-1.5">
              <select
                aria-label="Tag para aplicar em lote"
                value={batchTag}
                onChange={(e) => setBatchTag(e.target.value)}
                className="px-2.5 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
              >
                {PRESET_PHOTO_TAGS.map((tagName) => (
                  <option key={tagName} value={tagName}>
                    Tag: {tagName}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={taggingBatch}
                onClick={() => void onApplyBatchTag(batchTag)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-slate-100 text-xs font-medium text-slate-950 hover:border-violet-700 dark:border-white/15 dark:bg-[#08080C] dark:text-white dark:hover:border-[#8B5CF6] disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                <Tag className="w-3.5 h-3.5 text-violet-700 dark:text-[#A855F7]" aria-hidden="true" />
                <span>{taggingBatch ? 'Marcando...' : 'Marcar tag'}</span>
              </button>
            </div>
          )}

          {/* Mover todas para a mesma pasta/álbum */}
          <div className="inline-flex items-center gap-1.5">
            <select
              aria-label="Álbum ou pasta de destino em lote"
              value={batchTargetFolderId}
              onChange={(e) => onChangeTargetFolderId(e.target.value)}
              className="px-2.5 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
            >
              <option value="">Sem pasta</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  Álbum: {folder.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void onMoveToFolder()}
              disabled={movingBatch}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-slate-100 text-xs font-medium text-slate-950 hover:border-violet-700 dark:border-white/15 dark:bg-[#08080C] dark:text-white dark:hover:border-[#8B5CF6] disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              <FolderInput className="w-3.5 h-3.5 text-violet-700 dark:text-[#8B5CF6]" aria-hidden="true" />
              <span>{movingBatch ? 'Movendo...' : 'Mover para álbum'}</span>
            </button>
          </div>

          {/* Exportar seleção em PDF ou ZIP */}
          <button
            type="button"
            onClick={() => void onExportPdf()}
            disabled={exportingPdf}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-slate-100 text-xs font-medium text-slate-950 hover:border-violet-700 dark:border-white/15 dark:bg-[#08080C] dark:text-white dark:hover:border-[#8B5CF6] disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5 text-violet-700 dark:text-[#A855F7]" aria-hidden="true" />
            <span>{exportingPdf ? 'Gerando PDF...' : 'Álbum PDF'}</span>
          </button>

          <button
            type="button"
            onClick={() => void onDownloadZip()}
            disabled={downloadingZip}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white hover:brightness-110 disabled:opacity-50 transition-all whitespace-nowrap"
          >
            <Archive className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{downloadingZip ? 'Gerando ZIP...' : 'Baixar ZIP'}</span>
          </button>

          {/* Excluir seleção em lote */}
          {confirmingDelete ? (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-red-600/50 bg-red-50 dark:border-red-500/50 dark:bg-red-950/40">
              <button
                type="button"
                disabled={deletingBatch}
                onClick={() => void onDeleteSelected()}
                className="px-2.5 py-1 rounded-lg bg-red-600 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50 whitespace-nowrap"
              >
                {deletingBatch ? 'Excluindo...' : `Confirmar (${selectedCount})`}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="px-2 py-1 text-xs text-slate-700 hover:text-slate-950 dark:text-[#A1A1AA] dark:hover:text-white whitespace-nowrap"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              aria-label={`Excluir ${selectedCount} fotos selecionadas`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-600/45 bg-red-50 text-xs font-medium text-red-800 hover:bg-red-100 dark:border-red-500/35 dark:bg-red-950/20 dark:text-red-200 dark:hover:bg-red-900/35 transition-colors whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Excluir</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
