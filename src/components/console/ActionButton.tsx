'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/primitives';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold';

/**
 * A button that posts a JSON action and refreshes the page.
 *
 * Nearly every console control is this shape, so keeping it in one place means
 * consistent pending, error and confirmation behaviour rather than each screen
 * inventing its own.
 */
export function ActionButton({
  endpoint,
  payload,
  children,
  variant = 'primary',
  size = 'sm',
  confirm,
  onDone,
}: {
  endpoint: string;
  payload: Record<string, unknown>;
  children: ReactNode;
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  /** Shown in a confirm dialog for anything hard to undo. */
  confirm?: string;
  onDone?: (result: { message?: string }) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function run() {
    if (confirm && !window.confirm(confirm)) return;
    setPending(true);
    setFeedback(null);
    setFailed(false);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setFailed(true);
        setFeedback(data.error ?? 'That did not work.');
        return;
      }
      setFeedback(data.message ?? null);
      onDone?.(data);
      router.refresh();
    } catch {
      setFailed(true);
      setFeedback('No connection. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button variant={variant} size={size} disabled={pending} onClick={run}>
        {pending ? 'Working…' : children}
      </Button>
      {feedback ? (
        <span
          role="status"
          className={`text-[11px] font-semibold ${failed ? 'text-danger-500' : 'text-teal-600'}`}
        >
          {feedback}
        </span>
      ) : null}
    </span>
  );
}
