import { BadgePercent } from 'lucide-react';
import { getPlanSavingsBadgeInfo, type PlanCyclePricing } from '../shared/plansCalculator';

interface PlanSavingsBadgeProps {
  cyclePricing: PlanCyclePricing;
  variant?: 'card' | 'compact' | 'cycle';
  className?: string;
  testId?: string;
}

export function PlanSavingsBadge({
  cyclePricing,
  variant = 'card',
  className = '',
  testId,
}: PlanSavingsBadgeProps) {
  const info = getPlanSavingsBadgeInfo(cyclePricing);
  if (!info) return null;

  const isYearly = info.interval === 'yearly';

  const containerTone = isYearly
    ? 'border-emerald-600/45 bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-950 dark:border-emerald-400/45 dark:from-emerald-500/20 dark:to-teal-500/15 dark:text-emerald-100'
    : 'border-emerald-500/35 bg-emerald-50/90 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-500/12 dark:text-emerald-200';

  const iconTone = 'text-emerald-700 dark:text-emerald-300';

  const dividerTone = isYearly
    ? 'border-emerald-600/25 dark:border-emerald-300/25'
    : 'border-emerald-600/20 dark:border-emerald-300/20';

  if (variant === 'compact') {
    return (
      <div
        data-testid={testId ?? `plan-savings-badge-${info.interval}`}
        className={`inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-lg border px-2 py-1 text-[11px] font-medium leading-tight ${containerTone} ${className}`}
      >
        <BadgePercent className={`w-3.5 h-3.5 shrink-0 ${iconTone}`} aria-hidden="true" />
        <span className="tabular-nums font-semibold">{info.headline}</span>
        <span className="tabular-nums font-bold opacity-85">({info.discountTag})</span>
      </div>
    );
  }

  if (variant === 'cycle') {
    return (
      <div
        data-testid={testId ?? `plan-savings-badge-cycle-${info.interval}`}
        className={`inline-flex max-w-full items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium ${containerTone} ${className}`}
      >
        <BadgePercent className={`w-4 h-4 shrink-0 ${iconTone}`} aria-hidden="true" />
        <span className="tabular-nums font-semibold">
          Economize até {cyclePricing.savingsFormatted} {info.periodShortLabel}
        </span>
        <span className={`pl-2 border-l ${dividerTone} tabular-nums font-bold whitespace-nowrap`}>
          {info.discountTag}
        </span>
      </div>
    );
  }

  return (
    <div
      data-testid={testId ?? `plan-savings-badge-${info.interval}`}
      className={`inline-flex w-fit max-w-full flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${containerTone} ${className}`}
    >
      <div className="inline-flex items-center gap-1.5">
        <BadgePercent className={`w-4 h-4 shrink-0 ${iconTone}`} aria-hidden="true" />
        <span className="tabular-nums font-semibold whitespace-nowrap">{info.headline}</span>
      </div>
      <span
        className={`pl-2 border-l ${dividerTone} tabular-nums font-bold whitespace-nowrap`}
      >
        {info.discountTag}
      </span>
      <span className="text-[11px] opacity-85 whitespace-nowrap">
        · {info.retentionTag}
      </span>
    </div>
  );
}
