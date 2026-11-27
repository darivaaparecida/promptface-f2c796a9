import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Brush,
  Crown,
  Download,
  History,
  Images,
  Layers,
  Lock,
  Maximize2,
  MoveHorizontal,
  PenLine,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { listGenerations } from '../lib/db';
import { useToast } from '../context/ToastContext';
import { CREDIT_COSTS } from '../shared/rules';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { ImageCompareSlider } from '../components/BeforeAfterSlider';
import { ButtonSpinner } from '../components/ButtonSpinner';
import { ExpandableTextField } from '../components/ExpandableTextField';
import { StudioMaskOverlay } from '../components/StudioMaskOverlay';
import {
  DEFAULT_STUDIO_ADJUSTMENTS,
  StudioAdjustmentsPanel,
  buildCssFilterString,
  hasActiveAdjustments,
  type StudioLocalAdjustments,
} from '../components/StudioAdjustmentsPanel';

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

type StudioTab = 'edit' | 'variations' | 'format' | 'adjust';
type PresetCategory = 'all' | 'Roupa' | 'Cenário' | 'Luz' | 'Pose';
type VariationStrength = 'subtle' | 'balanced' | 'creative';
type OutpaintRatio = '3:4' | '1:1' | '9:16' | '16:9';

const QUICK_EDIT_GROUPS: { category: Exclude<PresetCategory, 'all'>; items: string[] }[] = [
  {
    category: 'Roupa',
    items: [
      'Trocar minha roupa por uma jaqueta de couro',
      'Vestir terno executivo sob medida',
    ],
  },
  {
    category: 'Cenário',
    items: [
      'Mudar o cenário para Paris',
      'Fundo neutro de estúdio para LinkedIn',
      'Adicionar um carro ao fundo',
    ],
  },
  {
    category: 'Luz',
    items: [
      'Alterar a iluminação para fotografia noturna',
      'Iluminação quente de Golden Hour',
    ],
  },
  {
    category: 'Pose',
    items: ['Mudar minha pose', 'Transformar em retrato profissional'],
  },
];

const VARIATION_LEVELS: {
  id: VariationStrength;
  label: string;
  desc: string;
}[] = [
  {
    id: 'subtle',
    label: 'Sutil',
    desc: 'Pequenos ajustes na expressão e iluminação mantendo quase tudo igual.',
  },
  {
    id: 'balanced',
    label: 'Equilibrada',
    desc: 'Novo ângulo leve e detalhes renovados preservando identidade e roupa.',
  },
  {
    id: 'creative',
    label: 'Criativa',
    desc: 'Explora nova composição e clima visual mantendo seu rosto idêntico.',
  },
];

const OUTPAINT_OPTIONS: {
  ratio: OutpaintRatio;
  label: string;
  hint: string;
  frameClass: string;
}[] = [
  { ratio: '3:4', label: 'Retrato', hint: 'Feed / Portfólio', frameClass: 'w-4 h-5' },
  { ratio: '1:1', label: 'Quadrado', hint: 'Foto de perfil', frameClass: 'w-4 h-4' },
  { ratio: '9:16', label: 'Stories', hint: 'Reels / TikTok', frameClass: 'w-3 h-5' },
  { ratio: '16:9', label: 'Capa', hint: 'Banner / YouTube', frameClass: 'w-6 h-3.5' },
];

const STUDIO_LOADING_MESSAGES = [
  'Preservando sua identidade facial...',
  'Aplicando alteração solicitada...',
  'Ajustando iluminação e texturas naturais...',
  'Finalizando edição em alta definição...',
];

