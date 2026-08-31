'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Note } from '@/components/ui/primitives';
import type { PaymentMode } from '@/lib/data/types';
import { money } from '@/lib/util/format';

const LABELS: Record<PaymentMode, string> = {
  GATEWAY: 'Pay online',
  MANUAL_UPI: 'Pay by UPI (manual)',
  CASH: 'I will pay cash',
};

export function PayActions({
  amount,
  modes,
}: {
  amount: number;
  modes: PaymentMode[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<PaymentMode | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pay(mode: PaymentMode) {
    setPending(mode);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/customer/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, mode }),
      });
      const data = (await response.json()) as {
        message?: string;
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? 'Could not record that payment.');
        return;
      }
      setMessage(data.message ?? 'Recorded.');
      router.refresh();
    } catch {
      setError('No connection. Try again when you are back online.');
    } finally {
      setPending(null);
    }
  }

  if (amount <= 0) {
    return (
      <Note tone="teal">
        Nothing is due right now. You will get a reminder before the next due
        date.
      </Note>
    );
  }

  return (
    <div className="space-y-2">
      {modes.map((mode, index) => (
        <Button
          key={mode}
          block
          variant={index === 0 ? 'primary' : 'secondary'}
          disabled={pending !== null}
          onClick={() => pay(mode)}
        >
          {pending === mode
            ? 'Recording…'
            : mode === 'GATEWAY'
              ? `${LABELS[mode]} · ${money(amount)}`
              : LABELS[mode]}
        </Button>
      ))}

      {message ? <Note tone="teal">{message}</Note> : null}
      {error ? <Note tone="danger">{error}</Note> : null}
    </div>
  );
}
