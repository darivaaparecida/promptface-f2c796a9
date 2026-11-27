import React, { useEffect, useId, useRef, useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface InfoTooltipProps {
  text: string;
  label?: string;
  align?: 'center' | 'left' | 'right';
  className?: string;
  children?: React.ReactNode;
}

/**
 * Tooltip informativo acessível para desktop (hover/focus) e mobile (toque).
 * Pode envolver um elemento existente (`children`) ou exibir um ícone discreto de ajuda.
 */
export function InfoTooltip({
  text,
  label = 'Mais informações',
  align = 'center',
  className = '',
  children,
}: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const wrapperRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const positionClass =
    align === 'left'
      ? 'left-0'
      : align === 'right'
      ? 'right-0'
      : 'left-1/2 -translate-x-1/2';

  return (
    <span
      ref={wrapperRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      className={`relative inline-flex items-center ${className}`}
    >
      {children ? (
        <span
          aria-describedby={open ? tooltipId : undefined}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className="inline-flex w-full items-center"
        >
          {children}
        </span>
      ) : (
        <button
          type="button"
          aria-label={label}
          aria-expanded={open}
          aria-describedby={open ? tooltipId : undefined}
          onClick={() => setOpen((prev) => !prev)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className="inline-flex items-center justify-center rounded-full p-0.5 text-slate-500 hover:text-violet-700 dark:text-[#A1A1AA] dark:hover:text-[#C4B5FD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] transition-colors"
        >
          <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      )}

      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className={`pointer-events-none absolute bottom-full ${positionClass} mb-2 z-50 w-60 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-300 bg-slate-950 px-3 py-2 text-[11px] font-normal leading-relaxed text-white shadow-xl dark:border-white/15 dark:bg-[#0B0B11]`}
        >
          {text}
        </span>
      )}
    </span>
  );
}
