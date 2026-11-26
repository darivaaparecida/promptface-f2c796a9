import React, { useEffect, useState } from 'react';
import { Maximize2, Minimize2, X } from 'lucide-react';

interface ExpandableTextFieldProps {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  defaultRows?: number;
  expandedRows?: number;
  isCustomized?: boolean;
  textareaClassName?: string;
}

export function ExpandableTextField({
  id,
  label,
  hint,
  value,
  onChange,
  placeholder,
  defaultRows = 2,
  expandedRows = 5,
  isCustomized = false,
  textareaClassName = '',
}: ExpandableTextFieldProps) {
  const [expanded, setExpanded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fullscreen]);

  return (
    <>
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 dark:border-white/10 dark:bg-[#0D0D14] p-3.5 sm:p-4 transition-colors focus-within:border-violet-600 dark:focus-within:border-[#8B5CF6]/80">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <label
            htmlFor={id}
            className="text-xs font-semibold text-slate-900 dark:text-white"
          >
            {label}
          </label>
          {isCustomized && (
            <span className="inline-flex items-center rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-800 dark:bg-[#7C3AED]/20 dark:text-[#C4B5FD]">
              Editado
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            aria-haspopup="dialog"
            title="Editar em tela cheia"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-violet-500 hover:text-violet-800 dark:border-white/15 dark:bg-[#17171F] dark:text-[#A1A1AA] dark:hover:border-[#8B5CF6]/60 dark:hover:text-white transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Tela cheia</span>
          </button>
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            aria-controls={id}
            title={expanded ? 'Reduzir altura do campo' : 'Aumentar altura do campo'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:border-violet-500 hover:text-violet-800 dark:border-white/15 dark:bg-[#17171F] dark:text-[#A1A1AA] dark:hover:border-[#8B5CF6]/60 dark:hover:text-white transition-colors"
          >
            {expanded ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Reduzir campo</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Ampliar campo</span>
              </>
            )}
          </button>
        </div>
      </div>

      {hint && (
        <p className="text-[11px] text-slate-600 dark:text-[#A1A1AA] mb-2 leading-relaxed">
          {hint}
        </p>
      )}

      <textarea
        id={id}
        rows={expanded ? expandedRows : defaultRows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full resize-y rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-950 placeholder:text-slate-400 focus:outline-none focus:border-violet-600 dark:border-white/15 dark:bg-[#15151E] dark:text-white dark:placeholder:text-[#A1A1AA]/55 dark:focus:border-[#8B5CF6] transition-[height] ${textareaClassName}`}
      />

      <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-[#A1A1AA]/75">
        <span>Você também pode arrastar o canto inferior para ajustar a altura.</span>
        <span className="font-mono-num shrink-0 ml-2">{value.length} caracteres</span>
      </div>
    </div>

    {/* Overlay de tela cheia: mesmo valor, id próprio para não duplicar */}
    {fullscreen && (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${label} — tela cheia`}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center sm:justify-center"
        onClick={() => setFullscreen(false)}
      >
        <div
          className="w-full sm:max-w-2xl max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#12121A] border border-slate-300 dark:border-white/15 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-5 pt-4 pb-3 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-3 shrink-0">
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold text-slate-950 dark:text-white truncate">
                {label}
              </h2>
              {hint && (
                <p className="text-xs text-slate-600 dark:text-[#A1A1AA] mt-0.5 leading-relaxed">
                  {hint}
                </p>
              )}
            </div>
            <button
              type="button"
              aria-label="Fechar tela cheia"
              onClick={() => setFullscreen(false)}
              className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-600 hover:text-slate-950 hover:bg-slate-100 dark:text-[#A1A1AA] dark:hover:text-white dark:hover:bg-white/5 shrink-0"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <div className="overflow-y-auto px-4 sm:px-5 py-4 flex-1">
            <textarea
              id={`${id}-fullscreen`}
              autoFocus
              rows={12}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className={`w-full min-h-[40vh] resize-y rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-950 placeholder:text-slate-400 focus:outline-none focus:border-violet-600 dark:border-white/15 dark:bg-[#15151E] dark:text-white dark:placeholder:text-[#A1A1AA]/55 dark:focus:border-[#8B5CF6] ${textareaClassName}`}
            />
          </div>

          <div className="px-5 py-3 border-t border-slate-200 dark:border-white/10 flex items-center justify-between gap-3 shrink-0">
            <span className="text-[11px] text-slate-500 dark:text-[#A1A1AA]/75 font-mono-num">
              {value.length} caracteres
            </span>
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#A855F7] to-[#EC4899] text-xs font-semibold uppercase tracking-wider text-white hover:brightness-110"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
