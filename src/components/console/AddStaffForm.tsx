'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Note } from '@/components/ui/primitives';
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
        setState({ error: data.error ?? 'Could not add that staff member.' });
        return;
      }
      setState({ ok: data.message ?? 'Added.' });
      setName(''); setPhone(''); setEmail(''); setPassword('');
      setReferredByStaffId('');
      router.refresh();
    } catch {
      setState({ error: 'No connection.' });
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
    <div>
      <label className="field-label" htmlFor="st-name">Name</label>
      <input id="st-name" className="field" value={name} onChange={(e) => setName(e.target.value)} />

      <label className="field-label mt-2" htmlFor="st-phone">Mobile</label>
      <input id="st-phone" className="field" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />

      <label className="field-label mt-2" htmlFor="st-email">Login email</label>
      <input id="st-email" className="field" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />

      <label className="field-label mt-2" htmlFor="st-pass">Starting password</label>
      <input id="st-pass" className="field" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />

      {areas.length > 1 ? (
        <>
          <label className="field-label mt-2" htmlFor="st-area">Area</label>
          <select id="st-area" className="field" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </>
      ) : null}

      <label className="field-label mt-2" htmlFor="st-ref">Referred by</label>
      <select id="st-ref" className="field" value={referredByStaffId} onChange={(e) => setReferredByStaffId(e.target.value)}>
        <option value="">Nobody</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} ({money(referralBonus)} bonus)
          </option>
        ))}
      </select>

      <Button block className="mt-3" disabled={!valid || pending} onClick={submit}>
        {pending ? 'Adding…' : 'Add wash boy'}
      </Button>

      {state.ok ? (
        <div className="mt-2"><Note tone="success">{state.ok}</Note></div>
      ) : null}
      {state.error ? (
        <div className="mt-2"><Note tone="danger">{state.error}</Note></div>
      ) : null}
    </div>
  );
}
