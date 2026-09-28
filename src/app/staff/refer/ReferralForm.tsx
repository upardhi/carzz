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
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string }>({});
  const [state, setState] = useState<{ ok?: string; error?: string }>({});
  const [pending, setPending] = useState(false);

  function handleTabChange(nextType: 'CUSTOMER' | 'STAFF') {
    if (nextType === type) return;
    setType(nextType);
    setName('');
    setPhone('');
    setNote('');
    setFieldErrors({});
    setState({});
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errors: { name?: string; phone?: string } = {};

    if (name.trim().length < 2) {
      errors.name = 'Please enter a name (at least 2 characters).';
    }
    if (!/^\d{10}$/.test(phone.trim())) {
      errors.phone = 'Please enter a valid 10-digit mobile number.';
    }

    if (errors.name || errors.phone) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
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
      }
      setName('');
      setPhone('');
      setNote('');
      setFieldErrors({});
      router.refresh();
    } catch {
      setState({ error: 'Something unexpected happened. Please try again.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="mb-4 flex gap-2">
        {(['CUSTOMER', 'STAFF'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => handleTabChange(t)}
            className={`flex-1 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all cursor-pointer ${
              type === t
                ? 'border-2 border-emerald-600 bg-emerald-50 text-emerald-900'
                : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t === 'CUSTOMER' ? '🚗 New Customer' : '👷 New Wash Boy'}
          </button>
        ))}
      </div>

      <div className="mb-3">
        <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-700">
          Their name
        </label>
        <input
          type="text"
          required
          minLength={2}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (fieldErrors.name) {
              setFieldErrors((prev) => ({ ...prev, name: undefined }));
            }
          }}
          placeholder="Full name"
          aria-invalid={Boolean(fieldErrors.name)}
          className={`field w-full rounded-xl border p-3 text-[13.5px] text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none transition-colors ${
            fieldErrors.name
              ? 'border-rose-400 bg-rose-50/40 focus:border-rose-500'
              : 'border-slate-200 bg-slate-50 focus:border-blue-500'
          }`}
        />
        {fieldErrors.name && (
          <p className="mt-1 text-xs font-semibold text-rose-600">
            {fieldErrors.name}
          </p>
        )}
      </div>

      <div className="mb-3">
        <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-700">
          Their phone number
        </label>
        <input
          type="tel"
          required
          inputMode="numeric"
          pattern="\d{10}"
          maxLength={10}
          value={phone}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
            setPhone(digits);
            if (fieldErrors.phone) {
              setFieldErrors((prev) => ({ ...prev, phone: undefined }));
            }
          }}
          placeholder="10-digit mobile number"
          aria-invalid={Boolean(fieldErrors.phone)}
          className={`field w-full rounded-xl border p-3 text-[13.5px] text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none transition-colors ${
            fieldErrors.phone
              ? 'border-rose-400 bg-rose-50/40 focus:border-rose-500'
              : 'border-slate-200 bg-slate-50 focus:border-blue-500'
          }`}
        />
        {fieldErrors.phone && (
          <p className="mt-1 text-xs font-semibold text-rose-600">
            {fieldErrors.phone}
          </p>
        )}
      </div>

      <div className="mb-3">
        <label className="mb-1.5 block text-[12.5px] font-semibold text-slate-700">
          Anything else? (optional)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="e.g. lives in the same building, wants a wash on weekends"
          className="field w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-[13.5px] text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-[#214f92] py-3 text-[14px] font-semibold text-white shadow-xs transition-all hover:bg-[#1a3f75] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
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
    </form>
  );
}
