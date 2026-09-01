'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/primitives';
import { IconAlert, IconCheck } from '@/components/shell/icons';

export type ConfirmTone = 'primary' | 'danger' | 'warning' | 'gold';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmTone;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

const TONE_BADGES: Record<
  ConfirmTone,
  { bg: string; text: string; border: string; icon: ReactNode; defaultTitle: string }
> = {
  danger: {
    bg: 'bg-rose-50',
    text: 'text-rose-600',
    border: 'border-rose-200',
    icon: <IconAlert width={22} height={22} strokeWidth={2.2} />,
    defaultTitle: 'Are you sure?',
  },
  warning: {
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    border: 'border-amber-200',
    icon: <IconAlert width={22} height={22} strokeWidth={2.2} />,
    defaultTitle: 'Confirmation required',
  },
  gold: {
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    border: 'border-amber-200',
    icon: <IconCheck width={22} height={22} strokeWidth={2.5} />,
    defaultTitle: 'Please confirm',
  },
  primary: {
    bg: 'bg-navy-50',
    text: 'text-navy-700',
    border: 'border-navy-200',
    icon: <IconCheck width={22} height={22} strokeWidth={2.5} />,
    defaultTitle: 'Confirm action',
  },
};

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  tone = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => confirmBtnRef.current?.focus(), 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, loading, onCancel]);

  if (!isOpen) return null;

  const toneConfig = TONE_BADGES[tone] || TONE_BADGES.primary;
  const heading = title || toneConfig.defaultTitle;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/70 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-line bg-white p-6 shadow-float transition-all">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${toneConfig.bg} ${toneConfig.text} ${toneConfig.border}`}
          >
            {toneConfig.icon}
          </div>

          <div className="min-w-0 flex-1 pt-0.5">
            <h3
              id="confirm-dialog-title"
              className="text-base font-extrabold tracking-tight text-navy-950"
            >
              {heading}
            </h3>
            <div className="mt-2 text-sm leading-relaxed text-slate-600">
              {message}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2.5 border-t border-line/70 pt-4">
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={loading}
            onClick={onCancel}
          >
            {cancelText}
          </Button>

          <Button
            ref={confirmBtnRef}
            type="button"
            variant={tone === 'danger' ? 'danger' : tone === 'warning' || tone === 'gold' ? 'gold' : 'primary'}
            size="md"
            disabled={loading}
            onClick={() => onConfirm()}
          >
            {loading ? 'Processing…' : confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}
