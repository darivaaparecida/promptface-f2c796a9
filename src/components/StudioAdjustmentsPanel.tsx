import { RotateCcw } from 'lucide-react';
import { ARTISTIC_FILTERS, type ArtisticFilterId } from '../shared/artisticFilters';

export interface StudioLocalAdjustments {
  brightness: number; // 100 = normal (70..130)
  contrast: number; // 100 = normal (75..135)
  saturate: number; // 100 = normal (50..150)
  warmth: number; // 0 = neutro (-30..30)
  filterId: ArtisticFilterId;
}

export const DEFAULT_STUDIO_ADJUSTMENTS: StudioLocalAdjustments = {
  brightness: 100,
  contrast: 100,
  saturate: 100,
  warmth: 0,
  filterId: 'original',
};

export function hasActiveAdjustments(adj: StudioLocalAdjustments): boolean {
  return (
    adj.brightness !== 100 ||
    adj.contrast !== 100 ||
    adj.saturate !== 100 ||
    adj.warmth !== 0 ||
    adj.filterId !== 'original'
  );
}

export function buildCssFilterString(adj: StudioLocalAdjustments): string {
  const parts: string[] = [];
  if (adj.brightness !== 100) parts.push(`brightness(${adj.brightness}%)`);
  if (adj.contrast !== 100) parts.push(`contrast(${adj.contrast}%)`);
  if (adj.saturate !== 100) parts.push(`saturate(${adj.saturate}%)`);
  if (adj.warmth > 0) {
    parts.push(`sepia(${Math.round(adj.warmth * 0.8)}%)`);
  } else if (adj.warmth < 0) {
    parts.push(`hue-rotate(${Math.round(adj.warmth * 0.6)}deg)`);
  }

  const preset = ARTISTIC_FILTERS.find((f) => f.id === adj.filterId);
  if (preset && preset.canvasFilter !== 'none') {
    parts.push(preset.canvasFilter);
  }

  return parts.length > 0 ? parts.join(' ') : 'none';
}

interface StudioAdjustmentsPanelProps {
  value: StudioLocalAdjustments;
  onChange: (next: StudioLocalAdjustments) => void;
  onReset: () => void;
}

export function StudioAdjustmentsPanel({
  value,
  onChange,
  onReset,
}: StudioAdjustmentsPanelProps) {
  const dirty = hasActiveAdjustments(value);

  const sliders: {
    id: string;
    key: 'brightness' | 'contrast' | 'saturate' | 'warmth';
    label: string;
    min: number;
    max: number;
    display: string;
  }[] = [
    {
      id: 'adj-brightness',
      key: 'brightness',
      label: 'Brilho',
      min: 70,
      max: 130,
      display: `${value.brightness}%`,
    },
    {
      id: 'adj-contrast',
      key: 'contrast',
      label: 'Contraste',
      min: 75,
      max: 135,
      display: `${value.contrast}%`,
    },
    {
      id: 'adj-saturate',
      key: 'saturate',
      label: 'Saturação',
      min: 50,
      max: 150,
      display: `${value.saturate}%`,
    },
    {
      id: 'adj-warmth',
      key: 'warmth',
      label: 'Temperatura',
      min: -30,
      max: 30,
      display:
        value.warmth === 0
          ? 'Neutra'
          : value.warmth > 0
          ? `Quente +${value.warmth}`
          : `Fria ${value.warmth}`,
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-950 dark:text-white">
            Ajustes instantâneos (sem gastar créditos)
          </p>
          <p className="text-xs text-slate-600 dark:text-[#A1A1AA] mt-0.5">
            Pré-visualize cor, luz e filtros na hora e baixe a foto já finalizada.
          </p>
        </div>
        {dirty && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-semibold text-slate-700 hover:border-violet-600 hover:text-slate-950 dark:border-white/15 dark:bg-[#0D0D14] dark:text-[#A1A1AA] dark:hover:text-white shrink-0"
          >
            <RotateCcw className="w-3 h-3" aria-hidden="true" />
            <span>Resetar</span>
          </button>
        )}
      </div>

      <div className="space-y-3.5">
        {sliders.map((item) => (
          <div key={item.key} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <label
                htmlFor={item.id}
                className="font-medium text-slate-800 dark:text-white/90"
              >
                {item.label}
              </label>
              <span className="font-mono-num text-[11px] text-slate-600 dark:text-[#A1A1AA]">
                {item.display}
              </span>
            </div>
            <input
              id={item.id}
              type="range"
              min={item.min}
              max={item.max}
              value={value[item.key]}
              onChange={(e) =>
                onChange({
                  ...value,
                  [item.key]: Number(e.target.value),
                })
              }
              className="w-full accent-[#7C3AED] cursor-pointer"
            />
          </div>
        ))}
      </div>

      <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-white/10">
        <p className="text-xs font-medium text-slate-800 dark:text-white/90">
          Filtros rápidos
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ARTISTIC_FILTERS.map((preset) => {
            const active = value.filterId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ ...value, filterId: preset.id })}
                className={`px-3 py-2 rounded-xl border text-xs font-medium text-left transition-colors ${
                  active
                    ? 'border-violet-600 bg-violet-50 text-violet-950 font-semibold dark:border-[#8B5CF6] dark:bg-[#7C3AED]/20 dark:text-white'
                    : 'border-slate-300 bg-slate-50 text-slate-700 hover:border-slate-400 dark:border-white/10 dark:bg-[#0D0D14] dark:text-[#A1A1AA] dark:hover:text-white'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
