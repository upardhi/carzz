'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { ConfirmDialog, type ConfirmTone } from './ConfirmDialog';

export interface ConfirmOptions {
  title?: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmTone;
}

export type ConfirmFunction = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFunction | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback<ConfirmFunction>((options) => {
    return new Promise<boolean>((resolve) => {
      const opts: ConfirmOptions =
        typeof options === 'string' ? { message: options } : options;
      
      // Auto-infer tone if not explicitly provided
      if (!opts.tone && typeof opts.message === 'string') {
        const lower = opts.message.toLowerCase();
        if (lower.includes('deactivate') || lower.includes('delete') || lower.includes('remove') || lower.includes('inactive')) {
          opts.tone = 'danger';
        } else if (lower.includes('cap') || lower.includes('limit') || lower.includes('hold') || lower.includes('warn')) {
          opts.tone = 'warning';
        }
      }

      setDialogState({
        isOpen: true,
        options: opts,
        resolve,
      });
    });
  }, []);

  const handleConfirm = () => {
    dialogState?.resolve(true);
    setDialogState(null);
  };

  const handleCancel = () => {
    dialogState?.resolve(false);
    setDialogState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialogState && (
        <ConfirmDialog
          isOpen={dialogState.isOpen}
          title={dialogState.options.title}
          message={dialogState.options.message}
          confirmText={dialogState.options.confirmText}
          cancelText={dialogState.options.cancelText}
          tone={dialogState.options.tone}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFunction {
  const context = useContext(ConfirmContext);
  if (!context) {
    // Fallback if rendered outside provider: return standard Promise with custom dialog
    return async (options) => {
      const msg = typeof options === 'string' ? options : String(options.message);
      return window.confirm(msg);
    };
  }
  return context;
}
