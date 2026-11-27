import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Camera, Check, HelpCircle, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const WELCOME_TOUR_SEEN_KEY = 'promptface_welcome_tour_seen';

interface WelcomeStep {
  id: 'perfil' | 'geracao' | 'estudio';
  route: string;
  routeLabel: string;
  selector: string;
  icon: typeof Camera;
  title: string;
  description: string;
}

const WELCOME_STEPS: WelcomeStep[] = [
  {
    id: 'perfil',
    route: '/perfil-visual',
    routeLabel: 'Abrir Perfil Visual',
    selector: '[data-welcome-tour="perfil"]',
    icon: Camera,
    title: '1. Configure seu Perfil Visual',
    description:
      'Envie 1 foto nítida do seu rosto e informe suas características para que a IA preserve sua identidade em qualquer foto.',
  },
  {
    id: 'geracao',
    route: '/criar',
    routeLabel: 'Ir para Geração',
    selector: '[data-welcome-tour="geracao"]',
    icon: Sparkles,
    title: '2. Gere suas fotografias',
    description:
      'Acesse Criar para escolher entre 84 cenários prontos ou descrever sua cena livre em segundos.',
  },
  {
    id: 'estudio',
    route: '/studio',
    routeLabel: 'Conhecer o Studio',
    selector: '[data-welcome-tour="estudio"]',
    icon: SlidersHorizontal,
    title: '3. Refine no PromptFace Studio',
    description:
      'Troque roupa, fundo, luz ou aplique ajustes finos nas suas fotos geradas sem perder o seu rosto.',
  },
];

/**
 * Tour de boas-vindas não-bloqueante para o fluxo principal (perfil → geração → estúdio).
 * Destaca o elemento correspondente com `.pf-tour-highlight` enquanto o usuário navega pela primeira vez.
 */
export function WelcomeTour() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!user) {
      setOpen(false);
      return;
    }
    try {
      if (!window.localStorage.getItem(WELCOME_TOUR_SEEN_KEY)) {
        setOpen(true);
      }
    } catch {
      // Sem localStorage disponível, mantém fechado.
    }
  }, [user]);

  // Sincroniza automaticamente o passo quando o usuário navega pelo fluxo principal
  useEffect(() => {
    if (!open) return;
    if (location.pathname === '/perfil-visual') {
      setStep(0);
    } else if (location.pathname === '/criar') {
      setStep(1);
    } else if (location.pathname === '/studio') {
      setStep(2);
    }
  }, [open, location.pathname]);

  // Destaca o alvo correspondente na interface usando .pf-tour-highlight
  useEffect(() => {
    if (!open || location.pathname === '/login') return;
    const current = WELCOME_STEPS[step];
    const target = document.querySelector(current.selector);
    if (target) {
      target.classList.add('pf-tour-highlight');
    }
    return () => {
      target?.classList.remove('pf-tour-highlight');
    };
  }, [open, step, location.pathname]);

  const dismiss = () => {
    try {
      window.localStorage.setItem(WELCOME_TOUR_SEEN_KEY, '1');
    } catch {
      // Ignora indisponibilidade de storage.
    }
    setOpen(false);
  };

  if (!user || !open || location.pathname === '/login') {
    return null;
  }

  const current = WELCOME_STEPS[step];
  const Icon = current.icon;
  const isFirst = step === 0;
  const isLast = step === WELCOME_STEPS.length - 1;
  const dockSideClass =
    location.pathname === '/criar' ? 'sm:left-5 sm:right-auto' : 'sm:right-5 sm:left-auto';

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-label={`Tour de boas-vindas: passo ${step + 1} de ${WELCOME_STEPS.length}`}
      data-testid="welcome-flow-tour"
      className={`fixed bottom-4 inset-x-4 sm:inset-x-auto ${dockSideClass} sm:w-[370px] z-40 rounded-2xl border border-violet-600/50 bg-white/98 dark:border-[#8B5CF6]/60 dark:bg-[#17171F]/98 backdrop-blur-md p-4 sm:p-5 shadow-2xl shadow-slate-900/15 dark:shadow-black/70 space-y-3.5`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white">
            <Icon className="w-4 h-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 dark:text-[#A855F7] font-mono-num">
              <HelpCircle className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span>
                Boas-vindas · {step + 1} de {WELCOME_STEPS.length}
              </span>
            </p>
            <h2 className="font-display text-sm font-bold text-slate-950 dark:text-white leading-snug">
              {current.title}
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Fechar tour de boas-vindas"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-[#A1A1AA] dark:hover:bg-white/5 dark:hover:text-white transition-colors"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <p className="text-xs text-slate-700 dark:text-white/90 leading-relaxed">
        {current.description}
      </p>

      {/* Indicador interativo do fluxo principal */}
      <div className="grid grid-cols-3 gap-1.5" role="tablist" aria-label="Etapas do fluxo principal">
        {WELCOME_STEPS.map((item, index) => {
          const active = index === step;
          const label =
            item.id === 'perfil' ? 'Perfil' : item.id === 'geracao' ? 'Geração' : 'Estúdio';
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setStep(index)}
              className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                active
                  ? 'bg-violet-100 text-violet-900 dark:bg-[#7C3AED]/30 dark:text-white'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-950 dark:bg-white/5 dark:text-[#A1A1AA] dark:hover:text-white'
              }`}
            >
              {index + 1}. {label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <Link
          to={current.route}
          className="text-xs font-semibold text-violet-700 hover:text-violet-900 dark:text-[#A855F7] dark:hover:text-white underline underline-offset-2"
        >
          {current.routeLabel}
        </Link>

        <div className="flex items-center gap-1.5">
          {!isFirst && (
            <button
              type="button"
              onClick={() => setStep((prev) => prev - 1)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-900 hover:border-violet-600 dark:border-white/15 dark:bg-[#0D0D14] dark:text-white"
            >
              <ArrowLeft className="w-3 h-3" aria-hidden="true" />
              <span>Anterior</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => (isLast ? dismiss() : setStep((prev) => prev + 1))}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold text-white hover:brightness-110 transition-all"
          >
            {isLast ? (
              <>
                <Check className="w-3 h-3" aria-hidden="true" />
                <span>Concluir</span>
              </>
            ) : (
              <>
                <span>Próximo</span>
                <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
