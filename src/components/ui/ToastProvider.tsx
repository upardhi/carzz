'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { IconAlert, IconCheck, IconClose, IconInfo } from '@/components/shell/icons';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: ReactNode;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => string;
  removeToast: (id: string) => void;
  toast: {
    success: (message: ReactNode, options?: { title?: string; duration?: number }) => string;
    error: (message: ReactNode, options?: { title?: string; duration?: number }) => string;
    warning: (message: ReactNode, options?: { title?: string; duration?: number }) => string;
    info: (message: ReactNode, options?: { title?: string; duration?: number }) => string;
  };
}

const ToastContext = createContext<ToastContextType | null>(null);

let globalAddToast: ((toast: Omit<ToastItem, 'id'>) => string) | null = null;

export const toast = {
  success: (message: ReactNode, options?: { title?: string; duration?: number }) => {
    return globalAddToast?.({ type: 'success', message, title: options?.title, duration: options?.duration }) ?? '';
  },
  error: (message: ReactNode, options?: { title?: string; duration?: number }) => {
    return globalAddToast?.({ type: 'error', message, title: options?.title, duration: options?.duration }) ?? '';
  },
  warning: (message: ReactNode, options?: { title?: string; duration?: number }) => {
    return globalAddToast?.({ type: 'warning', message, title: options?.title, duration: options?.duration }) ?? '';
  },
  info: (message: ReactNode, options?: { title?: string; duration?: number }) => {
    return globalAddToast?.({ type: 'info', message, title: options?.title, duration: options?.duration }) ?? '';
  },
};

const TOAST_THEMES: Record<
  ToastType,
  {
    card: string;
    iconBg: string;
    title: string;
    message: string;
    close: string;
    icon: ReactNode;
    defaultTitle: string;
  }
> = {
  success: {
    card: 'bg-emerald-50/95 border border-emerald-200 border-l-4 border-l-emerald-500 text-slate-800 shadow-lg shadow-emerald-950/5',
    iconBg: 'bg-emerald-500 text-white',
    title: 'text-emerald-800',
    message: 'text-slate-700',
    close: 'text-slate-400 hover:text-emerald-900 hover:bg-emerald-100/70',
    icon: <IconCheck width={15} height={15} strokeWidth={3} />,
    defaultTitle: 'Success!',
  },
  error: {
    card: 'bg-rose-50/95 border border-rose-200 border-l-4 border-l-rose-500 text-slate-800 shadow-lg shadow-rose-950/5',
    iconBg: 'bg-rose-500 text-white',
    title: 'text-rose-800',
    message: 'text-slate-700',
    close: 'text-slate-400 hover:text-rose-900 hover:bg-rose-100/70',
    icon: <IconClose width={15} height={15} strokeWidth={2.6} />,
    defaultTitle: 'Error!',
  },
  warning: {
    card: 'bg-amber-50/95 border border-amber-200 border-l-4 border-l-amber-500 text-slate-800 shadow-lg shadow-amber-950/5',
    iconBg: 'bg-amber-500 text-white',
    title: 'text-amber-900',
    message: 'text-slate-700',
    close: 'text-slate-400 hover:text-amber-950 hover:bg-amber-100/70',
    icon: <IconAlert width={15} height={15} strokeWidth={2.6} />,
    defaultTitle: 'Warning!',
  },
  info: {
    card: 'bg-sky-50/95 border border-sky-200 border-l-4 border-l-sky-500 text-slate-800 shadow-lg shadow-sky-950/5',
    iconBg: 'bg-sky-500 text-white',
    title: 'text-sky-800',
    message: 'text-slate-700',
    close: 'text-slate-400 hover:text-sky-900 hover:bg-sky-100/70',
    icon: <IconInfo width={15} height={15} strokeWidth={2.6} />,
    defaultTitle: 'Info',
  },
};

function ToastElement({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  useEffect(() => {
    const duration = item.duration ?? 4000;
    if (duration <= 0) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [item.duration, onClose]);

  const cfg = TOAST_THEMES[item.type] || TOAST_THEMES.info;
  const title = item.title || cfg.defaultTitle;

  return (
    <div
      role="alert"
      className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl p-3.5 shadow-xl backdrop-blur-md transition-all animate-slide-in ${cfg.card}`}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full shadow-sm ${cfg.iconBg}`}
      >
        {cfg.icon}
      </div>

      <div className="min-w-0 flex-1 pt-0.5">
        <div className={`text-sm font-bold leading-none ${cfg.title}`}>
          {title}
        </div>
        <div className={`mt-1 text-xs sm:text-sm font-medium leading-snug ${cfg.message}`}>
          {item.message}
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className={`-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${cfg.close}`}
        aria-label="Dismiss"
      >
        <IconClose width={15} height={15} strokeWidth={2} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toastData: Omit<ToastItem, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newItem: ToastItem = { ...toastData, id };
    setToasts((prev) => [...prev.slice(-4), newItem]);
    return id;
  }, []);

  useEffect(() => {
    globalAddToast = addToast;
    return () => {
      globalAddToast = null;
    };
  }, [addToast]);

  const toastHelpers = {
    success: (message: ReactNode, options?: { title?: string; duration?: number }) =>
      addToast({ type: 'success', message, title: options?.title, duration: options?.duration }),
    error: (message: ReactNode, options?: { title?: string; duration?: number }) =>
      addToast({ type: 'error', message, title: options?.title, duration: options?.duration }),
    warning: (message: ReactNode, options?: { title?: string; duration?: number }) =>
      addToast({ type: 'warning', message, title: options?.title, duration: options?.duration }),
    info: (message: ReactNode, options?: { title?: string; duration?: number }) =>
      addToast({ type: 'info', message, title: options?.title, duration: options?.duration }),
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, toast: toastHelpers }}>
      {children}
      <div
        aria-live="polite"
        className="fixed top-5 right-5 z-50 flex max-w-sm flex-col gap-2.5 pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((t) => (
          <ToastElement key={t.id} item={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      toasts: [],
      addToast: () => '',
      removeToast: () => {},
      toast,
    };
  }
  return context;
}
