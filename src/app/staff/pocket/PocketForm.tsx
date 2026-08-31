'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Note } from '@/components/ui/primitives';
import { money } from '@/lib/util/format';

export function PocketForm({
  available,
  hasPending,
}: {
  available: number;
  hasPending: boolean;
}) {
  const router = useRouter();
  // Default to a round amount inside the limit rather than the whole balance.
  const [amount, setAmount] = useState(
    String(Math.min(500, Math.max(0, Math.floor(available / 100) * 100))),
  );
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<{ ok?: string; error?: string }>({});

  const value = Number(amount) || 0;
  const overCap = value > available;

  async function submit() {
    setPending(true);
    setState({});
    try {
      const response = await fetch('/api/staff/pocket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: value }),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setState({ error: data.error ?? 'Could not send that request.' });
        return;
      }
      setState({ ok: data.message ?? 'Sent.' });
      router.refresh();
    } catch {
      setState({ error: 'No connection. Try again when you have signal.' });
    } finally {
      setPending(false);
    }
  }

  if (hasPending) {
    return (
      <Note>
        You already have a request waiting with your manager. You can send
        another once that one is decided.
      </Note>
    );
  }

  return (
    <div>
      <label className="field-label" htmlFor="pocket-amount">
        Amount
      </label>
      <input
        id="pocket-amount"
        className="field"
        type="number"
        inputMode="numeric"
        min={100}
        step={100}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />

      <Button
        block
        className="mt-2.5"
        disabled={pending || value <= 0}
        onClick={submit}
      >
        {pending ? 'Sending…' : `Request ${money(value)}`}
      </Button>

      {overCap && value > 0 ? (
        <div className="mt-2.5">
          <Note>
            That is above your limit of {money(available)}. You can still send
            it, but your manager has to approve it specially.
          </Note>
        </div>
      ) : null}

      {state.ok ? (
        <div className="mt-2.5">
          <Note tone="success">{state.ok}</Note>
        </div>
      ) : null}
      {state.error ? (
        <div className="mt-2.5">
          <Note tone="danger">{state.error}</Note>
        </div>
      ) : null}
    </div>
  );
}