function triggerBlobDownload(href: string, filename: string) {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function StudioPage() {
  const { user, config, updateCredits, refreshConfig, getMediaUrl } = useAuth();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const requestedId = searchParams.get('foto');

  const [generations, setGenerations] = useState<GenerationItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [activeVersionUrl, setActiveVersionUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StudioTab>('edit');
  const [presetCategory, setPresetCategory] = useState<PresetCategory>('all');
  const [instruction, setInstruction] = useState('');
  const [variationStrength, setVariationStrength] = useState<VariationStrength>('balanced');
  const [outpaintRatio, setOutpaintRatio] = useState<OutpaintRatio>('9:16');
  const [maskActive, setMaskActive] = useState(false);
  const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null);
  const [maskStrokeCount, setMaskStrokeCount] = useState(0);
  const [adjustments, setAdjustments] = useState<StudioLocalAdjustments>(
    DEFAULT_STUDIO_ADJUSTMENTS
  );
  const [exportingAdjusted, setExportingAdjusted] = useState(false);

  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [loadedUrl, setLoadedUrl] = useState<string>('');
  const previewRef = useRef<HTMLDivElement>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [photosSheetOpen, setPhotosSheetOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [betaNotice, setBetaNotice] = useState<string | null>(null);

  void updateCredits;
  void refreshConfig;

  const isPremium = user?.planId === 'premium';

  useEffect(() => {
    listGenerations()
      .then((list) => {
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
      .catch(() => {})
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
  const resolvedDisplayUrl = currentDisplayUrl ? getMediaUrl(currentDisplayUrl) : '';
  const canCompare = Boolean(selectedGen && currentDisplayUrl !== selectedGen.url);
  const imageReady = Boolean(resolvedDisplayUrl && loadedUrl === resolvedDisplayUrl);
  const cssFilterString = useMemo(() => buildCssFilterString(adjustments), [adjustments]);
  const adjustmentsDirty = hasActiveAdjustments(adjustments);

  useEffect(() => {
    if (!canCompare) {
      setCompareMode(false);
    }
  }, [canCompare]);

  useEffect(() => {
    if (!resolvedDisplayUrl) return;
    const img = previewRef.current?.querySelector('img');
    if (img && img.complete && img.naturalWidth > 0) {
      setLoadedUrl(resolvedDisplayUrl);
    }
  }, [resolvedDisplayUrl, compareMode, editing]);

  const handleSelectGeneration = (id: string) => {
    const next = generations.find((g) => g.id === id);
    setSelectedId(id);
    setMaskActive(false);
    setMaskDataUrl(null);
    setMaskStrokeCount(0);
    setBetaNotice(null);
    if (next) {
      const latest =
        next.versions.length > 0
          ? next.versions[next.versions.length - 1].url
          : next.url;
      setActiveVersionUrl(latest);
    }
  };

  const handleSelectGenerationAndClose = (id: string) => {
    handleSelectGeneration(id);
    setPhotosSheetOpen(false);
  };

  const handleSelectVersionAndClose = (url: string) => {
    setActiveVersionUrl(url);
    setMaskActive(false);
    setMaskDataUrl(null);
    setMaskStrokeCount(0);
    setPhotosSheetOpen(false);
  };

  useEffect(() => {
    if (!photosSheetOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPhotosSheetOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [photosSheetOpen]);

  const handleApplyEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGen || !instruction.trim()) return;
    // TODO(studio): enviar `instruction` e `maskDataUrl` (quando marcado por usuários PREMIUM)
    // para a Edge Function de edição no Studio com reserva/estorno atômico de créditos.
    void maskDataUrl;
    setErrorMsg(null);
    setBetaNotice(
      maskStrokeCount > 0
        ? 'Edição localizada com máscara no Studio em breve — estamos ativando os servidores de imagem. Nenhum crédito foi descontado.'
        : 'Edição no Studio em breve — estamos ativando os servidores de imagem. Nenhum crédito foi descontado.'
    );
  };

  const handleRequestVariation = () => {
    if (!selectedGen || !isPremium) return;
    // TODO(studio): ligar ao Supabase Edge Function de variações (CREDIT_COSTS.variation,
    // validando user.plan === 'premium' no servidor e enviando `variationStrength`).
    setErrorMsg(null);
    setBetaNotice(
      `Geração de variação (${
        VARIATION_LEVELS.find((l) => l.id === variationStrength)?.label ?? 'Equilibrada'
      }) em breve — nenhum crédito foi descontado.`
    );
  };

  const handleRequestOutpaint = () => {
    if (!selectedGen || !isPremium) return;
    // TODO(studio): ligar ao Supabase Edge Function de expansão de enquadramento (outpainting)
    // validando `user.plan === 'premium'` no servidor e enviando `outpaintRatio`.
    setErrorMsg(null);
    setBetaNotice(
      `Expansão para ${outpaintRatio} em breve — estamos ativando os servidores de imagem. Nenhum crédito foi descontado.`
    );
  };

  const handleRequestUpscale2k = () => {
    if (!selectedGen || !isPremium) return;
    // TODO(studio): ligar ao Supabase Edge Function de Super Nitidez / Upscale 2K
    // validando `user.plan === 'premium'` no servidor.
    setErrorMsg(null);
    setBetaNotice(
      'Super Nitidez 2K em breve — estamos ativando os servidores de imagem. Nenhum crédito foi descontado.'
    );
  };

  const handleDownloadSelected = async () => {
    if (!selectedGen || !resolvedDisplayUrl) return;
    const filename = `promptface-studio-${selectedGen.id}${
      adjustmentsDirty ? '-ajustada' : ''
    }.png`;

    if (!adjustmentsDirty) {
      triggerBlobDownload(resolvedDisplayUrl, filename);
      return;
    }

    setExportingAdjusted(true);
    try {
      const response = await fetch(resolvedDisplayUrl);
      if (!response.ok) throw new Error('Falha ao baixar imagem.');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = () => reject(new Error('Falha ao carregar imagem para exportação.'));
          el.src = objectUrl;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas indisponível.');
        ctx.filter = cssFilterString;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const outBlob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error('Falha ao gerar arquivo.'))),
            'image/png'
          );
        });
        const downloadUrl = URL.createObjectURL(outBlob);
        triggerBlobDownload(downloadUrl, filename);
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 1500);
        addToast({
          variant: 'success',
          title: 'Foto ajustada baixada',
          description: 'Seus ajustes de luz e cor foram aplicados ao arquivo.',
        });
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    } catch {
      triggerBlobDownload(resolvedDisplayUrl, filename);
      addToast({
        variant: 'info',
        title: 'Download direto iniciado',
        description: 'Baixamos a versão original porque o navegador bloqueou a reexportação.',
      });
    } finally {
      setExportingAdjusted(false);
    }
  };

  const visiblePresetGroups = useMemo(
    () =>
      presetCategory === 'all'
        ? QUICK_EDIT_GROUPS
        : QUICK_EDIT_GROUPS.filter((g) => g.category === presetCategory),
    [presetCategory]
  );

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
          <SlidersHorizontal
            className="w-8 h-8 text-violet-700 dark:text-[#8B5CF6] mx-auto"
            aria-hidden="true"
          />
          <h1 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
            PromptFace Studio
          </h1>
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
  const falQuota = config.falQuota;
  const falBlocked = Boolean(falQuota?.active && falQuota.exhausted);

  const photoList = (
    <div
      role="listbox"
      aria-label="Fotografia ativa"
      className="space-y-2 max-h-52 overflow-y-auto pr-0.5"
    >
      {generations.map((g) => {
        const thumbUrl =
          g.versions.length > 0 ? g.versions[g.versions.length - 1].url : g.url;
        const active = g.id === selectedId;
        return (
          <button
            key={g.id}
            type="button"
            role="option"
            aria-selected={active}
            onClick={() => handleSelectGenerationAndClose(g.id)}
            className={`w-full flex items-center gap-3 rounded-xl border px-2.5 py-2 text-left transition-colors ${
              active
                ? 'border-violet-700 bg-violet-100 dark:border-[#7C3AED] dark:bg-[#7C3AED]/15'
                : 'border-slate-300 bg-slate-50 hover:border-slate-400 dark:border-white/10 dark:bg-[#08080C] dark:hover:border-white/25'
            }`}
          >
            <ImageWithFallback
              src={getMediaUrl(thumbUrl)}
              alt={g.scenarioTitle}
              className="w-10 h-12 rounded-lg object-cover shrink-0 border border-slate-200 dark:border-white/10"
            />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-slate-950 dark:text-white">
                {g.scenarioTitle}
              </span>
              <span className="block text-[11px] text-slate-600 dark:text-[#A1A1AA]">
                {g.versions.length > 0
                  ? `${g.versions.length} ${g.versions.length === 1 ? 'edição' : 'edições'}`
                  : 'Versão original'}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );

  const versionList = selectedGen ? (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => handleSelectVersionAndClose(selectedGen.url)}
        className={`w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-xl border text-xs transition-colors ${
          displayUrl === selectedGen.url
            ? 'border-violet-700 bg-violet-100 text-slate-950 dark:border-[#7C3AED] dark:bg-[#7C3AED]/15 dark:text-white'
            : 'border-slate-300 bg-slate-50 text-slate-700 hover:text-slate-950 dark:border-white/10 dark:bg-[#08080C] dark:text-[#A1A1AA] dark:hover:text-white'
        }`}
      >
        <span className="flex items-center gap-3 min-w-0">
          <ImageWithFallback
            src={getMediaUrl(selectedGen.url)}
            alt="Versão original"
            className="w-10 h-12 rounded-lg object-cover shrink-0 border border-slate-200 dark:border-white/10"
          />
          <span className="min-w-0 text-left">
            <span className="font-semibold text-slate-950 dark:text-white block">
              Versão original
            </span>
            <span className="text-[11px] block truncate">{selectedGen.scenarioTitle}</span>
          </span>
        </span>
        {displayUrl === selectedGen.url && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-700 dark:text-[#C4B5FD] shrink-0">
            Ativa
          </span>
        )}
      </button>

      {selectedGen.versions.map((ver, idx) => {
        const active = displayUrl === ver.url;
        return (
          <button
            key={ver.id}
            type="button"
            onClick={() => handleSelectVersionAndClose(ver.url)}
            className={`w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-xl border text-xs transition-colors ${
              active
                ? 'border-violet-700 bg-violet-100 text-slate-950 dark:border-[#7C3AED] dark:bg-[#7C3AED]/15 dark:text-white'
                : 'border-slate-300 bg-slate-50 text-slate-700 hover:text-slate-950 dark:border-white/10 dark:bg-[#08080C] dark:text-[#A1A1AA] dark:hover:text-white'
            }`}
          >
            <span className="flex items-center gap-3 min-w-0">
              <ImageWithFallback
                src={getMediaUrl(ver.url)}
                alt={`Edição v${idx + 1}`}
                className="w-10 h-12 rounded-lg object-cover shrink-0 border border-slate-200 dark:border-white/10"
              />
              <span className="min-w-0 text-left">
                <span className="font-semibold text-slate-950 dark:text-white block">
                  Edição v{idx + 1}
                </span>
                <span className="text-[11px] line-clamp-1 block">{ver.instruction}</span>
              </span>
            </span>
            {active && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-violet-700 dark:text-[#C4B5FD] shrink-0">
                Ativa
              </span>
            )}
          </button>
        );
      })}
    </div>
  ) : null;

  const studioTabs: {
    id: StudioTab;
    label: string;
    icon: typeof PenLine;
    premium?: boolean;
  }[] = [
    { id: 'edit', label: 'Editar', icon: PenLine },
    { id: 'variations', label: 'Variações', icon: Layers, premium: true },
    { id: 'format', label: 'Formato & HD', icon: Maximize2, premium: true },
    { id: 'adjust', label: 'Ajustes', icon: SlidersHorizontal },
  ];

  const renderPremiumGate = (title: string, description: string) => (
    <div className="rounded-xl border border-violet-500/45 bg-violet-50/70 dark:border-[#8B5CF6]/45 dark:bg-[#12121B] p-4 space-y-3">
      <div className="flex items-start gap-2.5">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white">
          <Crown className="w-4 h-4" aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-950 dark:text-white flex items-center gap-1.5">
            <span>{title}</span>
            <span className="px-1.5 py-0.5 rounded-md bg-violet-200/80 text-violet-900 dark:bg-[#7C3AED]/30 dark:text-[#DDD6FE] text-[10px] font-bold uppercase tracking-wider">
              PREMIUM
            </span>
          </p>
          <p className="text-xs text-slate-700 dark:text-[#A1A1AA] leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      <Link
        to="/planos"
        className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white hover:brightness-110 transition-all"
      >
        <Lock className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Liberar no plano PREMIUM</span>
      </Link>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14 pb-24 lg:pb-14 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-[#8B5CF6]">
              Edição inteligente com preservação de identidade
            </p>
            {isPremium && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-100 text-violet-900 border border-violet-300 dark:bg-[#7C3AED]/20 dark:text-[#DDD6FE] dark:border-[#8B5CF6]/40 text-[10px] font-bold uppercase tracking-wider">
                <Crown className="w-3 h-3" aria-hidden="true" />
                <span>Studio PREMIUM</span>
              </span>
            )}
          </div>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-slate-950 dark:text-white">
            PromptFace Studio
          </h1>
        </div>
        <div className="text-sm text-slate-700 dark:text-[#A1A1AA] font-mono-num text-left sm:text-right">
          <p>
            Saldo:{' '}
            <strong className="text-slate-950 dark:text-white">
              {user?.credits ?? 0} créditos
            </strong>{' '}
            · Edição:{' '}
            <strong className="text-slate-950 dark:text-white">
              {CREDIT_COSTS.studio_edit} créditos
            </strong>
          </p>
          {falQuota?.active && (
            <p className="mt-1 text-xs" data-testid="studio-fal-quota">
              Proteção gratuita fal.ai:{' '}
              <strong
                className={
                  falQuota.exhausted
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-emerald-700 dark:text-emerald-300'
                }
              >
                {falQuota.remaining} de {falQuota.limit} restantes
              </strong>
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Canvas & Actions */}
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
                  <Sparkles
                    className="w-6 h-6 text-violet-700 dark:text-[#8B5CF6] animate-pulse"
                    aria-hidden="true"
                  />
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
              <div ref={previewRef} className="relative min-h-[320px]">
                <ImageWithFallback
                  src={resolvedDisplayUrl}
                  alt={selectedGen?.scenarioTitle || 'Edição no Studio'}
                  onLoad={() => setLoadedUrl(resolvedDisplayUrl)}
                  onError={() => setLoadedUrl(resolvedDisplayUrl)}
                  style={
                    cssFilterString !== 'none' ? { filter: cssFilterString } : undefined
                  }
                  className={`w-full h-auto object-cover transition-opacity duration-300 ${
                    imageReady || !resolvedDisplayUrl ? 'opacity-100' : 'opacity-0'
                  }`}
                />
                {!imageReady && resolvedDisplayUrl && (
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 skeleton-violet pointer-events-none"
                  />
                )}

                <StudioMaskOverlay
                  active={maskActive && imageReady && isPremium}
                  onClose={() => setMaskActive(false)}
                  onMaskChange={(dataUrl, count) => {
                    setMaskDataUrl(dataUrl);
                    setMaskStrokeCount(count);
                  }}
                />

                {imageReady && (
                  <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
                    <span className="text-xs text-white bg-[#08080C]/85 px-2.5 py-1 rounded-md border border-white/15">
                      Foto gerada por IA
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {maskStrokeCount > 0 && !maskActive && (
                        <span className="text-[11px] font-medium text-white bg-[#7C3AED]/90 px-2.5 py-1 rounded-md border border-white/20">
                          Área selecionada
                        </span>
                      )}
                      {adjustmentsDirty && (
                        <span className="text-[11px] font-medium text-white bg-[#08080C]/85 px-2.5 py-1 rounded-md border border-white/15">
                          Ajustes locais ativos
                        </span>
                      )}
                    </div>
                  </div>
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
                  <button
                    type="button"
                    disabled={exportingAdjusted}
                    onClick={handleDownloadSelected}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-violet-700 text-xs font-semibold uppercase tracking-wider text-violet-950 bg-white hover:bg-violet-50 disabled:opacity-60 dark:border-[#7C3AED] dark:bg-transparent dark:text-white dark:hover:bg-[#7C3AED]/15 transition-colors"
                  >
                    {exportingAdjusted ? (
                      <ButtonSpinner size="sm" />
                    ) : (
                      <Download className="w-4 h-4" aria-hidden="true" />
                    )}
                    <span>
                      {adjustmentsDirty
                        ? 'Baixar com ajustes'
                        : 'Baixar versão selecionada'}
                    </span>
                  </button>

                  {canCompare && (
                    <button
                      type="button"
                      aria-pressed={compareMode}
                      onClick={() => {
                        setMaskActive(false);
                        setCompareMode((prev) => !prev);
                      }}
                      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold uppercase tracking-wider transition-colors ${
                        compareMode
                          ? 'bg-[#7C3AED] border-[#A855F7] text-white'
                          : 'border-slate-300 bg-white text-slate-800 hover:text-slate-950 dark:border-white/15 dark:bg-[#17171F] dark:text-[#A1A1AA] dark:hover:text-white'
                      }`}
                    >
                      <MoveHorizontal className="w-4 h-4" aria-hidden="true" />
                      <span>
                        {compareMode ? 'Ver só edição' : 'Comparar Original × Edição'}
                      </span>
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: Studio Controls & History */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-5 sm:p-6 space-y-5 shadow-sm dark:shadow-none">
            {/* No mobile vive no bottom sheet; no desktop fica inline. */}
            <div className="hidden lg:block">
              <div className="space-y-1.5">
                <span className="block text-xs font-medium text-slate-700 dark:text-[#A1A1AA]">
                  Fotografia ativa
                </span>
                {photoList}
              </div>
            </div>

            {/* Studio Tool Mode Tabs */}
            <div
              role="tablist"
              aria-label="Ferramentas do Studio"
              className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-xl border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-[#0D0D14]"
            >
              {studioTabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setBetaNotice(null);
                      if (tab.id !== 'edit') {
                        setMaskActive(false);
                      }
                    }}
                    className={`flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg text-[11px] font-semibold transition-colors ${
                      active
                        ? 'bg-white text-violet-900 shadow-sm dark:bg-[#1E1E2B] dark:text-white'
                        : 'text-slate-600 hover:text-slate-950 dark:text-[#A1A1AA] dark:hover:text-white'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      {tab.premium && (
                        <Crown
                          className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                    </span>
                    <span className="truncate max-w-full">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {activeTab === 'edit' && (
              <form onSubmit={handleApplyEdit} className="space-y-4">
                <ExpandableTextField
                  id="studio-instruction"
                  label="O que você quer alterar nesta foto?"
                  value={instruction}
                  onChange={setInstruction}
                  placeholder="Ex.: Trocar minha roupa por uma jaqueta de couro preta"
                  defaultRows={3}
                  expandedRows={6}
                />

                {/* Edição localizada com pincel — PREMIUM */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/90 dark:border-white/10 dark:bg-[#0D0D14] p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-white">
                      <Brush
                        className="w-3.5 h-3.5 text-violet-700 dark:text-[#A855F7]"
                        aria-hidden="true"
                      />
                      <span>Selecionar área com pincel</span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-900 dark:bg-[#7C3AED]/25 dark:text-[#DDD6FE] text-[10px] font-bold uppercase tracking-wider">
                      PREMIUM
                    </span>
                  </div>

                  {isPremium ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] text-slate-600 dark:text-[#A1A1AA]">
                        {maskStrokeCount > 0
                          ? `Área marcada (${maskStrokeCount} ${
                              maskStrokeCount === 1 ? 'traço' : 'traços'
                            }) pronta para editar.`
                          : 'Pinte apenas a roupa, objeto ou fundo para proteger o resto.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setCompareMode(false);
                          setMaskActive((prev) => !prev);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          maskActive
                            ? 'bg-[#7C3AED] text-white'
                            : 'border border-violet-600 text-violet-900 bg-white hover:bg-violet-50 dark:border-[#8B5CF6] dark:bg-transparent dark:text-white dark:hover:bg-[#7C3AED]/20'
                        }`}
                      >
                        {maskActive ? 'Concluir marcação' : 'Abrir pincel na foto'}
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-600 dark:text-[#A1A1AA]">
                      Marque exatamente onde alterar na foto com pincel.{' '}
                      <Link
                        to="/planos"
                        className="font-semibold text-violet-700 dark:text-[#A855F7] underline underline-offset-2"
                      >
                        Disponível no PREMIUM
                      </Link>
                      .
                    </p>
                  )}
                </div>

                {/* Quick Presets with category filter */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-medium text-slate-700 dark:text-[#A1A1AA]">
                      Sugestões rápidas
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {(['all', 'Roupa', 'Cenário', 'Luz', 'Pose'] as PresetCategory[]).map(
                        (cat) => {
                          const active = presetCategory === cat;
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setPresetCategory(cat)}
                              className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                                active
                                  ? 'bg-violet-100 text-violet-900 font-semibold dark:bg-[#7C3AED]/30 dark:text-white'
                                  : 'text-slate-600 hover:text-slate-950 dark:text-[#A1A1AA] dark:hover:text-white'
                              }`}
                            >
                              {cat === 'all' ? 'Todos' : cat}
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>

                  {visiblePresetGroups.map((group) => (
                    <div key={group.category} className="space-y-1.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-700 dark:text-[#A855F7]">
                        {group.category}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {group.items.map((example) => (
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
                  ))}
                </div>

                {falBlocked && (
                  <div
                    role="alert"
                    className="rounded-xl bg-amber-50 border border-amber-600/45 text-amber-950 dark:bg-amber-950/35 dark:border-amber-500/40 px-4 py-3 text-xs dark:text-amber-200"
                  >
                    Limite de proteção atingido: as {falQuota?.limit ?? 12} imagens gratuitas da fal.ai já foram usadas para evitar qualquer cobrança.
                  </div>
                )}

                {errorMsg && (
                  <div className="rounded-xl bg-red-50 border border-red-600/45 text-red-950 dark:bg-red-950/40 dark:border-red-500/40 px-4 py-3 text-xs dark:text-red-200">
                    {errorMsg}
                  </div>
                )}

                {betaNotice && (
                  <div className="rounded-xl border border-violet-500/50 bg-violet-50 text-slate-900 dark:border-[#7C3AED]/50 dark:bg-[#08080C] px-4 py-3 text-xs dark:text-[#A1A1AA]">
                    {betaNotice}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={
                    editing ||
                    falBlocked ||
                    !instruction.trim() ||
                    (user?.credits ?? 0) < CREDIT_COSTS.studio_edit
                  }
                  className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white hover:brightness-110 disabled:opacity-45"
                >
                  {editing && <ButtonSpinner size="sm" />}
                  <span>
                    {editing
                      ? 'Editando...'
                      : falBlocked
                      ? `Limite gratuito (${falQuota?.limit ?? 12}) atingido`
                      : `Aplicar edição (${CREDIT_COSTS.studio_edit} créditos)`}
                  </span>
                </button>
              </form>
            )}

            {activeTab === 'variations' && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-sm font-semibold text-slate-950 dark:text-white">
                      Gerar variações da foto ativa
                    </h2>
                    <span className="px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-900 dark:bg-[#7C3AED]/25 dark:text-[#DDD6FE] text-[10px] font-bold uppercase tracking-wider">
                      PREMIUM
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-[#A1A1AA]">
                    Crie novas variações preservando seu rosto, estilo e qualidade sem reescrever o cenário do zero.
                  </p>
                </div>

                <div
                  role="radiogroup"
                  aria-label="Intensidade da variação"
                  className="space-y-2"
                >
                  {VARIATION_LEVELS.map((level) => {
                    const selected = variationStrength === level.id;
                    return (
                      <button
                        key={level.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setVariationStrength(level.id)}
                        className={`w-full text-left rounded-xl border p-3 transition-colors ${
                          selected
                            ? 'border-violet-600 bg-violet-50 dark:border-[#8B5CF6] dark:bg-[#7C3AED]/15'
                            : 'border-slate-300 bg-slate-50 hover:border-slate-400 dark:border-white/10 dark:bg-[#0D0D14] dark:hover:border-white/25'
                        }`}
                      >
                        <span className="block text-xs font-semibold text-slate-950 dark:text-white">
                          {level.label}
                        </span>
                        <span className="block text-[11px] text-slate-600 dark:text-[#A1A1AA] mt-0.5">
                          {level.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {betaNotice && (
                  <div className="rounded-xl border border-violet-500/50 bg-violet-50 text-slate-900 dark:border-[#7C3AED]/50 dark:bg-[#08080C] px-4 py-3 text-xs dark:text-[#A1A1AA]">
                    {betaNotice}
                  </div>
                )}

                {isPremium ? (
                  <button
                    type="button"
                    disabled={
                      editing ||
                      falBlocked ||
                      (user?.credits ?? 0) < CREDIT_COSTS.variation
                    }
                    onClick={handleRequestVariation}
                    className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white hover:brightness-110 disabled:opacity-45"
                  >
                    <Layers className="w-4 h-4" aria-hidden="true" />
                    <span>Gerar variação ({CREDIT_COSTS.variation} créditos)</span>
                  </button>
                ) : (
                  renderPremiumGate(
                    'Variações a partir de fotos geradas',
                    'Crie variações sutis, equilibradas ou criativas das suas melhores fotos mantendo sua identidade.'
                  )
                )}
              </div>
            )}

            {activeTab === 'format' && (
              <div className="space-y-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-sm font-semibold text-slate-950 dark:text-white">
                      Expandir enquadramento (IA)
                    </h2>
                    <span className="px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-900 dark:bg-[#7C3AED]/25 dark:text-[#DDD6FE] text-[10px] font-bold uppercase tracking-wider">
                      PREMIUM
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-[#A1A1AA]">
                    Adapte a foto para Stories, capa ou perfil ampliando o cenário sem cortar você.
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    {OUTPAINT_OPTIONS.map((opt) => {
                      const active = outpaintRatio === opt.ratio;
                      return (
                        <button
                          key={opt.ratio}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setOutpaintRatio(opt.ratio)}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-colors ${
                            active
                              ? 'border-violet-600 bg-violet-50 dark:border-[#8B5CF6] dark:bg-[#7C3AED]/20'
                              : 'border-slate-300 bg-slate-50 hover:border-slate-400 dark:border-white/10 dark:bg-[#0D0D14] dark:hover:border-white/25'
                          }`}
                        >
                          <span className="w-7 h-7 rounded-lg bg-white dark:bg-[#17171F] border border-slate-200 dark:border-white/10 flex items-center justify-center shrink-0">
                            <span
                              className={`block rounded-[2px] border-2 ${
                                active
                                  ? 'border-violet-700 dark:border-[#A855F7]'
                                  : 'border-slate-400 dark:border-white/40'
                              } ${opt.frameClass}`}
                            />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-xs font-semibold text-slate-950 dark:text-white">
                              {opt.ratio} · {opt.label}
                            </span>
                            <span className="block text-[10px] text-slate-600 dark:text-[#A1A1AA] truncate">
                              {opt.hint}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {isPremium && (
                    <button
                      type="button"
                      disabled={
                        editing ||
                        falBlocked ||
                        (user?.credits ?? 0) < CREDIT_COSTS.studio_edit
                      }
                      onClick={handleRequestOutpaint}
                      className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-violet-700 bg-white text-xs font-semibold uppercase tracking-wider text-violet-950 hover:bg-violet-50 disabled:opacity-45 dark:border-[#8B5CF6] dark:bg-[#7C3AED]/15 dark:text-white dark:hover:bg-[#7C3AED]/25 transition-colors"
                    >
                      <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        Expandir para {outpaintRatio} ({CREDIT_COSTS.studio_edit} créditos)
                      </span>
                    </button>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-white/10 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-sm font-semibold text-slate-950 dark:text-white">
                      Super Nitidez 2K (Upscale)
                    </h3>
                    <span className="px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-900 dark:bg-[#7C3AED]/25 dark:text-[#DDD6FE] text-[10px] font-bold uppercase tracking-wider">
                      PREMIUM
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-[#A1A1AA]">
                    Amplia a foto de 1K para 2K com maior nitidez natural de pele, olhos e tecidos para impressão ou LinkedIn.
                  </p>

                  {isPremium ? (
                    <button
                      type="button"
                      disabled={
                        editing ||
                        falBlocked ||
                        (user?.credits ?? 0) < CREDIT_COSTS.studio_edit
                      }
                      onClick={handleRequestUpscale2k}
                      className="w-full inline-flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white hover:brightness-110 disabled:opacity-45"
                    >
                      <Sparkles className="w-4 h-4" aria-hidden="true" />
                      <span>Aplicar Super Nitidez 2K ({CREDIT_COSTS.studio_edit} créditos)</span>
                    </button>
                  ) : (
                    renderPremiumGate(
                      'Expansão de formato e Super Nitidez 2K',
                      'Converta suas fotos para Stories/Capa sem cortes e exporte em resolução 2K no plano PREMIUM.'
                    )
                  )}
                </div>

                {betaNotice && (
                  <div className="rounded-xl border border-violet-500/50 bg-violet-50 text-slate-900 dark:border-[#7C3AED]/50 dark:bg-[#08080C] px-4 py-3 text-xs dark:text-[#A1A1AA]">
                    {betaNotice}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'adjust' && (
              <StudioAdjustmentsPanel
                value={adjustments}
                onChange={setAdjustments}
                onReset={() => setAdjustments(DEFAULT_STUDIO_ADJUSTMENTS)}
              />
            )}
          </div>

          {/* Version history — no mobile vive no bottom sheet. */}
          {selectedGen && (
            <div className="hidden lg:block rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-6 space-y-4 shadow-sm dark:shadow-none">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <History
                    className="w-4 h-4 text-violet-700 dark:text-[#8B5CF6]"
                    aria-hidden="true"
                  />
                  <h2 className="font-display text-sm font-semibold text-slate-950 dark:text-white">
                    Histórico de versões ({1 + selectedGen.versions.length})
                  </h2>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-[#A1A1AA]">
                  Toque para editar dela
                </span>
              </div>

              {versionList}
            </div>
          )}
        </div>
      </div>

      {/* Mobile: botão flutuante que abre fotos e versões sob demanda */}
      <button
        type="button"
        onClick={() => setPhotosSheetOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={photosSheetOpen}
        className="fixed bottom-5 right-4 z-40 lg:hidden inline-flex items-center gap-2 px-4 py-3 rounded-full bg-[#7C3AED] text-white text-xs font-semibold uppercase tracking-wider shadow-lg shadow-[#7C3AED]/30 hover:brightness-110 transition-all"
      >
        <Images className="w-4 h-4" aria-hidden="true" />
        Fotos e versões
      </button>

      {/* Mobile: bottom sheet com fotos e versões (só abaixo de lg) */}
      {photosSheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Fotos e versões"
          className="fixed inset-0 z-50 lg:hidden bg-black/60 backdrop-blur-sm flex items-end"
          onClick={() => setPhotosSheetOpen(false)}
        >
          <div
            className="w-full rounded-t-3xl bg-white dark:bg-[#12121A] border-t border-slate-300 dark:border-white/15 max-h-[85vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              aria-hidden="true"
              className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-white/20 mx-auto mt-3 mb-1 shrink-0"
            />
            <div className="px-5 py-3 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-3 shrink-0">
              <h2 className="font-display text-base font-bold text-slate-950 dark:text-white">
                Fotos e versões
              </h2>
              <button
                type="button"
                aria-label="Fechar fotos e versões"
                onClick={() => setPhotosSheetOpen(false)}
                className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-600 hover:text-slate-950 hover:bg-slate-100 dark:text-[#A1A1AA] dark:hover:text-white dark:hover:bg-white/5"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="overflow-y-auto px-4 sm:px-5 py-4 space-y-6">
              <section className="space-y-2">
                <h3 className="text-xs font-medium text-slate-700 dark:text-[#A1A1AA]">
                  Fotografia ativa
                </h3>
                {photoList}
              </section>

              {selectedGen && (
                <section className="space-y-2">
                  <h3 className="text-xs font-medium text-slate-700 dark:text-[#A1A1AA]">
                    Histórico de versões ({1 + selectedGen.versions.length})
                  </h3>
                  {versionList}
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
