'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Note } from '@/components/ui/primitives';
import type { PaymentMode } from '@/lib/data/types';
import { PAYMENT_MODE_LABEL } from '@/lib/util/labels';

export function RecordPaymentForm({
  customerId,
  suggested,
}: {
  customerId: string;
  suggested: number;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(suggested || ''));
  const [mode, setMode] = useState<PaymentMode>('CASH');
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<{ ok?: string; error?: string }>({});

  async function submit() {
    const value = Number(amount);
    if (!value || value <= 0) {
      setState({ error: 'Enter an amount.' });
      return;
    }
    setPending(true);
    setState({});
    try {
      const response = await fetch('/api/ops/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'record', customerId, amount: value, mode }),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setState({ error: data.error ?? 'Could not record that.' });
        return;
      }
      setState({ ok: data.message ?? 'Recorded.' });
      router.refresh();
    } catch {
      setState({ error: 'No connection.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <label className="field-label" htmlFor="pay-amount">
        Record a payment
      </label>
      <div className="flex gap-2">
        <input
          id="pay-amount"
          className="field flex-1"
          type="number"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <select
          aria-label="Payment mode"
          className="field w-36"
          value={mode}
          onChange={(e) => setMode(e.target.value as PaymentMode)}
        >
          {(['CASH', 'MANUAL_UPI', 'GATEWAY'] as PaymentMode[]).map((m) => (
            <option key={m} value={m}>
              {PAYMENT_MODE_LABEL[m]}
            </option>
          ))}
        </select>
      </div>

      <Button block className="mt-2" disabled={pending} onClick={submit}>
        {pending ? 'Recording…' : 'Record payment'}
      </Button>

      {state.ok ? (
        <div className="mt-2">
          <Note tone="teal">{state.ok}</Note>
        </div>
      ) : null}
      {state.error ? (
        <div className="mt-2">
          <Note tone="danger">{state.error}</Note>
        </div>
      ) : null}
    </div>
  );
}
