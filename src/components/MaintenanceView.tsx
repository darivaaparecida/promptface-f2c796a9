import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, RefreshCw, ShieldCheck, Wrench } from 'lucide-react';
import type { MaintenanceConfig } from '../shared/adminStats';
import { BrandLogo } from './BrandLogo';
import { ButtonSpinner } from './ButtonSpinner';

interface MaintenanceViewProps {
  maintenance: MaintenanceConfig;
  onRefreshStatus: () => Promise<void>;
}

export function MaintenanceView({ maintenance, onRefreshStatus }: MaintenanceViewProps) {
  const [checking, setChecking] = useState(false);

  const handleCheckAgain = async () => {
    setChecking(true);
    try {
      await onRefreshStatus();
    } finally {
      setChecking(false);
    }
  };

  const formattedUpdatedAt = maintenance.updatedAt
    ? new Date(maintenance.updatedAt).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div
      data-testid="maintenance-screen"
      className="min-h-screen flex flex-col justify-between px-4 sm:px-6 py-8 sm:py-12"
    >
      <div className="mx-auto w-full max-w-2xl flex items-center justify-between">
        <BrandLogo size="md" />
        <Link
          to="/login"
          className="text-xs font-medium text-slate-700 hover:text-slate-950 dark:text-[#A1A1AA] dark:hover:text-white underline-offset-4 hover:underline whitespace-nowrap shrink-0"
        >
          Acesso administrativo
        </Link>
      </div>

      <section
        aria-labelledby="maintenance-title"
        className="mx-auto my-8 w-full max-w-2xl rounded-2xl border border-slate-300 dark:border-white/12 pf-card-surface p-7 sm:p-10 shadow-sm dark:shadow-none space-y-6"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl border border-violet-600/30 bg-violet-100 text-violet-800 dark:border-[#8B5CF6]/40 dark:bg-[#7C3AED]/15 dark:text-[#A855F7] flex items-center justify-center shrink-0">
            <Wrench className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="space-y-2 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-[#A855F7]">
              Atualização do sistema em andamento
            </p>
            <h1
              id="maintenance-title"
              className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white text-balance"
            >
              {maintenance.title}
            </h1>
          </div>
        </div>

        <p className="text-sm sm:text-base leading-relaxed text-slate-700 dark:text-[#D4D4D8]">
          {maintenance.message}
        </p>

        <div className="pt-4 border-t border-slate-200 dark:border-white/10 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-700 dark:text-[#A1A1AA]">
          {maintenance.estimatedReturn && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-violet-700 dark:text-[#A855F7]" aria-hidden="true" />
              <span>{maintenance.estimatedReturn}</span>
            </span>
          )}
          {maintenance.estimatedReturn && formattedUpdatedAt && (
            <span aria-hidden="true">·</span>
          )}
          {formattedUpdatedAt && (
            <span className="font-mono-num">Atualizado em {formattedUpdatedAt}</span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <button
            type="button"
            disabled={checking}
            onClick={handleCheckAgain}
            data-testid="maintenance-refresh-button"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white shadow-lg shadow-[#7C3AED]/20 hover:brightness-110 transition-all whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            {checking ? (
              <ButtonSpinner size="sm" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            <span>{checking ? 'Verificando...' : 'Verificar novamente'}</span>
          </button>

          <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-[#A1A1AA]">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <span>Suas fotos e créditos permanecem protegidos</span>
          </span>
        </div>
      </section>

      <footer className="mx-auto w-full max-w-2xl text-center text-xs text-slate-600 dark:text-[#71717A]">
        PromptFace · Equipe de Engenharia
      </footer>
    </div>
  );
}

export function AdminMaintenanceBanner() {
  return (
    <div
      role="status"
      data-testid="admin-maintenance-banner"
      className="border-b border-amber-500/40 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/50 dark:text-amber-200 px-4 py-2"
    >
      <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="inline-flex items-center gap-2 font-medium">
          <Wrench className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Modo de manutenção ativo — usuários comuns visualizam a tela de manutenção.</span>
        </span>
        <Link
          to="/admin?tab=manutencao"
          className="font-semibold underline underline-offset-2 hover:opacity-80 whitespace-nowrap shrink-0"
        >
          Gerenciar no Admin
        </Link>
      </div>
    </div>
  );
}
