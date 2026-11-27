import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Coins } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const LOW_CREDITS_THRESHOLD = 20;

interface CreditIndicatorProps {
  /** Versão compacta (só o número) para a barra no celular. */
  compact?: boolean;
}

/**
 * Indicador de créditos flutuante da Navbar.
 *
 * Mostra o saldo atual do usuário e pisca quando o saldo muda (geração,
 * edição, resgate mensal ou ajuste do admin), porque o AuthContext
 * recarrega o perfil assim que os créditos mudam. Com saldo baixo
 * (menos de 20), fica âmbar e leva para /planos; com saldo normal,
 * leva para /meu-espaco.
 */
export function CreditIndicator({ compact = false }: CreditIndicatorProps) {
  const { user } = useAuth();
  const [justChanged, setJustChanged] = useState(false);
  const prevCredits = useRef<number | null>(null);

  useEffect(() => {
    if (user == null) return;
    if (prevCredits.current !== null && prevCredits.current !== user.credits) {
      setJustChanged(true);
      const timer = window.setTimeout(() => setJustChanged(false), 1200);
      prevCredits.current = user.credits;
      return () => window.clearTimeout(timer);
    }
    prevCredits.current = user.credits;
    return undefined;
  }, [user?.credits]);

  if (user == null) return null;

  const lowCredits = user.credits < LOW_CREDITS_THRESHOLD;

  return (
    <Link
      to={lowCredits ? '/planos' : '/meu-espaco'}
      aria-live="polite"
      aria-label={
        lowCredits
          ? `Créditos baixos: ${user.credits} créditos restantes. Ver planos para recarregar.`
          : `${user.credits} créditos disponíveis. Ver Meu Espaço.`
      }
      title={
        lowCredits
          ? 'Seus créditos estão acabando — ver planos'
          : 'Seus créditos — ver Meu Espaço'
      }
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-700 dark:focus-visible:ring-[#8B5CF6] ${
        lowCredits
          ? 'border-amber-500/60 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300 dark:hover:bg-amber-500/25'
          : 'border-violet-300/70 bg-violet-100 text-violet-800 hover:bg-violet-200 dark:border-violet-400/30 dark:bg-violet-500/15 dark:text-violet-100 dark:hover:border-[#8B5CF6] dark:hover:bg-violet-500/25'
      } ${justChanged ? 'animate-pulse ring-2 ring-violet-500/60' : ''}`}
    >
      {lowCredits ? (
        <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
      ) : (
        <Coins className="w-4 h-4 shrink-0 text-violet-700 dark:text-[#8B5CF6]" aria-hidden="true" />
      )}
      <span className="font-mono-num">
        {compact ? `${user.credits} cr` : `${user.credits} créditos`}
      </span>
    </Link>
  );
}
