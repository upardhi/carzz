'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Note } from '@/components/ui/primitives';
import { EXPENSE_HEADS, type ExpenseHead } from '@/lib/data/types';
import { EXPENSE_HEAD_LABEL } from '@/lib/util/labels';

export function ExpenseForm({
  cycle,
  areas,
}: {
  cycle: string;
  areas: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [head, setHead] = useState<ExpenseHead>('GOODS');
  const [amount, setAmount] = useState('');
  const [areaId, setAreaId] = useState('');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<{ ok?: string; error?: string }>({});

  async function submit() {
    setPending(true);
    setState({});
    try {
      const response = await fetch('/api/admin/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          head,
          amount: Number(amount),
          cycle,
          areaId: areaId || undefined,
          note: note || undefined,
        }),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setState({ error: data.error ?? 'Could not record that.' });
        return;
      }
      setState({ ok: data.message ?? 'Recorded.' });
      setAmount('');
      setNote('');
      router.refresh();
    } catch {
      setState({ error: 'No connection.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <label className="field-label" htmlFor="ex-head">Head</label>
      <select
        id="ex-head"
        className="field"
        value={head}
        onChange={(e) => setHead(e.target.value as ExpenseHead)}
      >
        {/* Staff pay comes from the payout run, so it is not entered by hand. */}
        {EXPENSE_HEADS.filter((h) => h !== 'STAFF_PAYOUT').map((h) => (
          <option key={h} value={h}>
            {EXPENSE_HEAD_LABEL[h]}
          </option>
        ))}
      </select>

      <label className="field-label mt-2" htmlFor="ex-area">Area</label>
      <select
        id="ex-area"
        className="field"
        value={areaId}
        onChange={(e) => setAreaId(e.target.value)}
      >
        <option value="">All areas</option>
        {areas.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>

      <label className="field-label mt-2" htmlFor="ex-amount">Amount</label>
      <input
        id="ex-amount"
        className="field"
        type="number"
        inputMode="numeric"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0"
      />

      <label className="field-label mt-2" htmlFor="ex-note">Note</label>
      <input
        id="ex-note"
        className="field"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. shampoo 40 L, microfibre cloth"
      />

      <Button
        block
        className="mt-3"
        disabled={pending || !(Number(amount) > 0)}
        onClick={submit}
      >
        {pending ? 'Recording…' : 'Add expense'}
      </Button>

      {state.ok ? <div className="mt-2"><Note tone="success">{state.ok}</Note></div> : null}
      {state.error ? <div className="mt-2"><Note tone="danger">{state.error}</Note></div> : null}
    </div>
  );
}
