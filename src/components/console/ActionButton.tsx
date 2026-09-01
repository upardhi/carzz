'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/primitives';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { useToast } from '@/components/ui/ToastProvider';
import type { ConfirmTone } from '@/components/ui/ConfirmDialog';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';

/**
 * A button that posts a JSON action, shows a toast notification, and refreshes the page.
 */
export function ActionButton({
  endpoint,
  payload,
  children,
  variant = 'primary',
  size = 'sm',
  className,
  block,
  confirm,
  confirmTitle,
  confirmTone,
  confirmText,
  cancelText,
  onDone,
}: {
  endpoint: string;
  payload: Record<string, unknown>;
  children: ReactNode;
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  block?: boolean;
  /** Shown in a confirm modal for anything hard to undo. */
  confirm?: string;
  confirmTitle?: string;
  confirmTone?: ConfirmTone;
  confirmText?: string;
  cancelText?: string;
  onDone?: (result: { message?: string }) => void;
}) {
  const router = useRouter();
  const showConfirm = useConfirm();
  const { toast } = useToast();
  const [pending, setPending] = useState(false);

  async function run() {
    if (confirm) {
      const ok = await showConfirm({
        title: confirmTitle,
        message: confirm,
        tone: confirmTone || (variant === 'danger' ? 'danger' : undefined),
        confirmText,
        cancelText,
      });
      if (!ok) return;
    }
    setPending(true);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      let data: { message?: string; error?: string } = {};
      try {
        data = (await response.json()) as { message?: string; error?: string };
      } catch {
        data = {
          error:
            response.status === 401
              ? 'Session expired. Please sign in again.'
              : response.statusText || 'That did not work.',
        };
      }
      if (!response.ok) {
        toast.error(data.error ?? 'That did not work.');
        return;
      }
      if (data.message) {
        toast.success(data.message);
      }
      onDone?.(data);
      router.refresh();
    } catch {
      toast.error('No connection. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      block={block}
      className={className}
      disabled={pending}
      onClick={run}
    >
      {pending ? 'Working…' : children}
    </Button>
  );
}
