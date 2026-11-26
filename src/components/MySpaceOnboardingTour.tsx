import { ArrowLeft, ArrowRight, Check, HelpCircle, X } from 'lucide-react';

export interface TourStepDefinition {
  id: 'folders' | 'batch' | 'search' | 'prompts';
  title: string;
  description: string;
  tip: string;
}

export const MYSPACE_TOUR_STEPS: TourStepDefinition[] = [
  {
    id: 'folders',
    title: 'Organize em pastas e exporte em PDF',
    description:
      'Crie pastas por tema ou evento, filtre suas criações e exporte qualquer pasta inteira como um álbum PDF estruturado ou arquivo ZIP.',
    tip: 'Use "Selecionar pasta" no painel de álbuns para marcar todas as fotos de uma pasta de uma vez.',
  },
  {
    id: 'batch',
    title: 'Seleção múltipla e barra flutuante',
    description:
      'Marque duas ou mais fotografias usando a caixa no canto superior esquerdo de cada card para abrir a barra de ações flutuante.',
    tip: 'Com ela você aplica o mesmo filtro artístico, move todas para o mesmo álbum ou exclui em lote com um clique.',
  },
  {
    id: 'search',
    title: 'Busca por título, prompt ou pasta',
    description:
      'Encontre qualquer fotografia digitando o nome do cenário, palavras-chave do prompt original ou o nome da pasta em que ela está salva.',
    tip: 'Combine a busca com o filtro de data e favoritos para localizar ensaios específicos.',
  },
  {
    id: 'prompts',
    title: 'Histórico de prompts e tela cheia',
    description:
      'Acesse a aba "Histórico de prompts" para copiar ou reutilizar estilos que você gostou direto no Criador, ou clique em uma foto para abrir em tela cheia e compartilhar.',
    tip: 'No modal de visualização você também baixa a imagem em alta resolução ou no formato exato de Stories e Feed.',
  },
];

interface MySpaceOnboardingTourProps {
  open: boolean;
  stepIndex: number;
  onChangeStep: (nextIndex: number) => void;
  onClose: () => void;
}

export function MySpaceOnboardingTour({
  open,
  stepIndex,
  onChangeStep,
  onClose,
}: MySpaceOnboardingTourProps) {
  if (!open) return null;

  const safeIndex = Math.min(MYSPACE_TOUR_STEPS.length - 1, Math.max(0, stepIndex));
  const current = MYSPACE_TOUR_STEPS[safeIndex];
  const isFirst = safeIndex === 0;
  const isLast = safeIndex === MYSPACE_TOUR_STEPS.length - 1;

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-label={`Guia rápido do Meu Espaço: passo ${safeIndex + 1} de ${MYSPACE_TOUR_STEPS.length}`}
      data-testid="myspace-onboarding-tour"
      className="rounded-2xl border border-violet-600/50 bg-gradient-to-br from-violet-50 via-white to-slate-50 dark:border-[#8B5CF6]/60 dark:from-[#201833] dark:via-[#17171F] dark:to-[#17171F] p-5 sm:p-6 shadow-xl shadow-slate-900/10 dark:shadow-[#7C3AED]/15 space-y-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-violet-700 dark:text-[#A855F7]">
            <HelpCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="font-mono-num">
              Guia interativo · Passo {safeIndex + 1} de {MYSPACE_TOUR_STEPS.length}
            </span>
          </div>
          <h2 className="font-display text-lg font-bold text-slate-950 dark:text-white">{current.title}</h2>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Pular guia interativo"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-700 hover:text-slate-950 dark:border-white/15 dark:bg-[#08080C] dark:text-[#A1A1AA] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Pular</span>
        </button>
      </div>

      <p className="text-sm text-slate-800 dark:text-white/90 leading-relaxed">{current.description}</p>
      <p className="text-xs text-slate-700 bg-slate-100 border border-slate-300 dark:text-[#A1A1AA] dark:bg-[#08080C]/80 dark:border-white/10 rounded-xl px-3.5 py-2.5">
        Dica: {current.tip}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Etapas do guia">
          {MYSPACE_TOUR_STEPS.map((step, idx) => (
            <button
              key={step.id}
              type="button"
              role="tab"
              aria-selected={idx === safeIndex}
              aria-label={`Ir para passo ${idx + 1}: ${step.title}`}
              onClick={() => onChangeStep(idx)}
              className={`h-2 rounded-full transition-all ${
                idx === safeIndex
                  ? 'w-7 bg-violet-700 dark:bg-[#A855F7]'
                  : 'w-2.5 bg-slate-300 hover:bg-slate-500 dark:bg-white/20 dark:hover:bg-white/40'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          {!isFirst && (
            <button
              type="button"
              onClick={() => onChangeStep(safeIndex - 1)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-950 hover:border-violet-700 dark:border-white/15 dark:bg-[#08080C] dark:text-white dark:hover:border-[#8B5CF6] transition-colors whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Anterior</span>
            </button>
          )}
          {isLast ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white hover:brightness-110 transition-all whitespace-nowrap"
            >
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Concluir guia</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onChangeStep(safeIndex + 1)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white hover:brightness-110 transition-all whitespace-nowrap"
            >
              <span>Próximo</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
