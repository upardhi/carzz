'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Note } from '@/components/ui/primitives';
import type { Role } from '@/lib/data/types';
import { ROLE_BLURB, ROLE_LABEL } from '@/lib/util/labels';

const ASSIGNABLE: Role[] = ['AREA_ADMIN', 'MANAGER', 'EMPLOYEE'];

export function AddUserForm({
  regions,
  areas,
}: {
  regions: { id: string; name: string }[];
  areas: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [role, setRole] = useState<Role>('MANAGER');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [regionId, setRegionId] = useState(regions[0]?.id ?? '');
  const [areaId, setAreaId] = useState(areas[0]?.id ?? '');
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<{ ok?: string; error?: string }>({});

  const needsArea = role === 'MANAGER' || role === 'EMPLOYEE';
  const needsRegion = role === 'AREA_ADMIN';

  const valid =
    name.trim().length > 1 &&
    /.+@.+\..+/.test(email) &&
    phone.trim().length > 5 &&
    password.length >= 6 &&
    (!needsArea || areaId) &&
    (!needsRegion || regionId);

  async function submit() {
    setPending(true);
    setState({});
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name, email, phone, password, role,
          areaId: needsArea ? areaId : undefined,
          regionId: needsRegion ? regionId : undefined,
        }),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setState({ error: data.error ?? 'Could not add that person.' });
        return;
      }
      setState({ ok: data.message ?? 'Added.' });
      setName(''); setEmail(''); setPhone(''); setPassword('');
      router.refresh();
    } catch {
      setState({ error: 'No connection.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <label className="field-label" htmlFor="u-role">Role</label>
      <select
        id="u-role"
        className="field"
        value={role}
        onChange={(e) => setRole(e.target.value as Role)}
      >
        {ASSIGNABLE.map((r) => (
          <option key={r} value={r}>{ROLE_LABEL[r]}</option>
        ))}
      </select>
      <p className="mt-1 text-xs text-ink-mute">{ROLE_BLURB[role]}</p>

      <label className="field-label mt-2" htmlFor="u-name">Name</label>
      <input id="u-name" className="field" value={name} onChange={(e) => setName(e.target.value)} />

      <label className="field-label mt-2" htmlFor="u-email">Login email</label>
      <input id="u-email" className="field" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />

      <label className="field-label mt-2" htmlFor="u-phone">Mobile</label>
      <input id="u-phone" className="field" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />

      <label className="field-label mt-2" htmlFor="u-pass">Starting password</label>
      <input id="u-pass" className="field" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />

      {needsRegion ? (
        <>
          <label className="field-label mt-2" htmlFor="u-region">Region</label>
          <select id="u-region" className="field" value={regionId} onChange={(e) => setRegionId(e.target.value)}>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </>
      ) : null}

      {needsArea ? (
        <>
          <label className="field-label mt-2" htmlFor="u-area">Area</label>
          <select id="u-area" className="field" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </>
      ) : null}

      <Button block className="mt-3" disabled={!valid || pending} onClick={submit}>
        {pending ? 'Adding…' : `Add ${ROLE_LABEL[role].toLowerCase()}`}
      </Button>

      {state.ok ? <div className="mt-2"><Note tone="success">{state.ok}</Note></div> : null}
      {state.error ? <div className="mt-2"><Note tone="danger">{state.error}</Note></div> : null}
    </div>
  );
}
