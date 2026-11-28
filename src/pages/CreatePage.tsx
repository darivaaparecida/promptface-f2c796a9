import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Gift,
  Heart,
  HelpCircle,
  LayoutGrid,
  PenLine,
  RefreshCw,
  RotateCcw,
  Search,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserCheck,
  Wand2,
  X,
} from 'lucide-react';
import {
  CUSTOMIZATION_OPTIONS,
} from '../shared/catalog';
import { useCatalog } from '../shared/useCatalog';
import { CREDIT_COSTS } from '../shared/rules';
import {
  getPreferredAiModelOption,
  normalizePreferredAiModel,
  resolveEffectiveModel,
  type PreferredAiModelId,
} from '../shared/aiModels';
import { useAuth } from '../context/AuthContext';
import { getVisualProfile, joinWaitlist, listFaces, toggleFavorite } from '../lib/db';
import { getMyInviteCode } from '../lib/db';
import { buildScenarioInviteLink, saveInviteCode } from '../shared/invites';
import { useToast } from '../context/ToastContext';
import { resolveProfileAvatarDisplay } from '../shared/defaultAvatars';
import { ButtonSpinner } from '../components/ButtonSpinner';
import { CREATE_TOUR_SEEN_KEY, CreateTour } from '../components/CreateTour';
import { ExpandableTextField } from '../components/ExpandableTextField';
import { ImageWithFallback } from '../components/ImageWithFallback';
import { ProfileAvatar } from '../components/ProfileAvatar';

interface FaceSummary {
  id: string;
  url: string;
}

interface GeneratedResult {
  id: string;
  scenarioTitle: string;
  categoryName: string;
  aspectRatio: string;
  url: string;
  favorite: boolean;
  synthIdMarked: boolean;
  createdAt: string;
}

const LOADING_MESSAGES = [
  'Analisando seu rosto...',
  'Montando o cenário...',
  'Ajustando a luz...',
  'Preservando texturas naturais...',
];

const ASPECT_RATIO_UI: Record<string, { shortName: string; frameClass: string }> = {
  '3:4': { shortName: 'Retrato', frameClass: 'w-4 h-5' },
  '1:1': { shortName: 'Quadrado', frameClass: 'w-[18px] h-[18px]' },
  '16:9': { shortName: 'Paisagem', frameClass: 'w-6 h-3.5' },
  '9:16': { shortName: 'Stories', frameClass: 'w-3 h-5' },
};

