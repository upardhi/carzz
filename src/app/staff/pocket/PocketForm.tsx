'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { money } from '@/lib/util/format';
import { safeOfflineFetch } from '@/lib/util/offlineQueue';

export function PocketForm({
  available,
  hasPending,
}: {
  available: number;
  hasPending: boolean;
}) {
  const router = useRouter();
  const defaultAmount = Math.min(500, Math.max(0, Math.floor(available / 100) * 100));
  const [amount, setAmount] = useState(String(defaultAmount));
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<{ ok?: string; error?: string }>({});

  const value = Number(amount) || 0;
  const overCap = value > available;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (value <= 0) return;

    setPending(true);
    setState({});
    try {
      const result = await safeOfflineFetch<{ message?: string; error?: string }>('/api/staff/pocket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { amount: value },
        label: `Pocket money request: ₹${value}`,
      });

      if (!result.ok) {
        setState({ error: result.error ?? 'Could not send that request.' });
        return;
      }

      if (result.queuedOffline) {
        setState({ ok: 'Saved offline! Request will sync automatically when network returns.' });
      } else {
        setState({ ok: result.data?.message ?? `Pocket request for ${money(value)} sent successfully!` });
      }

      router.refresh();
    } catch {
      setState({ error: 'Something unexpected happened.' });
    } finally {
      setPending(false);
    }
  }

  if (hasPending) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-900 flex items-start gap-2.5">
        <span className="text-base">⏳</span>
        <div>
          <b>Request in progress:</b> You already have a pocket money request waiting with your area manager. You can send another request once that one is approved or paid.
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Quick Amount Preset Pills */}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-2">
          Select or Enter Amount
        </label>
        <div className="flex flex-wrap gap-2">
          {[200, 500, 1000, 2000].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(String(preset))}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all border ${
                amount === String(preset)
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-slate-50/60 text-slate-700 hover:bg-slate-100'
              }`}
            >
              ₹{preset}
            </button>
          ))}
          {available > 0 && (
            <button
              type="button"
              onClick={() => setAmount(String(available))}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all border ${
                amount === String(available)
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                  : 'border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              Max: {money(available)}
            </button>
          )}
        </div>
      </div>

      {/* Input Field */}
      <div>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
            ₹
          </span>
          <input
            id="pocket-amount"
            type="number"
            inputMode="numeric"
            min={100}
            step={100}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-8 pr-4 py-2.5 text-sm font-bold text-slate-900 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder="500"
          />
        </div>
      </div>

      {overCap && value > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900">
          ⚠️ <b>Note:</b> {money(value)} is above your immediate weekly limit of {money(available)}. Your area manager can still approve it with special authorization.
        </div>
      )}

      {state.ok && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-800">
          ✓ {state.ok}
        </div>
      )}

      {state.error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800">
          ✕ {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending || value <= 0}
        className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 py-3 text-xs font-bold text-white shadow-sm transition-all disabled:bg-blue-400 disabled:cursor-not-allowed"
      >
        {pending ? 'Submitting request...' : `Request ${money(value)}`}
      </button>
    </form>
  );
}
