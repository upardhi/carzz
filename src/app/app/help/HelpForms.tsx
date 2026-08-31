'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Note } from '@/components/ui/primitives';
import { IconStar } from '@/components/shell/icons';
import { COMPLAINT_TYPES, type ComplaintType } from '@/lib/data/types';
import { COMPLAINT_TYPE_LABEL } from '@/lib/util/labels';

export function RateWashForm({
  visitId,
  carLabel,
  dateLabel,
  staffName,
  existingRating,
}: {
  visitId: string;
  carLabel: string;
  dateLabel: string;
  staffName: string | null;
  existingRating: number | null;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(existingRating ?? 0);
  const [comment, setComment] = useState('');
  const [state, setState] = useState<{ ok?: string; error?: string }>({});
  const [pending, setPending] = useState(false);

  async function submit() {
    if (rating < 1) {
      setState({ error: 'Tap a star to give your rating.' });
      return;
    }
    setPending(true);
    setState({});
    try {
      const response = await fetch('/api/customer/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitId, rating, comment: comment || undefined }),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setState({ error: data.error ?? 'Could not save your rating.' });
        return;
      }
      setState({ ok: data.message ?? 'Thank you.' });
      router.refresh();
    } catch {
      setState({ error: 'No connection. Try again when you are back online.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <p className="mb-2 text-[13px] text-ink-mute">
        {carLabel} · {dateLabel}
        {staffName ? ` · by ${staffName}` : ''}
      </p>

      <div className="flex gap-1.5" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={rating === star}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            onClick={() => setRating(star)}
            className={
              star <= rating
                ? 'text-gold-500'
                : 'text-line-strong hover:text-gold-300'
            }
          >
            <IconStar
              width={30}
              height={30}
              fill={star <= rating ? 'currentColor' : 'none'}
            />
          </button>
        ))}
      </div>

      <textarea
        className="field mt-3"
        rows={2}
        placeholder="Anything you want to tell us? (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />

      <Button block className="mt-2.5" disabled={pending} onClick={submit}>
        {pending ? 'Sending…' : 'Submit rating'}
      </Button>

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

export function ComplaintForm() {
  const router = useRouter();
  const [type, setType] = useState<ComplaintType>('WASH_QUALITY');
  const [body, setBody] = useState('');
  const [state, setState] = useState<{ ok?: string; error?: string }>({});
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    setState({});
    try {
      const response = await fetch('/api/customer/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, body }),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setState({ error: data.error ?? 'Could not send your complaint.' });
        return;
      }
      setState({ ok: data.message ?? 'Sent.' });
      setBody('');
      router.refresh();
    } catch {
      setState({ error: 'No connection. Try again when you are back online.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <label className="field-label" htmlFor="complaint-type">
        What went wrong?
      </label>
      <select
        id="complaint-type"
        className="field"
        value={type}
        onChange={(e) => setType(e.target.value as ComplaintType)}
      >
        {COMPLAINT_TYPES.filter((t) => t !== 'REFUND_DEMAND').map((t) => (
          <option key={t} value={t}>
            {COMPLAINT_TYPE_LABEL[t]}
          </option>
        ))}
      </select>

      <label className="field-label mt-3" htmlFor="complaint-body">
        Tell us what happened
      </label>
      <textarea
        id="complaint-body"
        className="field"
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="The more detail you give, the faster your manager can fix it."
      />

      <Button
        block
        variant="secondary"
        className="mt-2.5"
        disabled={pending || body.trim().length < 5}
        onClick={submit}
      >
        {pending ? 'Sending…' : 'Submit complaint'}
      </Button>

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
