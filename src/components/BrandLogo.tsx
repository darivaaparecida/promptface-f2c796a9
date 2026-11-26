import { useId } from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  showDivider?: boolean;
  animateEntrance?: boolean;
  className?: string;
}

const SIZE_CONFIG = {
  sm: {
    icon: 'h-6 w-auto',
    divider: 'h-5 w-[1.5px]',
    text: 'text-base',
    gap: 'gap-2.5',
  },
  md: {
    icon: 'h-8 w-auto',
    divider: 'h-6 w-[2px]',
    text: 'text-lg sm:text-xl',
    gap: 'gap-3',
  },
  lg: {
    icon: 'h-9 w-auto',
    divider: 'h-7 w-[2px]',
    text: 'text-xl sm:text-2xl',
    gap: 'gap-3',
  },
} as const;

export function BrandLogo({
  size = 'md',
  showWordmark = true,
  showDivider = true,
  animateEntrance = false,
  className = '',
}: BrandLogoProps) {
  const rawId = useId();
  const idPrefix = rawId.replace(/:/g, '');
  const cfg = SIZE_CONFIG[size];

  const stemGradId = `${idPrefix}-stem`;
  const stemShadowGradId = `${idPrefix}-stem-shadow`;
  const armGradId = `${idPrefix}-arm`;
  const armShadeGradId = `${idPrefix}-arm-shade`;
  const topGradId = `${idPrefix}-top`;

  return (
    <span
      data-testid={animateEntrance ? 'header-brand-logo' : undefined}
      className={`group/brand inline-flex items-center ${cfg.gap} select-none ${
        animateEntrance ? 'pf-logo-animate' : ''
      } ${className}`}
    >
      <span className="relative inline-flex items-center justify-center shrink-0">
        {animateEntrance && (
          <span
            aria-hidden="true"
            className="pf-logo-aura pointer-events-none absolute -inset-2 rounded-full bg-gradient-to-tr from-[#4300FF]/45 via-[#8B5CF6]/35 to-[#EC4899]/40 blur-md"
          />
        )}
        <svg
          viewBox="0 0 100 112"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className={`${cfg.icon} relative shrink-0 pf-logo-svg transition-transform duration-300 ease-out group-hover/brand:scale-[1.06] group-hover/brand:-rotate-2`}
        >
          <defs>
            <linearGradient id={stemGradId} x1="18" y1="36" x2="18" y2="108" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#6D28D9" />
              <stop offset="55%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#C084FC" />
            </linearGradient>

            <linearGradient id={stemShadowGradId} x1="4" y1="36" x2="33" y2="64" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1E0758" />
              <stop offset="100%" stopColor="#43129E" />
            </linearGradient>

            <linearGradient id={armGradId} x1="41" y1="86" x2="94" y2="42" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#4300FF" />
              <stop offset="55%" stopColor="#7C22FF" />
              <stop offset="100%" stopColor="#A855F7" />
            </linearGradient>

            <linearGradient id={armShadeGradId} x1="72" y1="32" x2="94" y2="56" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#3B0764" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#7E22CE" stopOpacity="0.1" />
            </linearGradient>

            <linearGradient id={topGradId} x1="8" y1="38" x2="94" y2="34" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#4A00FF" />
              <stop offset="48%" stopColor="#7E3AF2" />
              <stop offset="82%" stopColor="#B845FF" />
              <stop offset="100%" stopColor="#D946EF" />
            </linearGradient>
          </defs>

          {/* Camada 1: Braço inferior direito dobrando sob a curva superior */}
          <g className="pf-logo-arm">
            <path
              d="M40 89 C58 80 78 69 90 59 C96 54 97 45 94 37 L74 32 C64 42 54 47 47 51 C41 55 40 60 40 68 Z"
              fill={`url(#${armGradId})`}
            />
            <path
              d="M66 40 C75 39 85 43 92 54 C96 49 96 42 94 37 L74 32 C71 35 68 38 66 40 Z"
              fill={`url(#${armShadeGradId})`}
            />
          </g>

          {/* Camada 2: Haste esquerda com corte diagonal e dobra sombreada */}
          <g className="pf-logo-stem">
            <path
              d="M3 108 L3 58 C11 42 21 34 32 32 L32 82 C32 89 27 94 19 99 Z"
              fill={`url(#${stemGradId})`}
            />
            <path
              d="M3 67 C12 56 21 49 32 46 L32 32 C21 34 11 42 3 58 Z"
              fill={`url(#${stemShadowGradId})`}
            />
          </g>

          {/* Camada 3: Arco superior principal em fita contínua */}
          <path
            className="pf-logo-arch"
            d="M3 62 C3 44 13 33 32 32 C53 31 71 33 83 38 C90 41 94 49 92 57 C96 50 97 42 96 34 C94 14 72 5 37 5 C12 5 3 19 3 43 Z"
            fill={`url(#${topGradId})`}
          />
        </svg>
      </span>

      {showWordmark && (
        <>
          {showDivider && (
            <span
              aria-hidden="true"
              className={`${cfg.divider} pf-logo-divider rounded-full bg-gradient-to-b from-[#D946EF] via-[#8B5CF6] to-[#4300FF] shrink-0 transition-transform duration-300 group-hover/brand:scale-y-110`}
            />
          )}
          <span
            className={`relative inline-flex items-center overflow-hidden py-1 -my-1 pr-0.5 font-display ${cfg.text} font-bold tracking-tight leading-none whitespace-nowrap`}
          >
            <span className="pf-logo-word-prompt text-slate-950 dark:text-white transition-colors duration-200">
              Prompt
            </span>
            <span className="pf-logo-word-face bg-gradient-to-b from-[#D946EF] via-[#8B5CF6] to-[#5B21B6] dark:from-[#E879F9] dark:via-[#A855F7] dark:to-[#7C3AED] bg-clip-text text-transparent">
              Face
            </span>
            {animateEntrance && (
              <span
                aria-hidden="true"
                className="pf-logo-sheen pointer-events-none absolute inset-0 inline-flex items-center py-1 select-none"
              >
                PromptFace
              </span>
            )}
          </span>
        </>
      )}
    </span>
  );
}
