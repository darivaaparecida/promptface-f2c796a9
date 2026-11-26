export type ToastVariant = 'success' | 'info' | 'error';

export interface ToastInput {
  id?: string;
  variant?: ToastVariant;
  title: string;
  description?: string;
  durationMs?: number;
}

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  durationMs: number;
  createdAt: number;
}

export const MAX_VISIBLE_TOASTS = 4;
export const DEFAULT_TOAST_DURATION_MS = 5000;

export function enqueueToast(
  queue: ToastItem[],
  input: ToastInput,
  now = Date.now(),
  maxItems = MAX_VISIBLE_TOASTS
): { queue: ToastItem[]; item: ToastItem } {
  const id =
    input.id && input.id.trim().length > 0
      ? input.id.trim()
      : `toast-${now}-${Math.random().toString(36).slice(2, 8)}`;

  const item: ToastItem = {
    id,
    variant: input.variant ?? 'success',
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    durationMs:
      typeof input.durationMs === 'number' && input.durationMs >= 0
        ? input.durationMs
        : DEFAULT_TOAST_DURATION_MS,
    createdAt: now,
  };

  const nextQueue = [...queue.filter((existing) => existing.id !== id), item];
  const trimmed =
    nextQueue.length > maxItems
      ? nextQueue.slice(nextQueue.length - maxItems)
      : nextQueue;

  return { queue: trimmed, item };
}

export function dismissToast(queue: ToastItem[], id: string): ToastItem[] {
  return queue.filter((item) => item.id !== id);
}
