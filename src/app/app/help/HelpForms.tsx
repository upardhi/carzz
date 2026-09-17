'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Note } from '@/components/ui/primitives';
import { COMPLAINT_TYPES, type ComplaintType } from '@/lib/data/types';
import { COMPLAINT_TYPE_LABEL } from '@/lib/util/labels';
import { safeOfflineFetch } from '@/lib/util/offlineQueue';

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
  const [rating, setRating] = useState(existingRating ?? 4);
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
      const result = await safeOfflineFetch<{ message?: string; error?: string }>('/api/customer/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { visitId, rating, comment: comment || undefined },
        label: `Rating for ${carLabel}`,
      });

      if (!result.ok) {
        setState({ error: result.error ?? 'Could not save your rating.' });
        return;
      }

      if (result.queuedOffline) {
        setState({ ok: 'Saved offline! Rating will sync automatically when you are back online.' });
      } else {
        setState({ ok: result.data?.message ?? 'Thank you. Your rating has been saved.' });
      }

      router.refresh();
    } catch {
      setState({ error: 'Something unexpected happened. Please try again.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <p className="mb-2.5 text-[13px] text-slate-500 font-medium">
        {carLabel} · {dateLabel}
        {staffName ? ` · by ${staffName}` : ''}
      </p>

      {/* 5-Star Interactive Rating */}
      <div className="flex gap-2" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={rating === star}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            onClick={() => setRating(star)}
            className="text-[32px] leading-none transition-transform active:scale-95 focus:outline-none"
            style={{ color: star <= rating ? '#eab308' : '#cbd5e1' }}
          >
            ★
          </button>
        ))}
      </div>

      <textarea
        className="field mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-[13.5px] text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
        rows={2}
        placeholder="Anything you want to tell us? (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />

      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="mt-3 w-full rounded-xl bg-[#214f92] py-3 text-[14px] font-semibold text-white shadow-xs transition-all hover:bg-[#1a3f75] active:scale-[0.99] disabled:opacity-50"
      >
        {pending ? 'Sending…' : 'Submit rating'}
      </button>


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

export interface ComplaintCarOption {
  id: string;
  make: string;
  model: string;
  plate: string;
}

export function ComplaintForm({ cars = [] }: { cars?: ComplaintCarOption[] }) {
  const router = useRouter();
  const [selectedCarId, setSelectedCarId] = useState<string>(cars[0]?.id || '');
  const [type, setType] = useState<ComplaintType>('WASH_QUALITY');
  const [body, setBody] = useState('');
  const [state, setState] = useState<{ ok?: string; error?: string }>({});
  const [pending, setPending] = useState(false);

  const complaintOptions = COMPLAINT_TYPES.filter((t) => t !== 'REFUND_DEMAND');

  async function submit() {
    setPending(true);
    setState({});
    try {
      const result = await safeOfflineFetch<{ message?: string; error?: string }>('/api/customer/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          carId: selectedCarId || undefined,
          type,
          body,
        },
        label: `Customer complaint (${type})`,
      });

      if (!result.ok) {
        setState({ error: result.error ?? 'Could not send your complaint.' });
        return;
      }

      if (result.queuedOffline) {
        setState({ ok: 'Saved offline! Your complaint is saved and will submit as soon as you are back online.' });
      } else {
        setState({ ok: result.data?.message ?? 'Complaint submitted. Your area manager will review it shortly.' });
      }

      setBody('');
      router.refresh();
    } catch {
      setState({ error: 'Something unexpected happened. Please try again.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      {/* Vehicle Selector if customer has multiple or registered cars */}
      {cars.length > 0 && (
        <div className="mb-3.5">
          <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-700">
            Select vehicle affected
          </label>
          <div className="flex flex-wrap gap-2">
            {cars.map((car) => {
              const isSelected = (selectedCarId || cars[0]?.id) === car.id;
              return (
                <button
                  key={car.id}
                  type="button"
                  onClick={() => setSelectedCarId(car.id)}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12.5px] transition-all ${
                    isSelected
                      ? 'border-2 border-blue-600 bg-blue-50/80 text-blue-900 font-semibold shadow-2xs'
                      : 'border border-slate-200 bg-slate-50 text-slate-600 font-medium hover:bg-slate-100'
                  }`}
                >
                  <span className="text-base leading-none">🚗</span>
                  <span>{car.make} {car.model}</span>
                  <span className="text-[11px] font-semibold text-slate-500">({car.plate})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <label className="mb-2 block text-[12.5px] font-semibold text-slate-700">
        What went wrong?
      </label>

      {/* Selectable category pill chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        {complaintOptions.map((t) => {
          const isSelected = type === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-lg px-3.5 py-1.5 text-[12.5px] transition-all ${
                isSelected
                  ? 'border border-blue-500 bg-blue-50 text-blue-700 font-semibold shadow-xs'
                  : 'border border-slate-200 bg-slate-50 text-slate-600 font-medium hover:bg-slate-100'
              }`}
            >
              {COMPLAINT_TYPE_LABEL[t]}
            </button>
          );
        })}
      </div>

      <label className="mb-2 block text-[12.5px] font-semibold text-slate-700 mt-3" htmlFor="complaint-body">
        Tell us what happened
      </label>
      <textarea
        id="complaint-body"
        className="field w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-[13.5px] text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none min-h-[80px]"
        rows={3}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="The more detail you give, the faster your manager can fix it."
      />

      <button
        type="button"
        disabled={pending || body.trim().length < 5}
        onClick={submit}
        className="mt-3 w-full rounded-xl border border-slate-200 bg-white py-3 text-[14px] font-semibold text-slate-900 shadow-xs transition-all hover:bg-slate-50 active:scale-[0.99] disabled:opacity-50"
      >
        {pending ? 'Sending…' : 'Submit complaint'}
      </button>

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
