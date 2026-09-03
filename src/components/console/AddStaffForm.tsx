'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Note } from '@/components/ui/primitives';
import { toast } from '@/components/ui/ToastProvider';
import { money } from '@/lib/util/format';

export function AddStaffForm({
  areas,
  staff,
  referralBonus,
}: {
  areas: { id: string; name: string }[];
  staff: { id: string; name: string }[];
  referralBonus: number;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [areaId, setAreaId] = useState(areas[0]?.id ?? '');
  const [referredByStaffId, setReferredByStaffId] = useState('');
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<{ ok?: string; error?: string }>({});

  async function submit() {
    setPending(true);
    setState({});
    try {
      const response = await fetch('/api/ops/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name, phone, email, password, areaId,
          referredByStaffId: referredByStaffId || undefined,
        }),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        const err = data.error ?? 'Could not add that staff member.';
        setState({ error: err });
        toast.error(err);
        return;
      }
      const msg = data.message ?? 'Added.';
      setState({ ok: msg });
      toast.success(msg);
      setName(''); setPhone(''); setEmail(''); setPassword('');
      setReferredByStaffId('');
      router.refresh();
    } catch {
      setState({ error: 'No connection.' });
      toast.error('No connection.');
    } finally {
      setPending(false);
    }
  }

  const valid =
    name.trim().length > 1 &&
    phone.trim().length > 5 &&
    /.+@.+\..+/.test(email) &&
    password.length >= 6;

  return (
    <div className="space-y-3.5">
      <div>
        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-ink-mute mb-1.5" htmlFor="st-name">
          NAME
        </label>
        <input
          id="st-name"
          className="w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500 transition-colors shadow-2xs"
          placeholder="Enter full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-ink-mute mb-1.5" htmlFor="st-phone">
          MOBILE
        </label>
        <input
          id="st-phone"
          inputMode="tel"
          className="w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500 transition-colors shadow-2xs"
          placeholder="Enter mobile number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-ink-mute mb-1.5" htmlFor="st-email">
          LOGIN EMAIL
        </label>
        <input
          id="st-email"
          inputMode="email"
          className="w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500 transition-colors shadow-2xs"
          placeholder="Enter login email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-ink-mute mb-1.5" htmlFor="st-pass">
          STARTING PASSWORD
        </label>
        <input
          id="st-pass"
          className="w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500 transition-colors shadow-2xs"
          placeholder="At least 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-ink-mute mb-1.5" htmlFor="st-area">
          AREA
        </label>
        <div className="relative">
          <select
            id="st-area"
            className="w-full appearance-none rounded-xl border border-line bg-surface px-3.5 py-2 pr-9 text-sm font-medium text-ink focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500 transition-colors shadow-2xs"
            value={areaId}
            onChange={(e) => setAreaId(e.target.value)}
          >
            {areas.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-ink-faint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-ink-mute mb-1.5" htmlFor="st-ref">
          REFERRED BY
        </label>
        <div className="relative">
          <select
            id="st-ref"
            className="w-full appearance-none rounded-xl border border-line bg-surface px-3.5 py-2 pr-9 text-sm font-medium text-ink focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500 transition-colors shadow-2xs"
            value={referredByStaffId}
            onChange={(e) => setReferredByStaffId(e.target.value)}
          >
            <option value="">Nobody</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({money(referralBonus)} bonus)
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-ink-faint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
        </div>
      </div>

      <button
        type="button"
        disabled={!valid || pending}
        onClick={submit}
        className="w-full rounded-xl bg-navy-900 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-navy-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
      >
        {pending ? 'Adding…' : '+ Add wash boy'}
      </button>

      <div className="mt-3.5 flex items-start gap-2.5 rounded-xl border border-navy-100 bg-navy-50/70 p-3">
        <div className="text-navy-600 shrink-0 mt-0.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
        </div>
        <p className="text-xs font-medium text-navy-900 leading-relaxed">
          An email with login details will be sent to the staff after creating the account.
        </p>
      </div>

      {state.ok ? (
        <div className="mt-2"><Note tone="success">{state.ok}</Note></div>
      ) : null}
      {state.error ? (
        <div className="mt-2"><Note tone="danger">{state.error}</Note></div>
      ) : null}
    </div>
  );
}
