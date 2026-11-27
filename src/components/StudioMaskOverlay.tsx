import React, { useEffect, useRef, useState } from 'react';
import { Brush, Check, RotateCcw, Trash2 } from 'lucide-react';

export interface StudioMaskOverlayProps {
  active: boolean;
  onClose: () => void;
  onMaskChange: (dataUrl: string | null, strokeCount: number) => void;
}

type BrushSize = 'sm' | 'md' | 'lg';

const BRUSH_RADII: Record<BrushSize, number> = {
  sm: 14,
  md: 28,
  lg: 46,
};

/**
 * Sobrepõe um canvas interativo apenas quando o modo de máscara (pincel)
 * está ativo no Studio. Permite pintar áreas da foto (ex.: roupa ou fundo)
 * para edição localizada.
 * TODO(studio): enviar o `maskDataUrl` gerado para a Edge Function de inpainting.
 */
export function StudioMaskOverlay({
  active,
  onClose,
  onMaskChange,
}: StudioMaskOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<ImageData[]>([]);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [brushSize, setBrushSize] = useState<BrushSize>('md');
  const [strokeCount, setStrokeCount] = useState(0);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      if (canvas.width !== Math.round(rect.width) || canvas.height !== Math.round(rect.height)) {
        canvas.width = Math.round(rect.width);
        canvas.height = Math.round(rect.height);
        strokesRef.current = [];
        setStrokeCount(0);
        onMaskChange(null, 0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active) return null;

  const getCanvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / (rect.width || 1);
    const scaleY = canvas.height / (rect.height || 1);
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const emitMask = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const count = strokesRef.current.length;
    setStrokeCount(count);
    onMaskChange(count > 0 ? canvas.toDataURL('image/png') : null, count);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    strokesRef.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    isDrawingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);

    const pt = getCanvasPoint(e);
    lastPointRef.current = pt;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.55)';
    ctx.fillStyle = 'rgba(168, 85, 247, 0.55)';
    ctx.lineWidth = BRUSH_RADII[brushSize] * 2;

    ctx.beginPath();
    ctx.arc(pt.x, pt.y, BRUSH_RADII[brushSize], 0, Math.PI * 2);
    ctx.fill();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pt = getCanvasPoint(e);
    const prev = lastPointRef.current || pt;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.55)';
    ctx.lineWidth = BRUSH_RADII[brushSize] * 2;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();

    lastPointRef.current = pt;
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPointRef.current = null;
    emitMask();
  };

  const handleUndo = () => {
    const canvas = canvasRef.current;
    if (!canvas || strokesRef.current.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const prevSnapshot = strokesRef.current.pop();
    if (prevSnapshot) {
      ctx.putImageData(prevSnapshot, 0, 0);
    }
    emitMask();
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokesRef.current = [];
    emitMask();
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-label="Área de seleção com pincel sobre a fotografia"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="absolute inset-0 z-10 w-full h-full touch-none cursor-crosshair"
      />

      <div className="absolute top-3 inset-x-3 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-500/50 bg-white/95 dark:bg-[#0D0D14]/92 backdrop-blur-md px-3 py-2 shadow-lg">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-900 dark:text-white">
          <Brush className="w-3.5 h-3.5 text-violet-700 dark:text-[#A855F7]" aria-hidden="true" />
          <span>Pinte a área a alterar</span>
          {strokeCount > 0 && (
            <span className="font-mono-num text-[11px] text-violet-700 dark:text-[#C4B5FD]">
              ({strokeCount} {strokeCount === 1 ? 'traço' : 'traços'})
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div
            role="group"
            aria-label="Tamanho do pincel"
            className="inline-flex rounded-lg border border-slate-300 dark:border-white/15 bg-slate-100 dark:bg-[#17171F] p-0.5"
          >
            {(['sm', 'md', 'lg'] as BrushSize[]).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setBrushSize(size)}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                  brushSize === size
                    ? 'bg-[#7C3AED] text-white'
                    : 'text-slate-700 hover:text-slate-950 dark:text-[#A1A1AA] dark:hover:text-white'
                }`}
              >
                {size === 'sm' ? 'P' : size === 'md' ? 'M' : 'G'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleUndo}
            disabled={strokeCount === 0}
            aria-label="Desfazer último traço"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-medium text-slate-800 hover:border-violet-600 disabled:opacity-40 dark:border-white/15 dark:bg-[#17171F] dark:text-[#A1A1AA] dark:hover:text-white"
          >
            <RotateCcw className="w-3 h-3" aria-hidden="true" />
            <span>Desfazer</span>
          </button>

          <button
            type="button"
            onClick={handleClear}
            disabled={strokeCount === 0}
            aria-label="Limpar seleção"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-medium text-slate-800 hover:border-violet-600 disabled:opacity-40 dark:border-white/15 dark:bg-[#17171F] dark:text-[#A1A1AA] dark:hover:text-white"
          >
            <Trash2 className="w-3 h-3" aria-hidden="true" />
            <span>Limpar</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#7C3AED] text-[11px] font-semibold text-white hover:brightness-110"
          >
            <Check className="w-3 h-3" aria-hidden="true" />
            <span>Pronto</span>
          </button>
        </div>
      </div>
    </>
  );
}
