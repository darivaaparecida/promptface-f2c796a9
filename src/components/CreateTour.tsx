import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, Check, HelpCircle, LayoutGrid, Sparkles, X } from 'lucide-react';

export const CREATE_TOUR_SEEN_KEY = 'promptface_create_tour_seen';

interface TourStep {
  icon: typeof Camera;
  shortLabel: string;
  title: string;
  text: string;
  tip: string;
  target: string;
  desktopSide: 'left' | 'right';
}

const STEPS: TourStep[] = [
  {
    icon: Camera,
    shortLabel: 'Rosto',
    title: '1. Envie seu rosto no Perfil Visual',
    text: 'Tudo começa enviando 1 foto nítida e bem iluminada do seu rosto. É ela que a IA usa como referência para manter sua identidade.',
    tip: 'Você também pode escolher o modelo de IA preferido clicando em Gerenciar Perfil Visual.',
    target: '[data-tour="upload"]',
    desktopSide: 'right',
  },
  {
    icon: LayoutGrid,
    shortLabel: 'Cenário',
    title: '2. Escolha o cenário ou descreva livre',
    text: 'Explore 84 cenários prontos em 14 categorias ou mude para Criação Livre para escrever qualquer cena do zero.',
    tip: 'Nos campos de texto (Roupa, Ambiente e Pose), use "Ampliar campo" sempre que quiser mais espaço para digitar.',
    target: '[data-tour="scenario"]',
    desktopSide: 'right',
  },
  {
    icon: Sparkles,
    shortLabel: 'Gerar',
    title: '3. Confira o resumo e gere sua foto',
    text: 'Veja formato, modelo e custo exato em créditos no painel à direita e clique em Confirmar e gerar foto.',
    tip: 'Cada foto custa 10 créditos (20 no Nano Banana Pro). Se houver qualquer falha, o estorno é automático.',
    target: '[data-tour="generate"]',
    desktopSide: 'left',
  },
];

interface CreateTourProps {
  open?: boolean;
  onOpenChange?: (nextOpen: boolean) => void;
}

/**
 * Guia interativo não-bloqueante da página de criação:
 * não escurece nem tampa a área em destaque — no desktop ancora no canto
 * oposto ao elemento destacado, e no mobile aparece em linha sem sobrepor
 * botões ou campos.
 */
export function CreateTour({ open: controlledOpen, onOpenChange }: CreateTourProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [step, setStep] = useState(0);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  useEffect(() => {
    if (isControlled) return;
    try {
      if (!window.localStorage.getItem(CREATE_TOUR_SEEN_KEY)) {
        setInternalOpen(true);
      }
    } catch {
      // Sem localStorage, o tour simplesmente não abre automático.
    }
  }, [isControlled]);

  useEffect(() => {
    if (open) {
      setStep(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const target = document.querySelector(STEPS[step].target);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('pf-tour-highlight');
    }
    return () => {
      target?.classList.remove('pf-tour-highlight');
    };
  }, [open, step]);

  const dismiss = () => {
    try {
      window.localStorage.setItem(CREATE_TOUR_SEEN_KEY, '1');
    } catch {
      // Sem localStorage, apenas fecha na sessão atual.
    }
    if (isControlled) {
      onOpenChange?.(false);
    } else {
      setInternalOpen(false);
    }
  };

  if (!open) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  const desktopDockClass =
    current.desktopSide === 'left'
      ? 'lg:left-6 lg:right-auto'
      : 'lg:right-6 lg:left-auto';

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-label={`Guia rápido de criação: passo ${step + 1} de ${STEPS.length}`}
      data-testid="create-onboarding-tour"
      className={`relative lg:fixed lg:bottom-6 ${desktopDockClass} lg:z-40 lg:w-[390px] rounded-2xl border border-violet-600/50 bg-white dark:border-[#8B5CF6]/60 dark:bg-[#17171F] p-5 shadow-xl shadow-slate-900/12 dark:shadow-black/60 space-y-4 transition-all`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white">
            <Icon className="w-5 h-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-violet-700 dark:text-[#A855F7] font-mono-num">
              <HelpCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>
                Passo {step + 1} de {STEPS.length}
              </span>
            </p>
            <h2 className="font-display text-sm sm:text-base font-bold text-slate-950 dark:text-white leading-snug">
              {current.title}
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Fechar guia"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-[#A1A1AA] dark:hover:bg-white/5 dark:hover:text-white transition-colors"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <p className="text-xs sm:text-sm text-slate-700 dark:text-white/90 leading-relaxed">
        {current.text}
      </p>

      <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 dark:text-[#A1A1AA] dark:bg-[#0D0D14] dark:border-white/10 rounded-xl px-3.5 py-2.5 leading-relaxed">
        <strong className="font-semibold text-slate-900 dark:text-white">Dica:</strong>{' '}
        {current.tip}
      </p>

      {/* Step selector tabs + navigation */}
      <div className="pt-1 space-y-3">
        <div className="grid grid-cols-3 gap-1.5" role="tablist" aria-label="Etapas do guia">
          {STEPS.map((item, index) => {
            const active = index === step;
            return (
              <button
                key={item.title}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStep(index)}
                className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors truncate ${
                  active
                    ? 'bg-violet-100 text-violet-900 font-semibold dark:bg-[#7C3AED]/25 dark:text-white'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-950 dark:bg-white/5 dark:text-[#A1A1AA] dark:hover:text-white'
                }`}
              >
                {index + 1}. {item.shortLabel}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={dismiss}
            className="px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-950 hover:bg-slate-100 dark:text-[#A1A1AA] dark:hover:text-white dark:hover:bg-white/5 transition-colors"
          >
            Pular
          </button>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900 hover:border-violet-600 dark:border-white/15 dark:bg-[#0D0D14] dark:text-white dark:hover:border-[#8B5CF6] transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Anterior</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? dismiss() : setStep(step + 1))}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider text-white bg-gradient-to-r from-[#A855F7] to-[#EC4899] shadow-lg shadow-[#7C3AED]/25 hover:brightness-110 transition-all"
            >
              {isLast ? (
                <>
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Entendi</span>
                </>
              ) : (
                <>
                  <span>Próximo</span>
                  <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
