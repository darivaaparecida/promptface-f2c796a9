import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Copy,
  Download,
  Heart,
  RefreshCw,
  Share2,
  SlidersHorizontal,
  Sparkles,
  UserCheck,
  Wand2,
} from 'lucide-react';
import {
  CUSTOMIZATION_OPTIONS,
  INITIAL_SCENARIOS,
  type ScenarioItem,
} from '../shared/catalog';
import { CREDIT_COSTS } from '../shared/rules';
import {
  getPreferredAiModelOption,
  normalizePreferredAiModel,
  type PreferredAiModelId,
} from '../shared/aiModels';
import { useAuth } from '../context/AuthContext';
import { getVisualProfile, joinWaitlist, listFaces, toggleFavorite } from '../lib/db';
import { useToast } from '../context/ToastContext';
import { resolveProfileAvatarDisplay } from '../shared/defaultAvatars';
import { ButtonSpinner } from '../components/ButtonSpinner';
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

export function CreatePage() {
  const { user, config, updateCredits, refreshConfig, getMediaUrl } = useAuth();
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialPromptParam = searchParams.get('prompt') || '';
  const initialMode =
    searchParams.get('modo') === 'livre' || (initialPromptParam && !searchParams.get('cenario'))
      ? 'free'
      : 'preset';
  const initialScenarioId = searchParams.get('cenario') || INITIAL_SCENARIOS[0].id;

  const [mode, setMode] = useState<'preset' | 'free'>(initialMode);
  const [scenarios, setScenarios] = useState<ScenarioItem[]>(INITIAL_SCENARIOS);
  const [selectedScenarioId, setSelectedScenarioId] = useState(initialScenarioId);

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
  const [enhancing, setEnhancing] = useState(false);

  // Generation flow
  const [generating, setGenerating] = useState(false);
  const [togglingFavorite, setTogglingFavorite] = useState(false);
  const [submittingWaitlist, setSubmittingWaitlist] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [betaWaitlistMode, setBetaWaitlistMode] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState(user?.email || '');
  const [waitlistFeedback, setWaitlistFeedback] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [copiedNotice, setCopiedNotice] = useState(false);

  const selectedScenario = useMemo(
    () => scenarios.find((s) => s.id === selectedScenarioId) || scenarios[0],
    [scenarios, selectedScenarioId]
  );

  // O catálogo (cenários) vem do código (src/shared/catalog.ts) — o estado
  // já nasce com INITIAL_SCENARIOS e não há busca no servidor nesta fase.

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
  const hasEnoughCredits = (user?.credits ?? 0) >= CREDIT_COSTS.generate;
  const falQuota = config.falQuota;
  const falBlocked = Boolean(falQuota?.active && falQuota.exhausted);
  const avatarDisplay = resolveProfileAvatarDisplay({
    faces,
    seed: user?.id || user?.email,
    getMediaUrl,
  });

  // RESULT SCREEN
  if (result) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-14 space-y-8">
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
            Créditos restantes: <strong className="text-slate-950 dark:text-white">{user?.credits ?? 0}</strong>
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
                      className={`w-4 h-4 ${result.favorite ? 'fill-[#EC4899] text-[#EC4899]' : ''}`}
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
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                    Link copiado para compartilhar
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4" aria-hidden="true" />
                    Compartilhar
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
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-14 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-[#8B5CF6]">
            Estúdio de geração
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-slate-950 dark:text-white">
            Criar nova fotografia
          </h1>
        </div>

        <div className="text-sm text-slate-700 dark:text-[#A1A1AA] font-mono-num">
          Seu saldo: <strong className="text-slate-950 dark:text-white">{user?.credits ?? 0} créditos</strong>
        </div>
      </div>

      {/* MANDATORY FLOW RULE: Visual Profile state shown AT THE TOP BEFORE generate button */}
      {!loadingProfile && !hasFaces ? (
        <div
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
            className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white whitespace-nowrap shrink-0"
          >
            Enviar meu rosto agora
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] px-5 py-4 flex flex-wrap items-center justify-between gap-4 shadow-sm dark:shadow-none">
          <div className="flex items-center gap-3.5">
            <ProfileAvatar
              faces={faces}
              seed={user?.id || user?.email}
              getMediaUrl={getMediaUrl}
              size="sm"
            />
            <div>
              <p className="text-sm font-medium text-slate-950 dark:text-white flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-violet-700 dark:text-[#8B5CF6] shrink-0" aria-hidden="true" />
                <span>
                  Perfil Visual ativo ({faces.length} {faces.length === 1 ? 'foto de referência' : 'fotos de referência'})
                </span>
              </p>
              <p className="text-xs text-slate-700 dark:text-[#A1A1AA]">
                Suas referências privadas serão usadas para preservar seu rosto nesta criação.
              </p>
            </div>
          </div>
          <Link
            to="/perfil-visual"
            className="text-xs font-semibold text-violet-700 dark:text-[#8B5CF6] hover:underline whitespace-nowrap"
          >
            Gerenciar Perfil Visual
          </Link>
        </div>
      )}

      {/* Low credits warning */}
      {!hasEnoughCredits && (
        <div className="rounded-2xl border border-amber-600/45 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-950/25 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-amber-950 dark:text-white">
                Saldo baixo para novas gerações
              </p>
              <p className="text-xs text-amber-900 dark:text-[#A1A1AA]">
                Você possui {user?.credits ?? 0} créditos. Cada foto gerada custa {CREDIT_COSTS.generate} créditos.
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

      {/* Mode Selector */}
      <div className="inline-flex p-1 rounded-xl bg-slate-200 border border-slate-300 dark:bg-[#17171F] dark:border-white/10">
        <button
          type="button"
          onClick={() => handleModeSwitch('preset')}
          className={`px-5 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
            mode === 'preset'
              ? 'bg-[#7C3AED] text-white'
              : 'text-slate-700 hover:text-slate-950 dark:text-[#A1A1AA] dark:hover:text-white'
          }`}
        >
          Modo 1 · Criação Pronta
        </button>
        <button
          type="button"
          onClick={() => handleModeSwitch('free')}
          className={`px-5 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
            mode === 'free'
              ? 'bg-[#7C3AED] text-white'
              : 'text-slate-700 hover:text-slate-950 dark:text-[#A1A1AA] dark:hover:text-white'
          }`}
        >
          Modo 2 · Criação Livre
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
          {waitlistFeedback && <p className="text-xs text-violet-700 dark:text-[#8B5CF6]">{waitlistFeedback}</p>}
          <button
            type="button"
            onClick={() => setBetaWaitlistMode(false)}
            className="text-xs text-slate-700 hover:text-slate-950 dark:text-[#A1A1AA] dark:hover:text-white underline"
          >
            Voltar para configuração do cenário
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Form */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-6 space-y-6 shadow-sm dark:shadow-none">
            {mode === 'preset' ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="select-scenario" className="block text-xs font-medium text-slate-700 dark:text-[#A1A1AA]">
                    Cenário selecionado (84 opções em 14 categorias)
                  </label>
                  <select
                    id="select-scenario"
                    value={selectedScenarioId}
                    onChange={(e) => setSelectedScenarioId(e.target.value)}
                    className="w-full px-3.5 py-3 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 focus:outline-none focus:border-violet-700 dark:bg-[#08080C] dark:border-white/15 dark:text-white dark:focus:border-[#8B5CF6]"
                  >
                    {scenarios.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.categoryName} — {s.title}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedScenario && (
                  <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 border border-slate-300 dark:bg-[#08080C] dark:border-white/10">
                    <ImageWithFallback
                      src={selectedScenario.image}
                      alt={selectedScenario.title}
                      className="w-16 h-20 rounded-lg object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs text-slate-700 dark:text-[#A1A1AA]">{selectedScenario.categoryName}</p>
                      <p className="text-sm font-semibold text-slate-950 dark:text-white truncate">
                        {selectedScenario.title}
                      </p>
                      <p className="text-xs text-slate-700 dark:text-[#A1A1AA] line-clamp-2 mt-0.5">
                        {selectedScenario.description}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <label htmlFor="free-prompt" className="block text-xs font-medium text-slate-700 dark:text-[#A1A1AA]">
                  Descreva exatamente onde quer estar e como quer aparecer
                </label>
                <textarea
                  id="free-prompt"
                  rows={5}
                  value={freePrompt}
                  onChange={(e) => setFreePrompt(e.target.value)}
                  placeholder="Quero estar em Dubai, encostado em uma Lamborghini preta, usando uma roupa social elegante, durante o pôr do sol, com fotografia profissional realista."
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 placeholder:text-slate-500 focus:outline-none focus:border-violet-700 dark:bg-[#08080C] dark:border-white/15 dark:text-white dark:placeholder:text-[#A1A1AA]/55 dark:focus:border-[#8B5CF6]"
                />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={enhancing}
                    onClick={handleEnhanceDescription}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-violet-700 text-xs font-semibold text-violet-950 hover:bg-violet-50 dark:border-[#7C3AED] dark:text-white dark:hover:bg-[#7C3AED]/15 disabled:opacity-50"
                  >
                    {enhancing ? (
                      <ButtonSpinner size="md" className="text-violet-700 dark:text-[#8B5CF6]" />
                    ) : (
                      <Wand2 className="w-4 h-4 text-violet-700 dark:text-[#8B5CF6]" aria-hidden="true" />
                    )}
                    <span>
                      {enhancing
                        ? 'Melhorando...'
                        : `Melhorar minha descrição (${CREDIT_COSTS.enhance_prompt} crédito)`}
                    </span>
                  </button>
                  <span className="text-xs text-slate-700 dark:text-[#A1A1AA]">
                    Reescreve com detalhes fotográficos para você aprovar antes de gerar.
                  </span>
                </div>

                {enhancedDraft !== null && (
                  <div className="rounded-xl border border-violet-500/50 bg-slate-50 dark:bg-[#08080C] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-violet-700 dark:text-[#8B5CF6]">
                        Descrição melhorada (edite ou aprove abaixo)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setFreePrompt(enhancedDraft);
                          setEnhancedDraft(null);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-slate-950 hover:text-violet-700 dark:text-white dark:hover:text-[#8B5CF6]"
                      >
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        Aplicar no campo principal
                      </button>
                    </div>
                    <textarea
                      rows={4}
                      value={enhancedDraft}
                      onChange={(e) => setEnhancedDraft(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-950 dark:bg-[#17171F] dark:border-white/10 dark:text-white"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Personalização completa */}
            <div className="pt-4 border-t border-slate-200 dark:border-white/10 space-y-4">
              <h2 className="font-display text-sm font-semibold text-slate-950 dark:text-white">
                Personalização completa
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="custom-outfit" className="block text-xs text-slate-700 dark:text-[#A1A1AA]">
                    Roupa
                  </label>
                  <input
                    id="custom-outfit"
                    type="text"
                    value={outfit}
                    onChange={(e) => setOutfit(e.target.value)}
                    placeholder="Ex.: Terno preto elegante ou jaqueta de couro"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="custom-env" className="block text-xs text-slate-700 dark:text-[#A1A1AA]">
                    Ambiente
                  </label>
                  <input
                    id="custom-env"
                    type="text"
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value)}
                    placeholder="Ex.: Avenida iluminada em Paris"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="custom-pose" className="block text-xs text-slate-700 dark:text-[#A1A1AA]">
                    Pose
                  </label>
                  <input
                    id="custom-pose"
                    type="text"
                    value={pose}
                    onChange={(e) => setPose(e.target.value)}
                    placeholder="Ex.: Olhando para a câmera com sorriso natural"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="custom-lighting" className="block text-xs text-slate-700 dark:text-[#A1A1AA]">
                    Iluminação
                  </label>
                  <select
                    id="custom-lighting"
                    value={lighting}
                    onChange={(e) => setLighting(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
                  >
                    {CUSTOMIZATION_OPTIONS.lighting.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="custom-style" className="block text-xs text-slate-700 dark:text-[#A1A1AA]">
                    Estilo da foto
                  </label>
                  <select
                    id="custom-style"
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
                  >
                    {CUSTOMIZATION_OPTIONS.styles.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="custom-ratio" className="block text-xs text-slate-700 dark:text-[#A1A1AA]">
                    Proporção / formato
                  </label>
                  <select
                    id="custom-ratio"
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm text-slate-950 dark:bg-[#08080C] dark:border-white/15 dark:text-white"
                  >
                    {CUSTOMIZATION_OPTIONS.aspectRatios.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Right Confirmation Panel */}
          <aside className="lg:col-span-5 rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-6 space-y-6 shadow-sm dark:shadow-none">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-950 dark:text-white">
                Resumo antes de confirmar
              </h2>
              <p className="mt-1 text-xs text-slate-700 dark:text-[#A1A1AA]">
                Você vê o custo exato em créditos antes de iniciar a geração. Se houver falha, o estorno é automático.
              </p>
            </div>

            <dl className="space-y-3 text-sm border-y border-slate-200 dark:border-white/10 py-4">
              <div className="flex items-center justify-between">
                <dt className="text-slate-700 dark:text-[#A1A1AA]">Modo</dt>
                <dd className="text-slate-950 dark:text-white font-medium">
                  {mode === 'preset' ? 'Criação Pronta' : 'Criação Livre'}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-700 dark:text-[#A1A1AA]">Formato</dt>
                <dd className="text-slate-950 dark:text-white font-mono-num">{aspectRatio}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-slate-700 dark:text-[#A1A1AA]">Modelo de IA</dt>
                <dd className="text-right">
                  <span className="text-slate-950 dark:text-white font-medium">
                    {getPreferredAiModelOption(preferredModel).shortLabel}
                  </span>{' '}
                  <Link
                    to="/perfil-visual"
                    className="text-xs text-violet-700 dark:text-[#A855F7] underline ml-1"
                  >
                    Alterar
                  </Link>
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-700 dark:text-[#A1A1AA]">Custo da geração</dt>
                <dd className="text-slate-950 dark:text-white font-semibold font-mono-num">
                  {CREDIT_COSTS.generate} créditos
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-700 dark:text-[#A1A1AA]">Seu saldo atual</dt>
                <dd className="text-violet-700 dark:text-[#8B5CF6] font-semibold font-mono-num">
                  {user?.credits ?? 0} créditos
                </dd>
              </div>
              {falQuota?.active && (
                <div className="flex items-center justify-between">
                  <dt className="text-slate-700 dark:text-[#A1A1AA]">Proteção gratuita fal.ai</dt>
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
                  : `Confirmar e gerar foto (${CREDIT_COSTS.generate} créditos)`}
              </span>
            </button>

            <p className="text-[11px] text-slate-700 dark:text-[#A1A1AA] leading-relaxed">
              Toda imagem gerada recebe marcação "Foto gerada por IA" e marca d’água invisível SynthID quando suportado. Uso permitido apenas com seu próprio rosto.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
