import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Clock, Download, ImagePlus, Trash2 } from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';
import { ButtonSpinner } from './ButtonSpinner';

export interface ActivityHistoryItem {
  id: string;
  scenarioTitle: string;
  url: string;
  costCredits: number;
  createdAt: string;
}

interface MySpaceActivityHistoryProps {
  generations: ActivityHistoryItem[];
  getMediaUrl: (url: string) => string;
  downloadingId: string | null;
  deletingPhotoId: string | null;
  onDownload: (item: ActivityHistoryItem) => void;
  onDelete: (id: string) => void;
  onOpen?: (item: ActivityHistoryItem) => void;
  defaultExpanded?: boolean;
}

/**
 * Componente visual de Histórico de Atividade no Meu Espaço:
 * lista as últimas 5 gerações realizadas com ações rápidas de baixar e deletar.
 * Recolhido por padrão na galeria para evitar repetição visual na tela.
 */
export function MySpaceActivityHistory({
  generations,
  getMediaUrl,
  downloadingId,
  deletingPhotoId,
  onDownload,
  onDelete,
  onOpen,
  defaultExpanded = false,
}: MySpaceActivityHistoryProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    if (defaultExpanded) {
      setExpanded(true);
    }
  }, [defaultExpanded]);

  const recentFive = generations
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <section
      aria-labelledby="activity-history-heading"
      data-testid="myspace-activity-history"
      className="rounded-2xl border border-slate-300 dark:border-white/10 pf-card-surface px-4 py-3 sm:px-5 sm:py-3.5 space-y-3 shadow-sm dark:shadow-none"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-[#7C3AED]/20 dark:text-[#C4B5FD]">
            <Clock className="w-4 h-4" aria-hidden="true" />
          </span>
          <div>
            <h2
              id="activity-history-heading"
              className="font-display text-xs sm:text-sm font-semibold text-slate-950 dark:text-white"
            >
              Histórico de Atividade{' '}
              <span className="font-mono-num font-normal text-slate-600 dark:text-[#A1A1AA]">
                ({recentFive.length})
              </span>
            </h2>
            <p className="text-[11px] text-slate-600 dark:text-[#A1A1AA]">
              Últimas 5 gerações realizadas — baixar ou deletar rápido
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 hover:border-violet-700 hover:text-slate-950 dark:border-white/15 dark:bg-[#0D0D14] dark:text-[#A1A1AA] dark:hover:border-[#8B5CF6] dark:hover:text-white transition-colors whitespace-nowrap"
        >
          <span>{expanded ? 'Recolher' : 'Ver últimas 5'}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </div>

      {expanded && (
        recentFive.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 dark:border-white/10 dark:bg-[#08080C]/60 px-4 py-7 text-center space-y-3">
          <p className="text-sm text-slate-700 dark:text-[#A1A1AA]">
            Nenhuma geração registrada ainda no seu histórico de atividade.
          </p>
          <Link
            to="/criar"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white hover:brightness-110"
          >
            <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Criar primeira foto</span>
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-white/10">
          {recentFive.map((item) => {
            const isDownloading = downloadingId === item.id;
            const isDeleting = deletingPhotoId === item.id;
            const confirming = confirmDeleteId === item.id;

            return (
              <li
                key={item.id}
                className="py-3 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => onOpen?.(item)}
                    aria-label={`Visualizar ${item.scenarioTitle}`}
                    className="w-12 h-14 rounded-xl overflow-hidden border border-slate-300 dark:border-white/10 bg-slate-100 dark:bg-[#08080C] shrink-0 hover:border-violet-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
                  >
                    <ImageWithFallback
                      src={getMediaUrl(item.url)}
                      alt={item.scenarioTitle}
                      className="w-full h-full object-cover"
                    />
                  </button>

                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onOpen?.(item)}
                      className="text-left text-sm font-semibold text-slate-950 dark:text-white hover:text-violet-700 dark:hover:text-[#A855F7] truncate block max-w-full transition-colors"
                    >
                      {item.scenarioTitle}
                    </button>
                    <p className="text-xs text-slate-600 dark:text-[#A1A1AA] font-mono-num mt-0.5">
                      {new Date(item.createdAt).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      · -{item.costCredits} créditos
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    disabled={isDownloading || isDeleting}
                    onClick={() => onDownload(item)}
                    aria-label={`Baixar ${item.scenarioTitle}`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-violet-700 bg-white text-xs font-semibold text-violet-950 hover:bg-violet-50 disabled:opacity-50 dark:border-[#7C3AED]/70 dark:bg-transparent dark:text-white dark:hover:bg-[#7C3AED]/20 transition-colors"
                  >
                    {isDownloading ? (
                      <ButtonSpinner size="sm" />
                    ) : (
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                    <span>{isDownloading ? 'Baixando...' : 'Baixar'}</span>
                  </button>

                  {confirming ? (
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => {
                          setConfirmDeleteId(null);
                          onDelete(item.id);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-red-600 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                      >
                        {isDeleting ? <ButtonSpinner size="sm" /> : null}
                        <span>{isDeleting ? 'Excluindo...' : 'Confirmar'}</span>
                      </button>
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2.5 py-2 rounded-xl border border-slate-300 text-xs font-medium text-slate-700 hover:text-slate-950 dark:border-white/15 dark:text-[#A1A1AA] dark:hover:text-white"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => setConfirmDeleteId(item.id)}
                      aria-label={`Deletar ${item.scenarioTitle}`}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:border-red-500 hover:text-red-700 disabled:opacity-50 dark:border-white/15 dark:bg-[#0D0D14] dark:text-[#A1A1AA] dark:hover:border-red-500/60 dark:hover:text-red-400 transition-colors"
                    >
                      {isDeleting ? (
                        <ButtonSpinner size="sm" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                      <span>Deletar</span>
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ))}
    </section>
  );
}
