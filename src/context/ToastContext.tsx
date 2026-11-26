import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  dismissToast as removeToastFromQueue,
  enqueueToast,
  type ToastInput,
  type ToastItem,
} from '../shared/toastQueue';

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (input: ToastInput) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const existingTimer = timersRef.current.get(id);
    if (existingTimer !== undefined) {
      window.clearTimeout(existingTimer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => removeToastFromQueue(prev, id));
  }, []);

  const addToast = useCallback(
    (input: ToastInput): string => {
      let createdId = input.id?.trim() || '';
      let createdDuration = 5000;

      setToasts((prev) => {
        const result = enqueueToast(prev, input);
        createdId = result.item.id;
        createdDuration = result.item.durationMs;
        return result.queue;
      });

      const oldTimer = createdId ? timersRef.current.get(createdId) : undefined;
      if (oldTimer !== undefined) {
        window.clearTimeout(oldTimer);
        timersRef.current.delete(createdId);
      }

      if (createdId && createdDuration > 0) {
        const timer = window.setTimeout(() => {
          timersRef.current.delete(createdId);
          setToasts((prev) => removeToastFromQueue(prev, createdId));
        }, createdDuration);
        timersRef.current.set(createdId, timer);
      }

      return createdId;
    },
    []
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) {
        window.clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast deve ser utilizado dentro de ToastProvider');
  }
  return ctx;
}
