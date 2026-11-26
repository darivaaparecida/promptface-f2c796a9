import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useToast } from '../context/ToastContext';

export function Toaster() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      data-testid="toast-container"
      aria-label="Notificações"
      className="fixed top-20 right-4 z-[70] flex flex-col gap-2.5 w-[calc(100vw-2rem)] max-w-sm pointer-events-none"
    >
      {toasts.map((toast) => {
        const isError = toast.variant === 'error';
        const isInfo = toast.variant === 'info';

        const containerColors = isError
          ? 'border-red-600/50 bg-white/95 text-slate-950 dark:border-red-500/50 dark:bg-[#17171F]/95 dark:text-white'
          : isInfo
          ? 'border-violet-600/45 bg-white/95 text-slate-950 dark:border-[#8B5CF6]/55 dark:bg-[#17171F]/95 dark:text-white'
          : 'border-emerald-600/45 bg-white/95 text-slate-950 dark:border-emerald-500/45 dark:bg-[#17171F]/95 dark:text-white';

        const iconColor = isError
          ? 'text-red-700 dark:text-red-400'
          : isInfo
          ? 'text-violet-700 dark:text-[#A855F7]'
          : 'text-emerald-700 dark:text-emerald-400';

        const Icon = isError ? AlertCircle : isInfo ? Info : CheckCircle2;

        return (
          <div
            key={toast.id}
            role={isError ? 'alert' : 'status'}
            aria-live={isError ? 'assertive' : 'polite'}
            data-testid="toast-item"
            data-toast-variant={toast.variant}
            className={`pointer-events-auto rounded-2xl border px-4 py-3.5 shadow-2xl shadow-slate-900/15 dark:shadow-black/70 backdrop-blur-md flex items-start gap-3 ${containerColors}`}
          >
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="font-display text-sm font-semibold leading-snug">{toast.title}</p>
              {toast.description && (
                <p className="mt-0.5 text-xs text-slate-700 dark:text-[#A1A1AA] leading-relaxed">
                  {toast.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Fechar notificação"
              className="p-1 rounded-lg text-slate-600 hover:text-slate-950 hover:bg-slate-200/70 dark:text-[#A1A1AA] dark:hover:text-white dark:hover:bg-white/10 transition-colors shrink-0"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
