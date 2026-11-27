import { useEffect, useState } from 'react';
import { Camera, LayoutGrid, Sparkles, X } from 'lucide-react';

const TOUR_SEEN_KEY = 'promptface_create_tour_seen';

interface TourStep {
  icon: typeof Camera;
  title: string;
  text: string;
  target: string;
}

const STEPS: TourStep[] = [
  {
    icon: Camera,
    title: '1. Envie seu rosto',
    text: 'Tudo começa no Perfil Visual: envie 1 foto bem iluminada do seu rosto. É ela que a IA usa como referência em todas as fotos.',
    target: '[data-tour="upload"]',
  },
  {
    icon: LayoutGrid,
    title: '2. Escolha o cenário',
    text: 'São 84 cenários em 14 categorias — ou descreva a cena que você quiser no modo livre e personalize os detalhes.',
    target: '[data-tour="scenario"]',
  },
  {
    icon: Sparkles,
    title: '3. Gere sua foto',
    text: 'Confira o custo em créditos e toque em Confirmar e gerar foto. Cada foto custa 10 créditos (20 com o Nano Banana Pro).',
    target: '[data-tour="generate"]',
  },
];

/**
 * Tour inicial da página de criação: aparece só na primeira visita e
 * destaca os 3 passos principais (foto, cenário, gerar). Sem biblioteca
 * externa — o destaque é um anel violeta no elemento do passo atual.
 */
export function CreateTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(TOUR_SEEN_KEY)) setOpen(true);
    } catch {
      // Sem localStorage, o tour simplesmente não aparece.
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const target = document.querySelector(STEPS[step].target);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target?.classList.add('pf-tour-highlight');
    return () => {
      target?.classList.remove('pf-tour-highlight');
    };
  }, [open, step]);

  const dismiss = () => {
    try {
      window.localStorage.setItem(TOUR_SEEN_KEY, '1');
    } catch {
      // Sem localStorage, o tour pode reaparecer — sem problema.
    }
    setOpen(false);
  };

  if (!open) return null;

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Tour inicial da criação"
    >
      <button
        type="button"
        aria-label="Fechar tour"
        onClick={dismiss}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-300 bg-white dark:border-white/10 dark:bg-[#17171F] p-6 shadow-2xl">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Pular tour"
          className="absolute top-4 right-4 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-[#A1A1AA] dark:hover:bg-white/5"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>

        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-white">
          <Icon className="w-5 h-5" aria-hidden="true" />
        </span>
        <h2 className="mt-4 font-display text-lg font-semibold text-slate-950 dark:text-white">
          {current.title}
        </h2>
        <p className="mt-1.5 text-sm text-slate-700 dark:text-[#A1A1AA] leading-relaxed">
          {current.text}
        </p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5" aria-label={`Passo ${step + 1} de ${STEPS.length}`}>
            {STEPS.map((item, index) => (
              <span
                key={item.title}
                className={`h-1.5 rounded-full transition-all ${
                  index === step
                    ? 'w-6 bg-gradient-to-r from-[#A855F7] to-[#EC4899]'
                    : 'w-1.5 bg-slate-300 dark:bg-white/20'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={dismiss}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider text-slate-700 hover:bg-slate-100 dark:text-[#A1A1AA] dark:hover:bg-white/5"
            >
              Pular
            </button>
            <button
              type="button"
              onClick={() => (isLast ? dismiss() : setStep(step + 1))}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold uppercase tracking-wider text-white bg-gradient-to-r from-[#A855F7] to-[#EC4899] shadow-lg shadow-[#7C3AED]/25 hover:brightness-110"
            >
              {isLast ? 'Entendi' : 'Próximo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
