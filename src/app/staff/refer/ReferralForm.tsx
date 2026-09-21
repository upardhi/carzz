'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Note } from '@/components/ui/primitives';
import { safeOfflineFetch } from '@/lib/util/offlineQueue';

export function ReferralForm() {
  const router = useRouter();
  const [type, setType] = useState<'CUSTOMER' | 'STAFF'>('CUSTOMER');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [state, setState] = useState<{ ok?: string; error?: string }>({});
  const [pending, setPending] = useState(false);

  async function submit() {
    if (name.trim().length < 2) {
      setState({ error: 'Please enter a name.' });
      return;
    }
    if (phone.trim().length < 6) {
      setState({ error: 'Please enter a valid phone number.' });
      return;
    }
    setPending(true);
    setState({});
    try {
      const result = await safeOfflineFetch<{ message?: string; error?: string }>('/api/staff/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { type, name: name.trim(), phone: phone.trim(), note: note.trim() || undefined },
        label: `Referral for ${name.trim()}`,
      });

      if (!result.ok) {
        setState({ error: result.error ?? 'Could not submit your referral.' });
        return;
      }

      if (result.queuedOffline) {
        setState({ ok: 'Saved offline! Will submit automatically when you are back online.' });
      } else {
        setState({ ok: result.data?.message ?? 'Referral submitted.' });
        setName('');
        setPhone('');
        setNote('');
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
      <div className="mb-3 flex gap-2">
        {(['CUSTOMER', 'STAFF'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`flex-1 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all ${
              type === t
                ? 'border-2 border-emerald-600 bg-emerald-50 text-emerald-900'
                : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t === 'CUSTOMER' ? '🚗 New Customer' : '👷 New Wash Boy'}
          </button>
        ))}
      </div>

      <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-700">Their name</label>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Full name"
        className="field mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-[13.5px] text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
      />

      <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-700">Their phone number</label>
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="10-digit mobile number"
        className="field mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-[13.5px] text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
      />

      <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-700">
        Anything else? (optional)
      </label>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="e.g. lives in the same building, wants a wash on weekends"
        className="field mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-[13.5px] text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
      />

      <button
        type="button"
        disabled={pending}
        onClick={submit}
        className="w-full rounded-xl bg-[#214f92] py-3 text-[14px] font-semibold text-white shadow-xs transition-all hover:bg-[#1a3f75] active:scale-[0.99] disabled:opacity-50"
      >
        {pending ? 'Sending…' : 'Submit referral'}
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
