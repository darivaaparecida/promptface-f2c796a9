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
import { useAuth } from '../context/AuthContext';
import { ImageWithFallback } from '../components/ImageWithFallback';

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
  const { user, config, apiFetch, updateCredits, getMediaUrl } = useAuth();
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

  useEffect(() => {
    fetch('/api/catalog')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.scenarios) && data.scenarios.length > 0) {
          setScenarios(data.scenarios);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    apiFetch('/api/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.faces)) {
          setFaces(data.faces);
        }
      })
      .finally(() => setLoadingProfile(false));
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
    setEnhancing(true);
    try {
      const res = await apiFetch('/api/enhance-prompt', {
        method: 'POST',
        body: JSON.stringify({ description: freePrompt }),
      });
      const data = (await res.json()) as {
        enhancedPrompt?: string;
        credits?: number;
        notConfigured?: boolean;
        error?: string;
      };
      if (typeof data.credits === 'number') updateCredits(data.credits);

      if (!res.ok) {
        if (data.notConfigured) {
          setBetaWaitlistMode(true);
        }
        setErrorMsg(data.error || 'Não foi possível melhorar a descrição agora.');
        return;
      }
      if (data.enhancedPrompt) {
        setEnhancedDraft(data.enhancedPrompt);
      }
    } finally {
      setEnhancing(false);
    }
  };

  const runGeneration = async (isVariation = false) => {
    setErrorMsg(null);
    setBetaWaitlistMode(false);
    setGenerating(true);
    setLoadingMsgIdx(0);

    try {
      const payload =
        mode === 'free'
          ? {
              mode: 'free',
              description: enhancedDraft ?? freePrompt,
              outfit,
              environment,
              pose,
              lighting,
              style,
              aspectRatio,
              isVariation,
            }
          : {
              mode: 'preset',
              scenarioId: selectedScenario?.id,
              description: selectedScenario?.description,
              outfit,
              environment,
              pose,
              lighting,
              style,
              aspectRatio,
              isVariation,
            };

      const res = await apiFetch('/api/generate', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        generation?: GeneratedResult;
        credits?: number;
        notConfigured?: boolean;
        error?: string;
      };

      if (typeof data.credits === 'number') {
        updateCredits(data.credits);
      }

      if (!res.ok) {
        if (data.notConfigured) {
          setBetaWaitlistMode(true);
        } else {
          setErrorMsg(data.error || 'Não foi possível gerar sua foto.');
        }
        return;
      }

      if (data.generation) {
        setResult(data.generation);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!result) return;
    const res = await apiFetch(`/api/generations/${result.id}/favorite`, {
      method: 'PATCH',
    });
    if (res.ok) {
      const data = (await res.json()) as { favorite: boolean };
      setResult((prev) => (prev ? { ...prev, favorite: data.favorite } : prev));
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
    const res = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: waitlistEmail, feature: 'generation' }),
    });
    const data = (await res.json()) as { message?: string; error?: string };
    setWaitlistFeedback(data.message || data.error || null);
  };

  const hasFaces = faces.length > 0;
  const hasEnoughCredits = (user?.credits ?? 0) >= CREDIT_COSTS.generate;

  // RESULT SCREEN
  if (result) {
    return (
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-10 sm:py-14 space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setResult(null)}
            className="inline-flex items-center gap-2 text-sm text-[#A1A1AA] hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Voltar para a criação
          </button>

          <p className="text-xs text-[#A1A1AA] font-mono-num">
            Créditos restantes: <strong className="text-white">{user?.credits ?? 0}</strong>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-[#17171F] overflow-hidden">
            <div className="relative">
              <ImageWithFallback
                src={getMediaUrl(result.url)}
                alt={result.scenarioTitle}
                className="w-full h-auto object-cover"
              />
              <div className="absolute bottom-3 left-3 text-xs text-white bg-[#08080C]/80 backdrop-blur-sm px-2.5 py-1 rounded-md border border-white/15">
                Foto gerada por IA {result.synthIdMarked ? '· SynthID' : ''}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-[#17171F] p-6 space-y-6">
            <div>
              <p className="text-xs text-[#A1A1AA]">{result.categoryName}</p>
              <h1 className="mt-1 font-display text-xl font-bold text-white">
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
                  onClick={() => {
                    setResult(null);
                    void runGeneration(false);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#7C3AED] text-xs font-medium text-white hover:bg-[#7C3AED]/15"
                >
                  <RefreshCw className="w-4 h-4" aria-hidden="true" />
                  Gerar novamente
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    void runGeneration(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#7C3AED] text-xs font-medium text-white hover:bg-[#7C3AED]/15"
                >
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                  Criar variações
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={handleToggleFavorite}
                  className={`inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-xs font-medium transition-colors ${
                    result.favorite
                      ? 'border-[#EC4899] bg-[#EC4899]/15 text-white'
                      : 'border-white/15 text-white hover:bg-white/5'
                  }`}
                >
                  <Heart
                    className={`w-4 h-4 ${result.favorite ? 'fill-[#EC4899] text-[#EC4899]' : ''}`}
                    aria-hidden="true"
                  />
                  {result.favorite ? 'Favoritada' : 'Favoritos'}
                </button>

                <Link
                  to={`/studio?foto=${result.id}`}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/15 text-xs font-medium text-white hover:bg-white/5"
                >
                  <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
                  Editar no Studio
                </Link>
              </div>

              <button
                type="button"
                onClick={handleShare}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-white/15 text-xs font-medium text-white hover:bg-white/5"
              >
                {copiedNotice ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" aria-hidden="true" />
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
          <p className="text-xs font-medium uppercase tracking-wider text-[#8B5CF6]">
            Estúdio de geração
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-white">
            Criar nova fotografia
          </h1>
        </div>

        <div className="text-sm text-[#A1A1AA] font-mono-num">
          Seu saldo: <strong className="text-white">{user?.credits ?? 0} créditos</strong>
        </div>
      </div>

      {/* MANDATORY FLOW RULE: Visual Profile state shown AT THE TOP BEFORE generate button */}
      {!loadingProfile && !hasFaces ? (
        <div
          role="region"
          aria-label="Status do Perfil Visual"
          className="rounded-2xl border border-[#7C3AED] bg-[#17171F] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="space-y-1">
            <h2 className="font-display text-base font-semibold text-white">
              Você ainda não enviou seu rosto — enviar agora
            </h2>
            <p className="text-sm text-[#A1A1AA]">
              Para gerar fotografias preservando sua identidade facial, envie pelo menos 1 foto do seu rosto no Perfil Visual.
            </p>
          </div>
          <Link
            to="/perfil-visual"
            className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white whitespace-nowrap shrink-0"
          >
            Enviar meu rosto agora
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-[#17171F] px-5 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <UserCheck className="w-5 h-5 text-[#8B5CF6] shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-white">
                Perfil Visual ativo ({faces.length} {faces.length === 1 ? 'foto de referência' : 'fotos de referência'})
              </p>
              <p className="text-xs text-[#A1A1AA]">
                Suas referências privadas serão usadas para preservar seu rosto nesta criação.
              </p>
            </div>
          </div>
          <Link
            to="/perfil-visual"
            className="text-xs font-medium text-[#8B5CF6] hover:underline whitespace-nowrap"
          >
            Gerenciar Perfil Visual
          </Link>
        </div>
      )}

      {/* Low credits warning */}
      {!hasEnoughCredits && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-950/25 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-white">
                Saldo baixo para novas gerações
              </p>
              <p className="text-xs text-[#A1A1AA]">
                Você possui {user?.credits ?? 0} créditos. Cada foto gerada custa {CREDIT_COSTS.generate} créditos.
              </p>
            </div>
          </div>
          <Link
            to="/planos"
            className="px-4 py-2.5 rounded-xl border border-[#7C3AED] text-xs font-semibold uppercase tracking-wider text-white whitespace-nowrap shrink-0 hover:bg-[#7C3AED]/15"
          >
            Ver planos
          </Link>
        </div>
      )}

      {/* Mode Selector */}
      <div className="inline-flex p-1 rounded-xl bg-[#17171F] border border-white/10">
        <button
          type="button"
          onClick={() => handleModeSwitch('preset')}
          className={`px-5 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
            mode === 'preset' ? 'bg-[#7C3AED] text-white' : 'text-[#A1A1AA] hover:text-white'
          }`}
        >
          Modo 1 · Criação Pronta
        </button>
        <button
          type="button"
          onClick={() => handleModeSwitch('free')}
          className={`px-5 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
            mode === 'free' ? 'bg-[#7C3AED] text-white' : 'text-[#A1A1AA] hover:text-white'
          }`}
        >
          Modo 2 · Criação Livre
        </button>
      </div>

      {/* Loading Animation State */}
      {generating ? (
        <div className="rounded-2xl border border-[#7C3AED]/50 bg-[#17171F] p-10 sm:p-14 text-center space-y-6">
          <div className="mx-auto max-w-sm aspect-[3/4] rounded-2xl skeleton-violet border border-white/10" />
          <div className="space-y-2">
            <p className="font-display text-lg font-semibold text-white">
              {LOADING_MESSAGES[loadingMsgIdx]}
            </p>
            <p className="text-xs text-[#A1A1AA]">
              Estamos combinando suas referências faciais com iluminação e textura fotográfica realista.
            </p>
          </div>
        </div>
      ) : betaWaitlistMode ? (
        // Activates cleanly when generation service is unconfigured or awaiting paid activation (no technical error leaked)
        <div className="rounded-2xl border border-[#7C3AED]/40 bg-[#17171F] p-8 space-y-5">
          <p className="text-xs font-medium uppercase tracking-wider text-[#8B5CF6]">
            Beta fechado
          </p>
          <h2 className="font-display text-2xl font-bold text-white">
            Geração em breve — estamos ativando
          </h2>
          <p className="text-sm text-[#A1A1AA] max-w-xl">
            Nenhum crédito foi descontado da sua conta. Nossa infraestrutura de geração está em fase final de ativação — entre na lista de espera prioritária para receber acesso imediato na liberação.
          </p>
          <form onSubmit={handleBetaWaitlist} className="flex flex-col sm:flex-row gap-3 max-w-md">
            <input
              type="email"
              required
              value={waitlistEmail}
              onChange={(e) => setWaitlistEmail(e.target.value)}
              placeholder="seu@email.com"
              className="flex-1 px-4 py-3 rounded-xl bg-[#08080C] border border-white/15 text-sm text-white"
            />
            <button
              type="submit"
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white"
            >
              Entrar na lista
            </button>
          </form>
          {waitlistFeedback && <p className="text-xs text-[#8B5CF6]">{waitlistFeedback}</p>}
          <button
            type="button"
            onClick={() => setBetaWaitlistMode(false)}
            className="text-xs text-[#A1A1AA] hover:text-white underline"
          >
            Voltar para configuração do cenário
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Form */}
          <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-[#17171F] p-6 space-y-6">
            {mode === 'preset' ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="select-scenario" className="block text-xs font-medium text-[#A1A1AA]">
                    Cenário selecionado (84 opções em 14 categorias)
                  </label>
                  <select
                    id="select-scenario"
                    value={selectedScenarioId}
                    onChange={(e) => setSelectedScenarioId(e.target.value)}
                    className="w-full px-3.5 py-3 rounded-xl bg-[#08080C] border border-white/15 text-sm text-white focus:outline-none focus:border-[#8B5CF6]"
                  >
                    {scenarios.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.categoryName} — {s.title}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedScenario && (
                  <div className="flex items-center gap-4 p-3 rounded-xl bg-[#08080C] border border-white/10">
                    <ImageWithFallback
                      src={selectedScenario.image}
                      alt={selectedScenario.title}
                      className="w-16 h-20 rounded-lg object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs text-[#A1A1AA]">{selectedScenario.categoryName}</p>
                      <p className="text-sm font-medium text-white truncate">
                        {selectedScenario.title}
                      </p>
                      <p className="text-xs text-[#A1A1AA] line-clamp-2 mt-0.5">
                        {selectedScenario.description}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <label htmlFor="free-prompt" className="block text-xs font-medium text-[#A1A1AA]">
                  Descreva exatamente onde quer estar e como quer aparecer
                </label>
                <textarea
                  id="free-prompt"
                  rows={5}
                  value={freePrompt}
                  onChange={(e) => setFreePrompt(e.target.value)}
                  placeholder="Quero estar em Dubai, encostado em uma Lamborghini preta, usando uma roupa social elegante, durante o pôr do sol, com fotografia profissional realista."
                  className="w-full px-4 py-3 rounded-xl bg-[#08080C] border border-white/15 text-sm text-white placeholder:text-[#A1A1AA]/55 focus:outline-none focus:border-[#8B5CF6]"
                />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={enhancing}
                    onClick={handleEnhanceDescription}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#7C3AED] text-xs font-semibold text-white hover:bg-[#7C3AED]/15 disabled:opacity-50"
                  >
                    <Wand2 className="w-4 h-4 text-[#8B5CF6]" aria-hidden="true" />
                    {enhancing
                      ? 'Melhorando...'
                      : `Melhorar minha descrição (${CREDIT_COSTS.enhance_prompt} crédito)`}
                  </button>
                  <span className="text-xs text-[#A1A1AA]">
                    Reescreve com detalhes fotográficos para você aprovar antes de gerar.
                  </span>
                </div>

                {enhancedDraft !== null && (
                  <div className="rounded-xl border border-[#7C3AED]/50 bg-[#08080C] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[#8B5CF6]">
                        Descrição melhorada (edite ou aprove abaixo)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setFreePrompt(enhancedDraft);
                          setEnhancedDraft(null);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-medium text-white hover:text-[#8B5CF6]"
                      >
                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                        Aplicar no campo principal
                      </button>
                    </div>
                    <textarea
                      rows={4}
                      value={enhancedDraft}
                      onChange={(e) => setEnhancedDraft(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[#17171F] border border-white/10 text-xs text-white"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Personalização completa */}
            <div className="pt-4 border-t border-white/10 space-y-4">
              <h2 className="font-display text-sm font-semibold text-white">
                Personalização completa
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="custom-outfit" className="block text-xs text-[#A1A1AA]">
                    Roupa
                  </label>
                  <input
                    id="custom-outfit"
                    type="text"
                    value={outfit}
                    onChange={(e) => setOutfit(e.target.value)}
                    placeholder="Ex.: Terno preto elegante ou jaqueta de couro"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080C] border border-white/15 text-sm text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="custom-env" className="block text-xs text-[#A1A1AA]">
                    Ambiente
                  </label>
                  <input
                    id="custom-env"
                    type="text"
                    value={environment}
                    onChange={(e) => setEnvironment(e.target.value)}
                    placeholder="Ex.: Avenida iluminada em Paris"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080C] border border-white/15 text-sm text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="custom-pose" className="block text-xs text-[#A1A1AA]">
                    Pose
                  </label>
                  <input
                    id="custom-pose"
                    type="text"
                    value={pose}
                    onChange={(e) => setPose(e.target.value)}
                    placeholder="Ex.: Olhando para a câmera com sorriso natural"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080C] border border-white/15 text-sm text-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="custom-lighting" className="block text-xs text-[#A1A1AA]">
                    Iluminação
                  </label>
                  <select
                    id="custom-lighting"
                    value={lighting}
                    onChange={(e) => setLighting(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080C] border border-white/15 text-sm text-white"
                  >
                    {CUSTOMIZATION_OPTIONS.lighting.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="custom-style" className="block text-xs text-[#A1A1AA]">
                    Estilo da foto
                  </label>
                  <select
                    id="custom-style"
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080C] border border-white/15 text-sm text-white"
                  >
                    {CUSTOMIZATION_OPTIONS.styles.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="custom-ratio" className="block text-xs text-[#A1A1AA]">
                    Proporção / formato
                  </label>
                  <select
                    id="custom-ratio"
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#08080C] border border-white/15 text-sm text-white"
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
          <aside className="lg:col-span-5 rounded-2xl border border-white/10 bg-[#17171F] p-6 space-y-6">
            <div>
              <h2 className="font-display text-lg font-semibold text-white">
                Resumo antes de confirmar
              </h2>
              <p className="mt-1 text-xs text-[#A1A1AA]">
                Você vê o custo exato em créditos antes de iniciar a geração. Se houver falha, o estorno é automático.
              </p>
            </div>

            <dl className="space-y-3 text-sm border-y border-white/10 py-4">
              <div className="flex items-center justify-between">
                <dt className="text-[#A1A1AA]">Modo</dt>
                <dd className="text-white font-medium">
                  {mode === 'preset' ? 'Criação Pronta' : 'Criação Livre'}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#A1A1AA]">Formato</dt>
                <dd className="text-white font-mono-num">{aspectRatio}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#A1A1AA]">Custo da geração</dt>
                <dd className="text-white font-semibold font-mono-num">
                  {CREDIT_COSTS.generate} créditos
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#A1A1AA]">Seu saldo atual</dt>
                <dd className="text-[#8B5CF6] font-semibold font-mono-num">
                  {user?.credits ?? 0} créditos
                </dd>
              </div>
            </dl>

            {errorMsg && (
              <div
                role="alert"
                className="rounded-xl bg-red-950/40 border border-red-500/40 px-4 py-3 text-xs text-red-200"
              >
                {errorMsg}
              </div>
            )}

            <button
              type="button"
              disabled={!hasFaces || !hasEnoughCredits || generating}
              onClick={() => runGeneration(false)}
              className="w-full py-4 px-5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white shadow-lg shadow-[#7C3AED]/25 hover:brightness-110 disabled:opacity-45 disabled:cursor-not-allowed transition-all"
            >
              Confirmar e gerar foto ({CREDIT_COSTS.generate} créditos)
            </button>

            <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
              Toda imagem gerada recebe marcação "Foto gerada por IA" e marca d’água invisível SynthID quando suportado. Uso permitido apenas com seu próprio rosto.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
