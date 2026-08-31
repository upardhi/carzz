'use client';

import { useState } from 'react';
import { Button, Note } from '@/components/ui/primitives';

interface Option {
  id: string;
  label: string;
}

/**
 * The booking form. This is the only thing on the site that writes anything,
 * and it is the join between marketing and operations: what it creates lands
 * in the manager's console as a lead.
 */
export function EnquiryForm({
  areas,
  packages,
}: {
  areas: Option[];
  packages: Option[];
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [areaId, setAreaId] = useState('');
  const [locality, setLocality] = useState('');
  const [carCount, setCarCount] = useState('1');
  const [packageId, setPackageId] = useState('');
  const [message, setMessage] = useState('');

  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim().length > 1 && phone.replace(/\D/g, '').length >= 8;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          email: email || undefined,
          areaId: areaId || undefined,
          locality: locality || undefined,
          carCount: Number(carCount) || 1,
          packageId: packageId || undefined,
          message: message || undefined,
        }),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setError(data.error ?? 'Could not send that. Please try again.');
        return;
      }
      setSent(data.message ?? 'Thank you. We will call you shortly.');
    } catch {
      setError('No connection. Please try again, or call us directly.');
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div
        role="status"
        className="rounded-card border border-success-200 bg-success-50 p-6 text-center"
      >
        <p className="text-lg font-extrabold text-success-700">Request received</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{sent}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="field-label" htmlFor="e-name">Your name</label>
        <input id="e-name" className="field" value={name} required
          onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label className="field-label" htmlFor="e-phone">Mobile number</label>
        <input id="e-phone" className="field" inputMode="tel" required value={phone}
          onChange={(e) => setPhone(e.target.value)} placeholder="98xxxxxxxx" />
      </div>

      <div>
        <label className="field-label" htmlFor="e-area">Which area?</label>
        <select id="e-area" className="field" value={areaId}
          onChange={(e) => setAreaId(e.target.value)}>
          <option value="">Not sure / not listed</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="field-label" htmlFor="e-locality">Your building or road</label>
        <input id="e-locality" className="field" value={locality}
          onChange={(e) => setLocality(e.target.value)}
          placeholder="e.g. Sai Residency, near Ram Mandir" />
      </div>

      <div>
        <label className="field-label" htmlFor="e-cars">How many cars?</label>
        <select id="e-cars" className="field" value={carCount}
          onChange={(e) => setCarCount(e.target.value)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>{n}{n === 5 ? '+' : ''}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="field-label" htmlFor="e-package">Package you want</label>
        <select id="e-package" className="field" value={packageId}
          onChange={(e) => setPackageId(e.target.value)}>
          <option value="">Help me choose</option>
          {packages.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </div>

      <div className="sm:col-span-2">
        <label className="field-label" htmlFor="e-email">Email (optional)</label>
        <input id="e-email" className="field" inputMode="email" type="email"
          value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>

      <div className="sm:col-span-2">
        <label className="field-label" htmlFor="e-message">Anything we should know?</label>
        <textarea id="e-message" className="field" rows={3} value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Parking, preferred timing, gate access…" />
      </div>

      {error ? (
        <div className="sm:col-span-2"><Note tone="danger">{error}</Note></div>
      ) : null}

      <div className="sm:col-span-2">
        <Button type="submit" size="lg" block disabled={!valid || pending}>
          {pending ? 'Sending…' : 'Request a call back'}
        </Button>
        <p className="mt-2 text-center text-xs text-ink-mute">
          No payment now. We call you, confirm your slot, and only then start.
        </p>
      </div>
    </form>
  );
}
