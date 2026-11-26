import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, History, MoveHorizontal, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { CREDIT_COSTS } from '../shared/rules';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { ImageCompareSlider } from '../components/BeforeAfterSlider';

interface StudioVersion {
  id: string;
  instruction: string;
  url: string;
  createdAt: string;
}

interface GenerationItem {
  id: string;
  scenarioTitle: string;
  url: string;
  versions: StudioVersion[];
  createdAt: string;
}

const QUICK_EDITS = [
  'Trocar minha roupa por uma jaqueta de couro',
  'Mudar o cenário para Paris',
  'Alterar a iluminação para fotografia noturna',
  'Mudar minha pose',
  'Adicionar um carro ao fundo',
  'Transformar em retrato profissional',
];

const STUDIO_LOADING_MESSAGES = [
  'Preservando sua identidade facial...',
  'Aplicando alteração solicitada...',
  'Ajustando iluminação e texturas naturais...',
  'Finalizando edição em alta definição...',
];

export function StudioPage() {
  const { user, apiFetch, updateCredits, getMediaUrl } = useAuth();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const requestedId = searchParams.get('foto');

  const [generations, setGenerations] = useState<GenerationItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [activeVersionUrl, setActiveVersionUrl] = useState<string | null>(null);
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [imageReady, setImageReady] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [betaNotice, setBetaNotice] = useState(false);

  useEffect(() => {
    apiFetch('/api/generations')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const list = (data?.generations || []) as GenerationItem[];
        setGenerations(list);
        if (list.length > 0) {
          const initial =
            (requestedId && list.find((g) => g.id === requestedId)) || list[0];
          setSelectedId(initial.id);
          const latest =
            initial.versions.length > 0
              ? initial.versions[initial.versions.length - 1].url
              : initial.url;
          setActiveVersionUrl(latest);
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedId]);

  useEffect(() => {
    if (!editing) return;
    setLoadingMsgIdx(0);
    const timer = setInterval(() => {
      setLoadingMsgIdx((prev) => (prev + 1) % STUDIO_LOADING_MESSAGES.length);
    }, 1800);
    return () => clearInterval(timer);
  }, [editing]);

  const selectedGen = useMemo(
    () => generations.find((g) => g.id === selectedId) || null,
    [generations, selectedId]
  );

  const currentDisplayUrl = activeVersionUrl || selectedGen?.url || '';
  const canCompare = Boolean(selectedGen && currentDisplayUrl !== selectedGen.url);

  useEffect(() => {
    setImageReady(false);
    if (!canCompare) {
      setCompareMode(false);
    }
  }, [currentDisplayUrl, canCompare]);

  const handleApplyEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGen || !instruction.trim()) return;
    setErrorMsg(null);
    setBetaNotice(false);
    setEditing(true);

    try {
      const res = await apiFetch('/api/studio/edit', {
        method: 'POST',
        body: JSON.stringify({
          generationId: selectedGen.id,
          instruction,
        }),
      });
      const data = (await res.json()) as {
        generation?: GenerationItem;
        version?: StudioVersion;
        credits?: number;
        notConfigured?: boolean;
        error?: string;
      };
      if (typeof data.credits === 'number') updateCredits(data.credits);

      if (!res.ok) {
        if (data.notConfigured) {
          setBetaNotice(true);
        } else {
          const errText = data.error || 'Não foi possível aplicar a edição.';
          setErrorMsg(errText);
          addToast({
            variant: 'error',
            title: 'Falha ao editar no Studio',
            description: errText,
          });
        }
        return;
      }

      if (data.generation && data.version) {
        setGenerations((prev) =>
          prev.map((g) => (g.id === data.generation!.id ? data.generation! : g))
        );
        setActiveVersionUrl(data.version.url);
        setInstruction('');
        addToast({
          variant: 'success',
          title: 'Edição no Studio concluída!',
          description: `Nova versão criada para ${data.generation.scenarioTitle}.`,
        });
      }
    } finally {
      setEditing(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14 space-y-8">
        <div className="space-y-2">
          <div className="h-3.5 w-48 rounded-md skeleton-violet" />
          <div className="h-9 w-72 rounded-xl skeleton-violet" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 aspect-[3/4] rounded-2xl skeleton-violet border border-slate-300 dark:border-white/10" />
          <div className="lg:col-span-5 space-y-6">
            <div className="h-80 rounded-2xl skeleton-violet border border-slate-300 dark:border-white/10" />
            <div className="h-44 rounded-2xl skeleton-violet border border-slate-300 dark:border-white/10" />
          </div>
        </div>
      </div>
    );
  }

  if (generations.length === 0) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-16">
        <div className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-10 text-center space-y-4 shadow-sm dark:shadow-none">
          <SlidersHorizontal className="w-8 h-8 text-violet-700 dark:text-[#8B5CF6] mx-auto" aria-hidden="true" />
          <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">PromptFace Studio</h1>
          <p className="text-sm text-slate-700 dark:text-[#A1A1AA] max-w-md mx-auto">
            Você ainda não possui fotos geradas para editar no Studio. Gere sua primeira fotografia realista e depois volte aqui para ajustar roupa, iluminação, pose ou cenário por texto.
          </p>
          <Link
            to="/criar"
            className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white"
          >
            Criar minha primeira foto
          </Link>
        </div>
      </div>
    );
  }

  const displayUrl = currentDisplayUrl;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-[#8B5CF6]">
            Edição por texto com preservação de identidade
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-slate-950 dark:text-white">
            PromptFace Studio
          </h1>
        </div>
        <p className="text-sm text-slate-700 dark:text-[#A1A1AA] font-mono-num">
          Saldo: <strong className="text-slate-950 dark:text-white">{user?.credits ?? 0} créditos</strong> · Edição:{' '}
          <strong className="text-slate-950 dark:text-white">{CREDIT_COSTS.studio_edit} créditos</strong>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Canvas & Versions */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] overflow-hidden relative shadow-sm dark:shadow-none">
            {editing ? (
              <div
                role="status"
                aria-live="polite"
                aria-label="Gerando edição da imagem no Studio"
                className="aspect-[3/4] skeleton-violet border border-violet-500/45 flex flex-col items-center justify-center p-8 text-center space-y-5"
              >
                <div className="w-14 h-14 rounded-2xl bg-white/90 dark:bg-[#08080C]/70 border border-violet-500/50 flex items-center justify-center shadow-lg shadow-[#7C3AED]/20">
                  <Sparkles className="w-6 h-6 text-violet-700 dark:text-[#8B5CF6] animate-pulse" aria-hidden="true" />
                </div>
                <div className="space-y-2 max-w-sm">
                  <p className="font-display text-lg font-semibold text-slate-950 dark:text-white">
                    {STUDIO_LOADING_MESSAGES[loadingMsgIdx]}
                  </p>
                  <p className="text-xs text-slate-700 dark:text-[#A1A1AA]">
                    Mantendo sua identidade facial e todos os elementos não alterados da cena.
                  </p>
                </div>
                <div className="w-full max-w-xs space-y-2.5 pt-2" aria-hidden="true">
                  <div className="h-2.5 w-full rounded-full skeleton-violet border border-slate-300 dark:border-white/10" />
                  <div className="h-2.5 w-4/5 mx-auto rounded-full skeleton-violet border border-slate-300 dark:border-white/10" />
                </div>
              </div>
            ) : compareMode && selectedGen && canCompare ? (
              <ImageCompareSlider
                title={selectedGen.scenarioTitle}
                beforeImage={getMediaUrl(selectedGen.url)}
                afterImage={getMediaUrl(displayUrl)}
                beforeLabel="Original"
                afterLabel="Versão editada"
                objectPositionClass="object-cover object-center"
              />
            ) : (
              <div className="relative min-h-[320px]">
                <ImageWithFallback
                  src={getMediaUrl(displayUrl)}
                  alt={selectedGen?.scenarioTitle || 'Edição no Studio'}
                  onLoad={() => setImageReady(true)}
                  onError={() => setImageReady(true)}
                  className="w-full h-auto object-cover"
                />
                {!imageReady && (
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 skeleton-violet"
                  />
                )}
                {imageReady && (
                  <span className="absolute bottom-3 left-3 text-xs text-white bg-[#08080C]/85 px-2.5 py-1 rounded-md border border-white/15">
                    Foto gerada por IA
                  </span>
                )}
              </div>
            )}
          </div>

          {selectedGen && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              {editing ? (
                <div
                  aria-hidden="true"
                  className="h-10 w-56 rounded-xl skeleton-violet border border-slate-300 dark:border-white/10"
                />
              ) : (
                <>
                  <a
                    href={getMediaUrl(displayUrl)}
                    download={`promptface-studio-${selectedGen.id}.png`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-violet-700 text-xs font-semibold uppercase tracking-wider text-violet-950 bg-white hover:bg-violet-50 dark:border-[#7C3AED] dark:bg-transparent dark:text-white dark:hover:bg-[#7C3AED]/15"
                  >
                    <Download className="w-4 h-4" aria-hidden="true" />
                    Baixar versão selecionada
                  </a>

                  {canCompare && (
                    <button
                      type="button"
                      aria-pressed={compareMode}
                      onClick={() => setCompareMode((prev) => !prev)}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold uppercase tracking-wider transition-colors ${
                        compareMode
                          ? 'bg-[#7C3AED] border-[#A855F7] text-white'
                          : 'border-slate-300 bg-white text-slate-800 hover:text-slate-950 dark:border-white/15 dark:bg-[#17171F] dark:text-[#A1A1AA] dark:hover:text-white'
                      }`}
                    >
                      <MoveHorizontal className="w-4 h-4" aria-hidden="true" />
                      <span>{compareMode ? 'Ver só edição' : 'Comparar Original × Edição'}</span>
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: Controls & History */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-6 space-y-5 shadow-sm dark:shadow-none">
            <div className="space-y-1.5">
              <label htmlFor="studio-photo-select" className="block text-xs font-medium text-slate-700 dark:text-[#A1A1AA]">
                Fotografia ativa
              </label>
              <select
                id="studio-photo-select"
                value={selectedId}
                onChange={(e) => {
                  const next = generations.find((g) => g.id === e.target.value);
                  setSelectedId(e.target.value);
                  if (next) {
                    const latest =
                      next.versions.length > 0
                        ? next.versions[next.versions.length - 1].url
                        : next.url;
                    setActiveVersionUrl(latest);
                  }
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
              >
                {generations.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.scenarioTitle}
                  </option>
                ))}
              </select>
            </div>

            <form onSubmit={handleApplyEdit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="studio-instruction" className="block text-xs font-medium text-slate-700 dark:text-[#A1A1AA]">
                  O que você quer alterar nesta foto?
                </label>
                <textarea
                  id="studio-instruction"
                  rows={3}
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  placeholder="Ex.: Trocar minha roupa por uma jaqueta de couro preta"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 placeholder:text-slate-500 focus:outline-none focus:border-violet-700 dark:bg-[#08080C] dark:border-white/15 dark:text-white dark:placeholder:text-[#A1A1AA]/55 dark:focus:border-[#8B5CF6]"
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs text-slate-700 dark:text-[#A1A1AA]">Sugestões rápidas:</p>
                <div className="flex flex-wrap gap-2">
                  {QUICK_EDITS.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setInstruction(example)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-800 hover:text-slate-950 hover:border-violet-700 dark:bg-[#08080C] dark:border-white/10 dark:text-[#A1A1AA] dark:hover:text-white dark:hover:border-[#7C3AED] transition-colors text-left"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>

              {errorMsg && (
                <div className="rounded-xl bg-red-50 border border-red-600/45 text-red-950 dark:bg-red-950/40 dark:border-red-500/40 px-4 py-3 text-xs dark:text-red-200">
                  {errorMsg}
                </div>
              )}

              {betaNotice && (
                <div className="rounded-xl border border-violet-500/50 bg-violet-50 text-slate-900 dark:border-[#7C3AED]/50 dark:bg-[#08080C] px-4 py-3 text-xs dark:text-[#A1A1AA]">
                  Edição no Studio em breve — estamos ativando os servidores de imagem. Nenhum crédito foi descontado.
                </div>
              )}

              <button
                type="submit"
                disabled={editing || !instruction.trim() || (user?.credits ?? 0) < CREDIT_COSTS.studio_edit}
                className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white hover:brightness-110 disabled:opacity-45"
              >
                {editing
                  ? 'Editando...'
                  : `Aplicar edição (${CREDIT_COSTS.studio_edit} créditos)`}
              </button>
            </form>
          </div>

          {/* Version history */}
          {selectedGen && (
            <div className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-6 space-y-4 shadow-sm dark:shadow-none">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-violet-700 dark:text-[#8B5CF6]" aria-hidden="true" />
                <h2 className="font-display text-sm font-semibold text-slate-950 dark:text-white">
                  Histórico de versões ({1 + selectedGen.versions.length})
                </h2>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setActiveVersionUrl(selectedGen.url)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-xs transition-colors ${
                    displayUrl === selectedGen.url
                      ? 'border-violet-700 bg-violet-100 text-slate-950 dark:border-[#7C3AED] dark:bg-[#7C3AED]/15 dark:text-white'
                      : 'border-slate-300 bg-slate-50 text-slate-700 hover:text-slate-950 dark:border-white/10 dark:bg-[#08080C] dark:text-[#A1A1AA] dark:hover:text-white'
                  }`}
                >
                  <span className="font-semibold text-slate-950 dark:text-white block">Versão original</span>
                  <span className="text-[11px]">{selectedGen.scenarioTitle}</span>
                </button>

                {selectedGen.versions.map((ver, idx) => (
                  <button
                    key={ver.id}
                    type="button"
                    onClick={() => setActiveVersionUrl(ver.url)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-xs transition-colors ${
                      displayUrl === ver.url
                        ? 'border-violet-700 bg-violet-100 text-slate-950 dark:border-[#7C3AED] dark:bg-[#7C3AED]/15 dark:text-white'
                        : 'border-slate-300 bg-slate-50 text-slate-700 hover:text-slate-950 dark:border-white/10 dark:bg-[#08080C] dark:text-[#A1A1AA] dark:hover:text-white'
                    }`}
                  >
                    <span className="font-semibold text-slate-950 dark:text-white block">Edição v{idx + 1}</span>
                    <span className="text-[11px] line-clamp-1">{ver.instruction}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
