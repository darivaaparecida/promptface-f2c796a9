import React, { useId, useRef, useState } from 'react';
import { MoveHorizontal } from 'lucide-react';
import { BEFORE_AFTER_PAIRS } from '../shared/catalog';
import { ImageWithFallback } from './ImageWithFallback';

export interface ImageCompareSliderProps {
  title: string;
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
  beforeClassName?: string;
  afterClassName?: string;
  aspectClassName?: string;
  objectPositionClass?: string;
}

export function ImageCompareSlider({
  title,
  beforeImage,
  afterImage,
  beforeLabel = 'Antes',
  afterLabel = 'Depois',
  beforeClassName = '',
  afterClassName = '',
  aspectClassName = 'aspect-[3/4]',
  objectPositionClass = 'object-cover object-top',
}: ImageCompareSliderProps) {
  const [position, setPosition] = useState(52);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputId = useId();

  const updateFromClientX = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (!rect.width) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(95, Math.max(5, Math.round(pct))));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromClientX(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1 && e.pointerType === 'mouse') return;
    updateFromClientX(e.clientX);
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      className={`relative ${aspectClassName} w-full overflow-hidden select-none touch-none cursor-ew-resize bg-[#08080C]`}
    >
      {/* After image (full) */}
      <ImageWithFallback
        src={afterImage}
        alt={`${title} — ${afterLabel}`}
        className={`absolute inset-0 w-full h-full ${objectPositionClass} ${afterClassName}`}
      />

      {/* Before image (clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <ImageWithFallback
          src={beforeImage}
          alt={`${title} — ${beforeLabel}`}
          className={`absolute inset-0 w-full h-full ${objectPositionClass} ${beforeClassName}`}
        />
      </div>

      {/* Scrims and clear labels */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#08080C]/85 via-[#08080C]/35 to-transparent" />
      <div className="pointer-events-none absolute top-3 left-3 text-xs font-medium text-white bg-[#08080C]/80 backdrop-blur-sm px-2.5 py-1 rounded-md border border-white/15">
        {beforeLabel}
      </div>
      <div className="pointer-events-none absolute top-3 right-3 text-xs font-medium text-white bg-[#08080C]/80 backdrop-blur-sm px-2.5 py-1 rounded-md border border-white/15">
        {afterLabel}
      </div>

      {/* Divider line & handle */}
      <div
        className="pointer-events-none absolute inset-y-0 w-0.5 bg-white/90 shadow-md"
        style={{ left: `${position}%` }}
      >
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#7C3AED] border-2 border-white flex items-center justify-center shadow-lg">
          <MoveHorizontal className="w-4 h-4 text-white" aria-hidden="true" />
        </div>
      </div>

      {/* Accessible range control */}
      <label className="sr-only" htmlFor={inputId}>
        Comparar antes e depois: {title}
      </label>
      <input
        id={inputId}
        type="range"
        min={5}
        max={95}
        value={position}
        onChange={(e) => setPosition(Number(e.target.value))}
        className="sr-only"
      />
    </div>
  );
}

function ComparisonCard({
  title,
  scenarioLabel,
  beforeImage,
  afterImage,
}: {
  title: string;
  scenarioLabel: string;
  beforeImage: string;
  afterImage: string;
}) {
  return (
    <article className="rounded-2xl border border-white/10 pf-card-surface overflow-hidden transition-colors hover:border-white/20">
      <ImageCompareSlider
        title={title}
        beforeImage={beforeImage}
        afterImage={afterImage}
        beforeLabel="Antes · Selfie"
        afterLabel="Depois · Foto gerada por IA"
      />

      <div className="p-5">
        <p className="text-xs text-[#A1A1AA]">Demonstração · Foto gerada por IA</p>
        <h3 className="mt-1.5 font-display text-base font-semibold text-white">{title}</h3>
        <p className="mt-1 text-sm text-[#A1A1AA]">{scenarioLabel}</p>
      </div>
    </article>
  );
}

export function BeforeAfterShowcase() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {BEFORE_AFTER_PAIRS.map((pair) => (
        <ComparisonCard
          key={pair.id}
          title={pair.title}
          scenarioLabel={pair.scenarioLabel}
          beforeImage={pair.beforeImage}
          afterImage={pair.afterImage}
        />
      ))}
    </div>
  );
}