export function CreatePage() {
  const { user, config, updateCredits, refreshConfig, getMediaUrl } = useAuth();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Chegada por link de convite com cenário (?ref=CODIGO): guarda o código
  // no navegador para aplicar no cadastro, mesmo sem estar logado.
  useEffect(() => {
    saveInviteCode(searchParams.get('ref'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { categories, scenarios } = useCatalog();
  const initialPromptParam = searchParams.get('prompt') || '';
  const initialMode =
    searchParams.get('modo') === 'livre' || (initialPromptParam && !searchParams.get('cenario'))
      ? 'free'
      : 'preset';
  const initialScenarioId = searchParams.get('cenario') || scenarios[0]?.id || 'luxo-1';

  const [mode, setMode] = useState<'preset' | 'free'>(initialMode);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedScenarioId, setSelectedScenarioId] = useState(initialScenarioId);
  const [scenarioPickerOpen, setScenarioPickerOpen] = useState(false);
  const [scenarioPickerQuery, setScenarioPickerQuery] = useState('');
  const [tourOpen, setTourOpen] = useState<boolean>(() => {
    try {
      return !window.localStorage.getItem(CREATE_TOUR_SEEN_KEY);
    } catch {
      return false;
    }
  });

  // Visual profile pre-check
  const [faces, setFaces] = useState<FaceSummary[]>([]);
  const [preferredModel, setPreferredModel] = useState<PreferredAiModelId>(() =>
    normalizePreferredAiModel(user?.preferredModel)
  );
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Preset customizations
  const [outfit, setOutfit] = useState('');
  const [environment, setEnvironment] = useState('');
  const [pose, setPose] = useState('');
  const [lighting, setLighting] = useState(CUSTOMIZATION_OPTIONS.lighting[0]);
  const [style, setStyle] = useState(CUSTOMIZATION_OPTIONS.styles[0]);
  const [aspectRatio, setAspectRatio] = useState('3:4');

  // Free mode
  const [freePrompt, setFreePrompt] = useState(initialPromptParam);
  const [enhancedDraft, setEnhancedDraft] = useState<string | null>(null);
  const [enhancing] = useState(false);

  // Generation flow
  const [generating] = useState(false);
  const [togglingFavorite, setTogglingFavorite] = useState(false);
  const [submittingWaitlist, setSubmittingWaitlist] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [betaWaitlistMode, setBetaWaitlistMode] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState(user?.email || '');
  const [waitlistFeedback, setWaitlistFeedback] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [copiedInviteNotice, setCopiedInviteNotice] = useState(false);

  void updateCredits;
  void refreshConfig;

  const filteredScenarios = useMemo(() => {
    if (selectedCategoryFilter === 'all') return scenarios;
    return scenarios.filter((s) => s.categoryId === selectedCategoryFilter);
  }, [scenarios, selectedCategoryFilter]);

  const selectedScenario = useMemo(
    () => scenarios.find((s) => s.id === selectedScenarioId) || scenarios[0],
    [scenarios, selectedScenarioId]
  );

  const pickerScenarios = useMemo(() => {
    const q = scenarioPickerQuery.trim().toLowerCase();
    if (!q) return scenarios;
    return scenarios.filter((s) => s.title.toLowerCase().includes(q));
  }, [scenarios, scenarioPickerQuery]);

  useEffect(() => {
    if (!scenarioPickerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setScenarioPickerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [scenarioPickerOpen]);

  // O catálogo (cenários) vem do Supabase (useCatalog) com fallback para o
  // código (src/shared/catalog.ts) se a leitura do banco falhar.

  useEffect(() => {
    let cancelled = false;
    Promise.all([getVisualProfile(), listFaces()])
      .then(([profileResult, faceList]) => {
        if (cancelled) return;
        setFaces(faceList.map((face) => ({ id: face.id, url: face.url })));
        setPreferredModel(
          normalizePreferredAiModel(
            profileResult.profile?.preferredModel ??
              profileResult.preferredModel ??
              user?.preferredModel
          )
        );
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingProfile(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedScenario) {
      setOutfit(selectedScenario.defaultOutfit);
      setEnvironment(selectedScenario.defaultEnvironment);
      setPose(selectedScenario.defaultPose);
      setLighting(selectedScenario.defaultLighting);
      setStyle(selectedScenario.defaultStyle);
    }
  }, [selectedScenario]);

  useEffect(() => {
    if (!generating) return;
    const timer = setInterval(() => {
      setLoadingMsgIdx((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 1800);
    return () => clearInterval(timer);
  }, [generating]);

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategoryFilter(categoryId);
    if (categoryId === 'all') return;
    const matches = scenarios.filter((s) => s.categoryId === categoryId);
    if (matches.length > 0 && !matches.some((s) => s.id === selectedScenarioId)) {
      setSelectedScenarioId(matches[0].id);
    }
  };

  const handleRestoreDefaults = () => {
    if (!selectedScenario) return;
    setOutfit(selectedScenario.defaultOutfit);
    setEnvironment(selectedScenario.defaultEnvironment);
    setPose(selectedScenario.defaultPose);
    setLighting(selectedScenario.defaultLighting);
    setStyle(selectedScenario.defaultStyle);
  };

  const handleModeSwitch = (nextMode: 'preset' | 'free') => {
    setMode(nextMode);
    setErrorMsg(null);
    if (nextMode === 'free') {
      searchParams.set('modo', 'livre');
    } else {
      searchParams.delete('modo');
    }
    setSearchParams(searchParams, { replace: true });
  };

  const handleEnhanceDescription = async () => {
    setErrorMsg(null);
    if (!freePrompt.trim()) {
      setErrorMsg('Escreva uma ideia inicial antes de usar Melhorar minha descrição.');
      return;
    }
    // Fase 1: melhoria automática desativada — precisa de chave secreta e
    // chega na Fase 2 via Edge Function. Nenhum crédito é descontado.
    setErrorMsg('Melhoria automática em breve — estamos ativando os servidores de IA.');
  };

  const runGeneration = async (isVariation = false) => {
    void isVariation;
    setErrorMsg(null);
    // Fase 1: geração desativada — precisa de chave secreta e chega na
    // Fase 2 via Edge Function. Nenhum crédito é descontado; mostra a tela
    // de lista de espera que já existia para o serviço não configurado.
    setErrorMsg('Geração em breve — estamos ativando nossa infraestrutura de imagem.');
    setBetaWaitlistMode(true);
  };

  const handleToggleFavorite = async () => {
    if (!result) return;
    setTogglingFavorite(true);
    try {
      const favorite = await toggleFavorite(result.id);
      setResult((prev) => (prev ? { ...prev, favorite } : prev));
    } catch (err) {
      addToast({
        variant: 'error',
        title: 'Falha ao favoritar',
        description: err instanceof Error ? err.message : 'Não foi possível atualizar a foto.',
      });
    } finally {
      setTogglingFavorite(false);
    }
  };

  const handleShare = async () => {
    if (!result) return;
    const shareText = `Minha foto criada no PromptFace: ${result.scenarioTitle}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'PromptFace',
          text: shareText,
          url: window.location.origin,
        });
        return;
      } catch {
        // Fallback to copy
      }
    }
    await navigator.clipboard.writeText(`${shareText} — ${window.location.origin}`);
    setCopiedNotice(true);
    setTimeout(() => setCopiedNotice(false), 2500);
  };

  /**
   * Compartilha o cenário com o convite junto: quem abrir o link cai na
   * criação já naquele cenário, com o código de quem indicou.
   */
  const handleShareScenarioInvite = async () => {
    if (!user) return;
    try {
      const code = await getMyInviteCode();
      const link = `${window.location.origin}${buildScenarioInviteLink(selectedScenarioId, code)}`;
      const shareText = `Cria sua foto nesse cenário no PromptFace: ${link}`;
      if (navigator.share) {
        try {
          await navigator.share({ title: 'PromptFace', text: shareText, url: link });
          return;
        } catch {
          // Fallback to copy
        }
      }
      await navigator.clipboard.writeText(link);
      setCopiedInviteNotice(true);
      setTimeout(() => setCopiedInviteNotice(false), 2500);
    } catch {
      addToast({
        variant: 'info',
        title: 'Não foi possível gerar o link de convite',
        description: 'Tente novamente em instantes.',
      });
    }
  };

  const handleBetaWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingWaitlist(true);
    try {
      await joinWaitlist(waitlistEmail, 'generation');
      setWaitlistFeedback('Você entrou na lista de espera prioritária.');
    } catch (err) {
      setWaitlistFeedback(
        err instanceof Error ? err.message : 'Não foi possível entrar na lista de espera.'
      );
    } finally {
      setSubmittingWaitlist(false);
    }
  };

  const hasFaces = faces.length > 0;
  // Custo da geração depende do modelo efetivo: 10 créditos com o 2.1,
  // 20 créditos com o Nano Banana Pro (opção paga de máxima qualidade).
  // O saldo vai junto: com menos de 20 créditos o Pro salvo cai para o
  // 2.1, então o usuário nunca fica travado sem conseguir gerar.
  const effectiveGenerationModel = resolveEffectiveModel(
    user?.planId ?? 'free_trial',
    preferredModel,
    user?.credits ?? 0
  );
  const generationCost =
    effectiveGenerationModel.model === 'gemini-nano-banana-pro'
      ? CREDIT_COSTS.generate_pro
      : CREDIT_COSTS.generate;
  const hasEnoughCredits = (user?.credits ?? 0) >= generationCost;
  const falQuota = config.falQuota;
  const falBlocked = Boolean(falQuota?.active && falQuota.exhausted);
  const avatarDisplay = resolveProfileAvatarDisplay({
    faces,
    seed: user?.id || user?.email,
    getMediaUrl,
  });

  const isOutfitEdited = Boolean(
    mode === 'preset' && selectedScenario && outfit !== selectedScenario.defaultOutfit
  );
  const isEnvEdited = Boolean(
    mode === 'preset' && selectedScenario && environment !== selectedScenario.defaultEnvironment
  );
  const isPoseEdited = Boolean(
    mode === 'preset' && selectedScenario && pose !== selectedScenario.defaultPose
  );
  const hasAnyCustomization = Boolean(
    mode === 'preset' &&
      selectedScenario &&
      (isOutfitEdited ||
        isEnvEdited ||
        isPoseEdited ||
        lighting !== selectedScenario.defaultLighting ||
        style !== selectedScenario.defaultStyle)
  );

  const selectedRatioMeta =
    CUSTOMIZATION_OPTIONS.aspectRatios.find((r) => r.id === aspectRatio) ||
    CUSTOMIZATION_OPTIONS.aspectRatios[0];

  // RESULT SCREEN
  if (result) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setResult(null)}
            className="inline-flex items-center gap-2 text-sm text-slate-700 hover:text-slate-950 dark:text-[#A1A1AA] dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Voltar para a criação
          </button>

          <p className="text-xs text-slate-700 dark:text-[#A1A1AA] font-mono-num">
            Créditos restantes:{' '}
            <strong className="text-slate-950 dark:text-white">{user?.credits ?? 0}</strong>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] overflow-hidden shadow-sm dark:shadow-none">
            <div className="relative">
              <ImageWithFallback
                src={getMediaUrl(result.url)}
                alt={result.scenarioTitle}
                className="w-full h-auto object-cover"
              />
              <div className="absolute bottom-3 left-3 text-xs text-white bg-[#08080C]/85 backdrop-blur-sm px-2.5 py-1 rounded-md border border-white/15">
                Foto gerada por IA {result.synthIdMarked ? '· SynthID' : ''}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-6 space-y-6 shadow-sm dark:shadow-none">
            <div>
              <p className="text-xs text-slate-700 dark:text-[#A1A1AA]">{result.categoryName}</p>
              <h1 className="mt-1 font-display text-xl font-bold text-slate-950 dark:text-white">
                {result.scenarioTitle}
              </h1>
            </div>

            <div className="space-y-3">
              <a
                href={getMediaUrl(result.url)}
                download={`promptface-${result.id}.png`}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white hover:brightness-110"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                Baixar em alta resolução
              </a>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={generating}
                  onClick={() => {
                    setResult(null);
                    void runGeneration(false);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-violet-700 text-xs font-medium text-violet-950 hover:bg-violet-50 dark:border-[#7C3AED] dark:text-white dark:hover:bg-[#7C3AED]/15 disabled:opacity-50"
                >
                  {generating ? (
                    <ButtonSpinner size="md" />
                  ) : (
                    <RefreshCw className="w-4 h-4" aria-hidden="true" />
                  )}
                  <span>{generating ? 'Gerando...' : 'Gerar novamente'}</span>
                </button>

                <button
                  type="button"
                  disabled={generating}
                  onClick={() => {
                    setResult(null);
                    void runGeneration(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-violet-700 text-xs font-medium text-violet-950 hover:bg-violet-50 dark:border-[#7C3AED] dark:text-white dark:hover:bg-[#7C3AED]/15 disabled:opacity-50"
                >
                  {generating ? (
                    <ButtonSpinner size="md" />
                  ) : (
                    <Sparkles className="w-4 h-4" aria-hidden="true" />
                  )}
                  <span>{generating ? 'Gerando...' : 'Criar variações'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={togglingFavorite}
                  onClick={handleToggleFavorite}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-xs font-medium transition-colors disabled:opacity-60 ${
                    result.favorite
                      ? 'border-pink-600 bg-pink-50 text-pink-950 dark:border-[#EC4899] dark:bg-[#EC4899]/15 dark:text-white'
                      : 'border-slate-300 text-slate-900 hover:bg-slate-100 dark:border-white/15 dark:text-white dark:hover:bg-white/5'
                  }`}
                >
                  {togglingFavorite ? (
                    <ButtonSpinner size="md" />
                  ) : (
                    <Heart
                      className={`w-4 h-4 ${
                        result.favorite ? 'fill-[#EC4899] text-[#EC4899]' : ''
                      }`}
                      aria-hidden="true"
                    />
                  )}
                  <span>{result.favorite ? 'Favoritada' : 'Favoritos'}</span>
                </button>

                <Link
                  to={`/studio?foto=${result.id}`}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 hover:bg-slate-100 dark:border-white/15 dark:text-white dark:hover:bg-white/5"
                >
                  <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
                  Editar no Studio
                </Link>
              </div>

              <button
                type="button"
                onClick={handleShare}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-300 text-xs font-medium text-slate-900 hover:bg-slate-100 dark:border-white/15 dark:text-white dark:hover:bg-white/5"
              >
                {copiedNotice ? (
                  <>
                    <Check
                      className="w-4 h-4 text-emerald-600 dark:text-emerald-400"
                      aria-hidden="true"
                    />
                    Link copiado para compartilhar
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" aria-hidden="true" />
                    Compartilhar
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleShareScenarioInvite}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-violet-600/40 bg-violet-600/10 text-xs font-medium text-violet-700 hover:bg-violet-600/20 dark:border-[#8B5CF6]/40 dark:bg-[#8B5CF6]/10 dark:text-[#A855F7] dark:hover:bg-[#8B5CF6]/20"
              >
                {copiedInviteNotice ? (
                  <>
                    <Check
                      className="w-4 h-4 text-emerald-600 dark:text-emerald-400"
                      aria-hidden="true"
                    />
                    Link com convite copiado
                  </>
                ) : (
                  <>
                    <Gift className="w-4 h-4" aria-hidden="true" />
                    Compartilhar cenário com meu convite
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12 pb-24 sm:pb-24 lg:pb-12 space-y-6 sm:space-y-8">
      {/* Studio Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2 border-b border-slate-200 dark:border-white/10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-[#8B5CF6]">
            Estúdio de geração
          </p>
          <h1 className="mt-1.5 font-display text-2xl sm:text-3xl font-bold text-slate-950 dark:text-white">
            Criar nova fotografia
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-[#A1A1AA]">
            Escolha um cenário pronto ou descreva uma cena livre, personalize os detalhes e revise antes de confirmar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setTourOpen((prev) => !prev)}
            aria-expanded={tourOpen}
            className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition-colors ${
              tourOpen
                ? 'border-violet-600 bg-violet-50 text-violet-900 dark:border-[#8B5CF6] dark:bg-[#7C3AED]/20 dark:text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:border-violet-600 hover:text-slate-950 dark:border-white/10 dark:bg-[#17171F] dark:text-[#A1A1AA] dark:hover:border-[#8B5CF6] dark:hover:text-white'
            }`}
          >
            <HelpCircle className="w-4 h-4 text-violet-700 dark:text-[#A855F7]" aria-hidden="true" />
            <span>Como usar</span>
          </button>

          <div className="inline-flex items-center gap-3 rounded-xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] px-4 py-2.5 shadow-sm dark:shadow-none">
            <span className="text-xs text-slate-600 dark:text-[#A1A1AA]">Seu saldo</span>
            <span className="text-sm font-bold text-slate-950 dark:text-white font-mono-num">
              {user?.credits ?? 0} créditos
            </span>
          </div>
        </div>
      </div>

      <CreateTour open={tourOpen} onOpenChange={setTourOpen} />

      {/* MANDATORY FLOW RULE: Visual Profile state shown AT THE TOP BEFORE generate button */}
      {!loadingProfile && !hasFaces ? (
        <div
          data-tour="upload"
          role="region"
          aria-label="Status do Perfil Visual"
          className="rounded-2xl border border-violet-600 bg-white dark:border-[#7C3AED] dark:bg-[#17171F] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm dark:shadow-none"
        >
          <div className="flex items-start sm:items-center gap-4">
            <ProfileAvatar
              faces={faces}
              seed={user?.id || user?.email}
              getMediaUrl={getMediaUrl}
              size="md"
            />
            <div className="space-y-1">
              <h2 className="font-display text-base font-semibold text-slate-950 dark:text-white">
                Você ainda não enviou seu rosto — enviar agora
              </h2>
              <p className="text-sm text-slate-700 dark:text-[#A1A1AA]">
                {avatarDisplay.label} está ativo no seu perfil. Para gerar fotografias preservando sua identidade facial, envie pelo menos 1 foto no Perfil Visual.
              </p>
            </div>
          </div>
          <Link
            to="/perfil-visual"
            className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white whitespace-nowrap shrink-0 hover:brightness-110 transition-all"
          >
            Enviar meu rosto agora
          </Link>
        </div>
      ) : (
        <div
          data-tour="upload"
          className="rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#17171F] px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-sm dark:shadow-none"
        >
          <div className="flex items-center gap-3.5">
            <ProfileAvatar
              faces={faces}
              seed={user?.id || user?.email}
              getMediaUrl={getMediaUrl}
              size="sm"
            />
            <div>
              <p className="text-sm font-medium text-slate-950 dark:text-white flex items-center gap-1.5">
                <UserCheck
                  className="w-4 h-4 text-violet-700 dark:text-[#8B5CF6] shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Perfil Visual ativo ({faces.length}{' '}
                  {faces.length === 1 ? 'foto de referência' : 'fotos de referência'})
                </span>
              </p>
              <p className="text-xs text-slate-600 dark:text-[#A1A1AA]">
                Suas referências privadas preservam seu rosto em qualquer cenário ou iluminação.
              </p>
            </div>
          </div>
          <Link
            to="/perfil-visual"
            className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 dark:text-[#A855F7] hover:underline whitespace-nowrap"
          >
            <span>Gerenciar Perfil Visual</span>
            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      )}

      {/* Low credits warning */}
      {!hasEnoughCredits && (
        <div className="rounded-2xl border border-amber-600/45 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-950/25 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle
              className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold text-amber-950 dark:text-white">
                Saldo baixo para novas gerações
              </p>
              <p className="text-xs text-amber-900 dark:text-[#A1A1AA]">
                Você possui {user?.credits ?? 0} créditos. Cada foto gerada custa{' '}
                {generationCost} créditos.
              </p>
            </div>
          </div>
          <Link
            to="/planos"
            className="px-4 py-2.5 rounded-xl border border-violet-700 text-xs font-semibold uppercase tracking-wider text-violet-950 bg-white hover:bg-violet-50 dark:border-[#7C3AED] dark:bg-transparent dark:text-white whitespace-nowrap shrink-0 dark:hover:bg-[#7C3AED]/15"
          >
            Ver planos
          </Link>
        </div>
      )}

      {/* Mode Selector — Studio Segmented Cards */}
      <div
        role="tablist"
        aria-label="Modo de criação"
        className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-1.5 rounded-2xl border border-slate-300 bg-slate-100/90 dark:border-white/10 dark:bg-[#111118]"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'preset'}
          onClick={() => handleModeSwitch('preset')}
          className={`text-left flex items-start gap-3.5 px-4 py-3.5 rounded-xl transition-all ${
            mode === 'preset'
              ? 'bg-white border border-violet-500/60 shadow-sm dark:bg-[#1C1C28] dark:border-[#8B5CF6]/70 dark:shadow-none'
              : 'border border-transparent hover:bg-white/60 dark:hover:bg-white/5'
          }`}
        >
          <span
            className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              mode === 'preset'
                ? 'bg-[#7C3AED] text-white'
                : 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-[#A1A1AA]'
            }`}
          >
            <LayoutGrid className="w-4 h-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-[#A855F7]">
              Modo 1
            </span>
            <span className="block text-sm font-semibold text-slate-950 dark:text-white">
              Criação Pronta
            </span>
            <span className="block text-xs text-slate-600 dark:text-[#A1A1AA] mt-0.5">
              Escolha entre 84 cenários prontos e ajuste roupa, ambiente e pose.
            </span>
          </span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mode === 'free'}
          onClick={() => handleModeSwitch('free')}
          className={`text-left flex items-start gap-3.5 px-4 py-3.5 rounded-xl transition-all ${
            mode === 'free'
              ? 'bg-white border border-violet-500/60 shadow-sm dark:bg-[#1C1C28] dark:border-[#8B5CF6]/70 dark:shadow-none'
              : 'border border-transparent hover:bg-white/60 dark:hover:bg-white/5'
          }`}
        >
          <span
            className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              mode === 'free'
                ? 'bg-[#7C3AED] text-white'
                : 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-[#A1A1AA]'
            }`}
          >
            <PenLine className="w-4 h-4" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-[#A855F7]">
              Modo 2
            </span>
            <span className="block text-sm font-semibold text-slate-950 dark:text-white">
              Criação Livre
            </span>
            <span className="block text-xs text-slate-600 dark:text-[#A1A1AA] mt-0.5">
              Descreva qualquer cena do zero com suas próprias palavras.
            </span>
          </span>
        </button>
      </div>

      {/* Loading Animation State */}
      {generating ? (
        <div className="rounded-2xl border border-violet-500/50 bg-white dark:bg-[#17171F] p-10 sm:p-14 text-center space-y-6 shadow-sm dark:shadow-none">
          <div className="mx-auto max-w-sm aspect-[3/4] rounded-2xl skeleton-violet border border-slate-300 dark:border-white/10" />
          <div className="space-y-2">
            <p className="font-display text-lg font-semibold text-slate-950 dark:text-white">
              {LOADING_MESSAGES[loadingMsgIdx]}
            </p>
            <p className="text-xs text-slate-700 dark:text-[#A1A1AA]">
              Estamos combinando suas referências faciais com iluminação e textura fotográfica realista.
            </p>
          </div>
        </div>
      ) : betaWaitlistMode ? (
        // Activates cleanly when generation service is unconfigured or awaiting paid activation (no technical error leaked)
        <div className="rounded-2xl border border-violet-500/45 bg-white dark:border-[#7C3AED]/40 dark:bg-[#17171F] p-8 space-y-5 shadow-sm dark:shadow-none">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-[#8B5CF6]">
            Beta fechado
          </p>
          <h2 className="font-display text-2xl font-bold text-slate-950 dark:text-white">
            Geração em breve — estamos ativando
          </h2>
          <p className="text-sm text-slate-700 dark:text-[#A1A1AA] max-w-xl">
            Nenhum crédito foi descontado da sua conta. Nossa infraestrutura de geração está em fase final de ativação — entre na lista de espera prioritária para receber acesso imediato na liberação.
          </p>
          <form onSubmit={handleBetaWaitlist} className="flex flex-col sm:flex-row gap-3 max-w-md">
            <input
              type="email"
              required
              value={waitlistEmail}
              onChange={(e) => setWaitlistEmail(e.target.value)}
              placeholder="seu@email.com"
              className="flex-1 px-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
            />
            <button
              type="submit"
              disabled={submittingWaitlist}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-60"
            >
              {submittingWaitlist && <ButtonSpinner size="sm" />}
              <span>{submittingWaitlist ? 'Enviando...' : 'Entrar na lista'}</span>
            </button>
          </form>
          {waitlistFeedback && (
            <p className="text-xs text-violet-700 dark:text-[#8B5CF6]">{waitlistFeedback}</p>
          )}
          <button
            type="button"
            onClick={() => setBetaWaitlistMode(false)}
            className="text-xs text-slate-700 hover:text-slate-950 dark:text-[#A1A1AA] dark:hover:text-white underline"
          >
            Voltar para configuração do cenário
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left Studio Workspace */}
          <div className="lg:col-span-7 space-y-6">
            {/* Step 1: Scenario or Free Prompt */}
            <section
              data-tour="scenario"
              aria-labelledby="step-1-heading"
              className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-5 sm:p-6 space-y-5 shadow-sm dark:shadow-none"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-violet-100 text-xs font-bold font-mono-num text-violet-800 dark:bg-[#7C3AED]/25 dark:text-[#C4B5FD]">
                    1
                  </span>
                  <h2
                    id="step-1-heading"
                    className="font-display text-base font-semibold text-slate-950 dark:text-white"
                  >
                    {mode === 'preset' ? 'Cenário de referência' : 'Descreva a cena desejada'}
                  </h2>
                </div>

                {mode === 'preset' && (
                  <Link
                    to="/cenarios"
                    className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 hover:text-violet-900 dark:text-[#A855F7] dark:hover:text-white transition-colors"
                  >
                    <span>Explorar galeria visual (84)</span>
                    <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                )}
              </div>

              {mode === 'preset' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-5 space-y-1.5">
                      <label
                        htmlFor="select-category"
                        className="block text-xs font-medium text-slate-700 dark:text-[#A1A1AA]"
                      >
                        Categoria
                      </label>
                      <select
                        id="select-category"
                        value={selectedCategoryFilter}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 focus:outline-none focus:border-violet-700 dark:bg-[#0D0D14] dark:border-white/15 dark:text-white dark:focus:border-[#8B5CF6]"
                      >
                        <option value="all">Todas as categorias ({scenarios.length})</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-7 space-y-1.5">
                      <label
                        htmlFor="select-scenario"
                        className="block text-xs font-medium text-slate-700 dark:text-[#A1A1AA]"
                      >
                        Cenário ({filteredScenarios.length}{' '}
                        {filteredScenarios.length === 1 ? 'opção' : 'opções'})
                      </label>
                      <select
                        id="select-scenario"
                        value={selectedScenarioId}
                        onChange={(e) => setSelectedScenarioId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 focus:outline-none focus:border-violet-700 dark:bg-[#0D0D14] dark:border-white/15 dark:text-white dark:focus:border-[#8B5CF6]"
                      >
                        {filteredScenarios.map((s) => (
                          <option key={s.id} value={s.id}>
                            {selectedCategoryFilter === 'all'
                              ? `${s.categoryName} — ${s.title}`
                              : s.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setScenarioPickerOpen(true)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-violet-700 text-xs font-semibold uppercase tracking-wider text-violet-950 bg-white hover:bg-violet-50 dark:border-[#7C3AED] dark:bg-transparent dark:text-white dark:hover:bg-[#7C3AED]/15 transition-colors"
                  >
                    <LayoutGrid className="w-4 h-4" aria-hidden="true" />
                    <span>Escolher vendo as fotos</span>
                  </button>

                  {selectedScenario && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/80 dark:border-white/10 dark:bg-[#0D0D14] p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                      <ImageWithFallback
                        src={selectedScenario.image}
                        alt={selectedScenario.title}
                        className="w-full sm:w-24 h-40 sm:h-28 rounded-xl object-cover shrink-0 border border-slate-200 dark:border-white/10"
                      />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-700 dark:text-[#A855F7]">
                            {selectedScenario.categoryName}
                          </span>
                          {hasAnyCustomization && (
                            <button
                              type="button"
                              onClick={handleRestoreDefaults}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-violet-500 hover:text-violet-800 dark:border-white/15 dark:bg-[#17171F] dark:text-[#A1A1AA] dark:hover:text-white transition-colors"
                            >
                              <RotateCcw className="w-3 h-3" aria-hidden="true" />
                              <span>Restaurar padrão</span>
                            </button>
                          )}
                        </div>
                        <h3 className="text-sm sm:text-base font-semibold text-slate-950 dark:text-white">
                          {selectedScenario.title}
                        </h3>
                        <p className="text-xs leading-relaxed text-slate-600 dark:text-[#A1A1AA]">
                          {selectedScenario.description}
                        </p>
                        {user && (
                          <button
                            type="button"
                            onClick={() => void handleShareScenarioInvite()}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 hover:text-violet-900 dark:text-[#A855F7] dark:hover:text-[#C4B5FD]"
                          >
                            <Gift className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>
                              {copiedInviteNotice
                                ? 'Link com convite copiado!'
                                : 'Compartilhar este cenário com meu convite'}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <ExpandableTextField
                    id="free-prompt"
                    label="Sua descrição principal"
                    hint="Inclua lugar, roupa, horário do dia e expressão. Quanto mais claro, mais fiel o resultado."
                    value={freePrompt}
                    onChange={setFreePrompt}
                    defaultRows={5}
                    expandedRows={10}
                    placeholder="Quero estar em Dubai, encostado em uma Lamborghini preta, usando uma roupa social elegante, durante o pôr do sol, com fotografia profissional realista."
                  />

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <button
                      type="button"
                      disabled={enhancing}
                      onClick={handleEnhanceDescription}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-violet-700 text-xs font-semibold text-violet-950 hover:bg-violet-50 dark:border-[#7C3AED] dark:text-white dark:hover:bg-[#7C3AED]/15 disabled:opacity-50 transition-colors"
                    >
                      {enhancing ? (
                        <ButtonSpinner
                          size="md"
                          className="text-violet-700 dark:text-[#8B5CF6]"
                        />
                      ) : (
                        <Wand2
                          className="w-4 h-4 text-violet-700 dark:text-[#8B5CF6]"
                          aria-hidden="true"
                        />
                      )}
                      <span>
                        {enhancing
                          ? 'Melhorando...'
                          : `Melhorar minha descrição (${CREDIT_COSTS.enhance_prompt} crédito)`}
                      </span>
                    </button>
                    <span className="text-xs text-slate-600 dark:text-[#A1A1AA]">
                      Reescreve com detalhes fotográficos para você aprovar antes de gerar.
                    </span>
                  </div>

                  {enhancedDraft !== null && (
                    <div className="rounded-xl border border-violet-500/50 bg-slate-50 dark:bg-[#08080C] p-4 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-violet-700 dark:text-[#8B5CF6]">
                          Descrição melhorada (revise antes de aplicar)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setFreePrompt(enhancedDraft);
                            setEnhancedDraft(null);
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-950 hover:text-violet-700 dark:text-white dark:hover:text-[#A855F7]"
                        >
                          <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                          Aplicar no campo principal
                        </button>
                      </div>
                      <ExpandableTextField
                        id="enhanced-draft"
                        label="Sugestão otimizada"
                        value={enhancedDraft}
                        onChange={setEnhancedDraft}
                        defaultRows={4}
                        expandedRows={8}
                      />
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Step 2: Expandable Scene Details */}
            <section
              aria-labelledby="step-2-heading"
              className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-5 sm:p-6 space-y-5 shadow-sm dark:shadow-none"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-violet-100 text-xs font-bold font-mono-num text-violet-800 dark:bg-[#7C3AED]/25 dark:text-[#C4B5FD]">
                      2
                    </span>
                    <h2
                      id="step-2-heading"
                      className="font-display text-base font-semibold text-slate-950 dark:text-white"
                    >
                      Detalhes da cena
                    </h2>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-[#A1A1AA]">
                    Edite livremente cada parte da fotografia. Clique em <strong className="font-semibold text-slate-800 dark:text-white">Ampliar campo</strong> se precisar de mais espaço para textos longos.
                  </p>
                </div>

                {hasAnyCustomization && (
                  <button
                    type="button"
                    onClick={handleRestoreDefaults}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-700 hover:underline dark:text-[#A855F7] shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    Restaurar textos originais
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <ExpandableTextField
                  id="custom-outfit"
                  label="Roupa e acessórios"
                  hint="Descreva peças, cores, tecidos e estilo (ex.: terno grafite sob medida, jaqueta de couro ou vestido leve)."
                  value={outfit}
                  onChange={setOutfit}
                  defaultRows={2}
                  expandedRows={5}
                  isCustomized={isOutfitEdited}
                  placeholder="Ex.: Terno preto elegante com camisa branca aberta no colarinho"
                />

                <ExpandableTextField
                  id="custom-env"
                  label="Ambiente e fundo"
                  hint="Defina o local, arquitetura, paisagem e elementos visíveis ao redor."
                  value={environment}
                  onChange={setEnvironment}
                  defaultRows={2}
                  expandedRows={5}
                  isCustomized={isEnvEdited}
                  placeholder="Ex.: Terraço panorâmico em Dubai com vista da cidade ao entardecer"
                />

                <ExpandableTextField
                  id="custom-pose"
                  label="Pose e expressão"
                  hint="Como você quer aparecer na foto (postura, direção do olhar, mãos e expressão facial)."
                  value={pose}
                  onChange={setPose}
                  defaultRows={2}
                  expandedRows={5}
                  isCustomized={isPoseEdited}
                  placeholder="Ex.: Olhando para a câmera com sorriso natural e postura confiante"
                />
              </div>
            </section>

            {/* Step 3: Photography Style & Visual Aspect Ratio */}
            <section
              aria-labelledby="step-3-heading"
              className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-5 sm:p-6 space-y-5 shadow-sm dark:shadow-none"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-violet-100 text-xs font-bold font-mono-num text-violet-800 dark:bg-[#7C3AED]/25 dark:text-[#C4B5FD]">
                    3
                  </span>
                  <h2
                    id="step-3-heading"
                    className="font-display text-base font-semibold text-slate-950 dark:text-white"
                  >
                    Estética fotográfica e formato
                  </h2>
                </div>
                <p className="text-xs text-slate-600 dark:text-[#A1A1AA]">
                  Ajuste o clima de luz, a estética da lente e a proporção ideal para onde vai publicar.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="custom-lighting"
                    className="block text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    Iluminação
                  </label>
                  <select
                    id="custom-lighting"
                    value={lighting}
                    onChange={(e) => setLighting(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 focus:outline-none focus:border-violet-700 dark:bg-[#0D0D14] dark:border-white/15 dark:text-white dark:focus:border-[#8B5CF6]"
                  >
                    {CUSTOMIZATION_OPTIONS.lighting.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="custom-style"
                    className="block text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    Estilo da foto
                  </label>
                  <select
                    id="custom-style"
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 focus:outline-none focus:border-violet-700 dark:bg-[#0D0D14] dark:border-white/15 dark:text-white dark:focus:border-[#8B5CF6]"
                  >
                    {CUSTOMIZATION_OPTIONS.styles.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900 dark:text-white">
                    Proporção / formato
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-[#A1A1AA] font-mono-num">
                    Selecionado: {selectedRatioMeta.label}
                  </span>
                </div>

                <div
                  role="radiogroup"
                  aria-label="Proporção e formato da imagem"
                  className="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
                >
                  {CUSTOMIZATION_OPTIONS.aspectRatios.map((opt) => {
                    const selected = aspectRatio === opt.id;
                    const ratioUi = ASPECT_RATIO_UI[opt.id] || {
                      shortName: opt.label,
                      frameClass: 'w-4 h-4',
                    };
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setAspectRatio(opt.id)}
                        className={`min-h-[68px] flex flex-col items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-center transition-all ${
                          selected
                            ? 'border-violet-600 bg-violet-50 text-violet-950 shadow-sm dark:border-[#8B5CF6] dark:bg-[#7C3AED]/20 dark:text-white'
                            : 'border-slate-300 bg-slate-50 text-slate-700 hover:border-slate-400 hover:bg-slate-100 dark:border-white/12 dark:bg-[#0D0D14] dark:text-[#A1A1AA] dark:hover:border-white/25 dark:hover:bg-white/10 dark:hover:text-white'
                        }`}
                      >
                        <span className="flex h-6 items-center justify-center" aria-hidden="true">
                          <span
                            className={`rounded-[3px] border-2 ${ratioUi.frameClass} ${
                              selected
                                ? 'border-violet-600 bg-violet-200/60 dark:border-[#C4B5FD] dark:bg-[#8B5CF6]/30'
                                : 'border-slate-400 dark:border-white/35'
                            }`}
                          />
                        </span>
                        <span className="text-xs font-bold font-mono-num leading-none">
                          {opt.id}
                        </span>
                        <span className="text-[11px] leading-none opacity-90">
                          {ratioUi.shortName}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>

          {/* Right Confirmation Panel */}
          <aside className="lg:col-span-5 lg:sticky lg:top-24 rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-5 sm:p-6 space-y-5 shadow-sm dark:shadow-none">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-950 dark:text-white">
                Resumo antes de confirmar
              </h2>
              <p className="mt-1 text-xs text-slate-600 dark:text-[#A1A1AA]">
                Confira o cenário, o formato e o custo exato em créditos. Se houver falha, nada é cobrado.
              </p>
            </div>

            {/* Readiness Indicators */}
            <div className="grid grid-cols-2 gap-2.5">
              <div
                className={`rounded-xl border px-3 py-2.5 text-xs ${
                  hasFaces
                    ? 'border-emerald-600/35 bg-emerald-50 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-950/25 dark:text-emerald-200'
                    : 'border-amber-600/40 bg-amber-50 text-amber-950 dark:border-amber-500/35 dark:bg-amber-950/25 dark:text-amber-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  {hasFaces ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span>Perfil Visual</span>
                </div>
                <p className="mt-0.5 text-[11px] opacity-90">
                  {loadingProfile
                    ? 'Verificando...'
                    : hasFaces
                    ? `${faces.length} ${faces.length === 1 ? 'rosto salvo' : 'rostos salvos'}`
                    : 'Envie 1 foto'}
                </p>
              </div>

              <div
                className={`rounded-xl border px-3 py-2.5 text-xs ${
                  hasEnoughCredits
                    ? 'border-emerald-600/35 bg-emerald-50 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-950/25 dark:text-emerald-200'
                    : 'border-amber-600/40 bg-amber-50 text-amber-950 dark:border-amber-500/35 dark:bg-amber-950/25 dark:text-amber-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  {hasEnoughCredits ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  ) : (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  )}
                  <span>Créditos</span>
                </div>
                <p className="mt-0.5 text-[11px] opacity-90 font-mono-num">
                  {hasEnoughCredits
                    ? `${user?.credits ?? 0} disponíveis`
                    : `Mínimo ${generationCost}`}
                </p>
              </div>
            </div>

            {/* Active Selection Preview */}
            {mode === 'preset' && selectedScenario ? (
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-[#0D0D14] p-3">
                <ImageWithFallback
                  src={selectedScenario.image}
                  alt={selectedScenario.title}
                  className="w-12 h-14 rounded-lg object-cover shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-600 dark:text-[#A1A1AA] truncate">
                    {selectedScenario.categoryName}
                  </p>
                  <p className="text-xs font-semibold text-slate-950 dark:text-white truncate">
                    {selectedScenario.title}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-[#0D0D14] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-700 dark:text-[#A855F7]">
                  Criação Livre
                </p>
                <p className="mt-1 text-xs text-slate-700 dark:text-[#A1A1AA] line-clamp-2">
                  {freePrompt.trim() || 'Aguardando sua descrição da cena...'}
                </p>
              </div>
            )}

            <dl className="space-y-2.5 text-sm border-y border-slate-200 dark:border-white/10 py-4">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-600 dark:text-[#A1A1AA]">Modo</dt>
                <dd className="text-slate-950 dark:text-white font-medium">
                  {mode === 'preset' ? 'Criação Pronta' : 'Criação Livre'}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-600 dark:text-[#A1A1AA]">Formato</dt>
                <dd className="text-slate-950 dark:text-white font-mono-num">
                  {selectedRatioMeta.label}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-600 dark:text-[#A1A1AA] shrink-0">Iluminação</dt>
                <dd className="text-slate-950 dark:text-white text-xs text-right truncate max-w-[210px]">
                  {lighting}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-600 dark:text-[#A1A1AA]">Modelo de IA</dt>
                <dd className="text-right">
                  <span className="text-slate-950 dark:text-white font-medium">
                    {getPreferredAiModelOption(effectiveGenerationModel.model).shortLabel}
                  </span>{' '}
                  <Link
                    to="/perfil-visual"
                    className="text-xs text-violet-700 dark:text-[#A855F7] underline ml-1"
                  >
                    Alterar
                  </Link>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/80 dark:border-white/10">
                <dt className="text-slate-600 dark:text-[#A1A1AA]">Custo da geração</dt>
                <dd className="text-slate-950 dark:text-white font-semibold font-mono-num">
                  {generationCost} créditos
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-600 dark:text-[#A1A1AA]">Seu saldo atual</dt>
                <dd className="text-violet-700 dark:text-[#8B5CF6] font-semibold font-mono-num">
                  {user?.credits ?? 0} créditos
                </dd>
              </div>
              {falQuota?.active && (
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-slate-600 dark:text-[#A1A1AA]">Proteção gratuita fal.ai</dt>
                  <dd
                    data-testid="create-fal-quota"
                    className={`font-semibold font-mono-num ${
                      falQuota.exhausted
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    {falQuota.remaining} de {falQuota.limit} restantes
                  </dd>
                </div>
              )}
            </dl>

            {falBlocked && (
              <div
                role="alert"
                className="rounded-xl bg-amber-50 border border-amber-600/45 text-amber-950 dark:bg-amber-950/35 dark:border-amber-500/40 px-4 py-3 text-xs dark:text-amber-200"
              >
                Limite de proteção atingido: as {falQuota?.limit ?? 12} imagens gratuitas da fal.ai já foram usadas para evitar qualquer cobrança.
              </div>
            )}

            {errorMsg && (
              <div
                role="alert"
                className="rounded-xl bg-red-50 border border-red-600/45 text-red-950 dark:bg-red-950/40 dark:border-red-500/40 px-4 py-3 text-xs dark:text-red-200"
              >
                {errorMsg}
              </div>
            )}

            <button
              type="button"
              data-tour="generate"
              disabled={!hasFaces || !hasEnoughCredits || falBlocked || generating}
              onClick={() => runGeneration(false)}
              className="w-full inline-flex items-center justify-center gap-2 py-4 px-5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white shadow-lg shadow-[#7C3AED]/25 hover:brightness-110 disabled:opacity-45 disabled:cursor-not-allowed transition-all"
            >
              {generating && <ButtonSpinner size="md" />}
              <span>
                {generating
                  ? 'Gerando fotografia...'
                  : falBlocked
                  ? `Limite gratuito (${falQuota?.limit ?? 12}) atingido`
                  : `Confirmar e gerar foto (${generationCost} créditos)`}
              </span>
            </button>

            <div className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-[#A1A1AA] leading-relaxed">
              <ShieldCheck
                className="w-4 h-4 shrink-0 text-slate-500 dark:text-[#A1A1AA] mt-0.5"
                aria-hidden="true"
              />
              <p>
                Toda imagem gerada recebe marcação &quot;Foto gerada por IA&quot; e marca d’água invisível SynthID quando suportado. Uso permitido apenas com seu próprio rosto.
              </p>
            </div>
          </aside>
        </div>
      )}

      {/* Mobile: barra inferior fixa com custo e confirmação (só abaixo de lg) */}
      {!generating && !betaWaitlistMode && (
        <div className="fixed bottom-0 inset-x-0 z-40 lg:hidden border-t border-slate-200 bg-white/95 dark:border-white/10 dark:bg-[#12121A]/95 backdrop-blur px-4 py-3">
          <div className="mx-auto max-w-6xl flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-slate-600 dark:text-[#A1A1AA]">Custo da geração</p>
              <p className="text-sm font-semibold text-slate-950 dark:text-white font-mono-num truncate">
                {generationCost} créditos · Saldo {user?.credits ?? 0}
              </p>
            </div>
            <button
              type="button"
              disabled={!hasFaces || !hasEnoughCredits || falBlocked || generating}
              onClick={() => runGeneration(false)}
              className="shrink-0 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-[11px] font-semibold uppercase tracking-wider text-white shadow-lg shadow-[#7C3AED]/25 hover:brightness-110 disabled:opacity-45 disabled:cursor-not-allowed transition-all"
            >
              {generating && <ButtonSpinner size="sm" />}
              <span>
                {generating
                  ? 'Gerando fotografia...'
                  : falBlocked
                  ? `Limite gratuito (${falQuota?.limit ?? 12}) atingido`
                  : `Confirmar e gerar foto (${generationCost} créditos)`}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Modal: escolher cenário vendo as fotos */}
      {scenarioPickerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Escolher cenário vendo as fotos"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center sm:justify-center"
          onClick={() => setScenarioPickerOpen(false)}
        >
          <div
            className="w-full sm:max-w-2xl max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#12121A] border border-slate-300 dark:border-white/15 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-4 pb-3 border-b border-slate-200 dark:border-white/10 space-y-3 shrink-0">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-bold text-slate-950 dark:text-white">
                    Escolher vendo as fotos
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-[#A1A1AA]">
                    {pickerScenarios.length}{' '}
                    {pickerScenarios.length === 1 ? 'cenário' : 'cenários'}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Fechar escolha de cenário"
                  onClick={() => setScenarioPickerOpen(false)}
                  className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-600 hover:text-slate-950 hover:bg-slate-100 dark:text-[#A1A1AA] dark:hover:text-white dark:hover:bg-white/5"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
              <div className="relative">
                <Search
                  className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-[#A1A1AA] pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={scenarioPickerQuery}
                  onChange={(e) => setScenarioPickerQuery(e.target.value)}
                  placeholder="Buscar cenário (ex.: Dubai, CEO, Paris)"
                  aria-label="Buscar cenário"
                  className="w-full min-h-[44px] pl-10 pr-9 py-2.5 rounded-xl bg-white border border-slate-300 text-sm text-slate-950 placeholder:text-slate-500 dark:bg-[#17171F] dark:border-white/15 dark:text-white dark:placeholder:text-[#A1A1AA]/70 focus:outline-none focus:border-[#8B5CF6]"
                />
                {scenarioPickerQuery && (
                  <button
                    type="button"
                    onClick={() => setScenarioPickerQuery('')}
                    aria-label="Limpar busca"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-600 hover:text-slate-950 dark:text-[#A1A1AA] dark:hover:text-white"
                  >
                    <X className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto px-4 sm:px-5 py-4">
              {pickerScenarios.length === 0 ? (
                <p className="text-sm text-slate-600 dark:text-[#A1A1AA] text-center py-8">
                  Nenhum cenário encontrado para &ldquo;{scenarioPickerQuery.trim()}&rdquo;.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {pickerScenarios.map((s) => {
                    const active = s.id === selectedScenarioId;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSelectedScenarioId(s.id);
                          setScenarioPickerOpen(false);
                        }}
                        aria-pressed={active}
                        className={`text-left rounded-2xl border overflow-hidden transition-colors ${
                          active
                            ? 'border-violet-600 ring-2 ring-violet-600/40 dark:border-[#8B5CF6]'
                            : 'border-slate-300 dark:border-white/10 hover:border-violet-500 dark:hover:border-[#8B5CF6]/60'
                        }`}
                      >
                        <span className="relative block aspect-[4/3] overflow-hidden bg-slate-900">
                          <ImageWithFallback
                            src={getMediaUrl(s.image)}
                            alt={s.title}
                            className="w-full h-full object-cover object-top"
                          />
                          {active && (
                            <span className="absolute top-2 right-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#7C3AED] text-white">
                              <Check className="w-3.5 h-3.5" aria-hidden="true" />
                            </span>
                          )}
                        </span>
                        <span className="block p-3">
                          <span className="block text-[11px] text-slate-600 dark:text-[#A1A1AA] truncate">
                            {s.categoryName}
                          </span>
                          <span className="block text-xs font-semibold text-slate-950 dark:text-white line-clamp-2">
                            {s.title}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
