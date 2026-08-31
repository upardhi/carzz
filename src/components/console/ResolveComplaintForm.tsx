'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Note } from '@/components/ui/primitives';

const QUICK = [
  'Free re-wash scheduled',
  'Rescheduled, wash returned to count',
  'Receipt re-sent',
  'Slot changed',
  'Spoken to the wash boy',
];

export function ResolveComplaintForm({
  complaintId,
  canEscalate,
}: {
  complaintId: string;
  canEscalate: boolean;
}) {
  const router = useRouter();
  const [resolution, setResolution] = useState('');
  const [pending, setPending] = useState<'resolve' | 'escalate' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(action: 'resolve' | 'escalate') {
    setPending(action);
    setError(null);
    try {
      const response = await fetch('/api/ops/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ complaintId, action, resolution }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? 'That did not work.');
        return;
      }
      router.refresh();
    } catch {
      setError('No connection.');
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {QUICK.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => setResolution(text)}
            className="rounded-pill border border-line-strong bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-mute hover:border-navy-400 hover:text-navy-800"
          >
            {text}
          </button>
        ))}
      </div>

      <label className="sr-only" htmlFor={`res-${complaintId}`}>
        What did you do?
      </label>
      <textarea
        id={`res-${complaintId}`}
        className="field"
        rows={2}
        value={resolution}
        onChange={(e) => setResolution(e.target.value)}
        placeholder="What did you do about it? The customer sees this."
      />

      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          disabled={pending !== null || resolution.trim().length < 3}
          onClick={() => send('resolve')}
        >
          {pending === 'resolve' ? 'Closing…' : 'Reply & close'}
        </Button>
        {canEscalate ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={pending !== null}
            onClick={() => send('escalate')}
          >
            {pending === 'escalate' ? 'Sending…' : 'Escalate to owner'}
          </Button>
        ) : null}
      </div>

      {error ? (
        <div className="mt-2">
          <Note tone="danger">{error}</Note>
        </div>
      ) : null}
    </div>
  );
}
