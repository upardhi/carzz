'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button, Card, Note, Row } from '@/components/ui/primitives';
import {
  LEAD_SOURCES,
  WEEKDAY_PATTERNS,
  type LeadSource,
  type PaymentMode,
  type WeekdayPattern,
} from '@/lib/data/types';
import { money } from '@/lib/util/format';
import {
  LEAD_SOURCE_LABEL,
  PATTERN_LABEL,
  PAYMENT_MODE_LABEL,
} from '@/lib/util/labels';

interface CarDraft {
  model: string;
  make: string;
  colour: string;
  plate: string;
  packageId: string;
  scheduleTime: string;
  specialInstructions: string;
}

export interface IntakeOptions {
  areas: { id: string; name: string }[];
  packages: { id: string; name: string; price: number; washesPerMonth: number }[];
  staff: { id: string; name: string; areaId: string }[];
  defaultAreaId: string;
}

const SLOTS = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '17:00', '17:30', '18:00', '18:30',
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 mt-6 border-b border-line pb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-ink-soft first:mt-0">
      {children}
    </h2>
  );
}

/**
 * Adding a customer, on one page.
 *
 * This was a five-step wizard, which meant four "Next" taps before anything
 * could be saved — for a manager who does this several times a week that is
 * pure overhead. It is one form now: everything visible, one Save. Nothing
 * was dropped, and the lead source is still required, but it is enforced on
 * submit rather than by blocking the way forward.
 */
export function AddCustomerForm({
  options,
  onSavedHref,
}: {
  options: IntakeOptions;
  onSavedHref: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<HTMLDivElement>(null);

  const [source, setSource] = useState<LeadSource | ''>('');
  const [referredById, setReferredById] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [note, setNote] = useState('');
  const [areaId, setAreaId] = useState(options.defaultAreaId);
  const [pattern, setPattern] = useState<WeekdayPattern>('MON_THU');
  const [assignedStaffId, setAssignedStaffId] = useState('');
  const [advance, setAdvance] = useState('0');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('CASH');

  const [cars, setCars] = useState<CarDraft[]>([
    {
      model: '', make: '', colour: '', plate: '',
      packageId: options.packages[0]?.id ?? '',
      scheduleTime: '09:00', specialInstructions: '',
    },
  ]);

  const areaStaff = options.staff.filter((s) => s.areaId === areaId);
  const monthly = cars.reduce(
    (sum, car) => sum + (options.packages.find((p) => p.id === car.packageId)?.price ?? 0),
    0,
  );
  const washes = cars.reduce(
    (sum, car) =>
      sum + (options.packages.find((p) => p.id === car.packageId)?.washesPerMonth ?? 0),
    0,
  );

  const updateCar = (index: number, patch: Partial<CarDraft>) =>
    setCars((current) => current.map((car, i) => (i === index ? { ...car, ...patch } : car)));

  async function save() {
    if (!source) {
      setError('Choose where this customer came from — it is the only record of what your marketing is worth.');
      sourceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (name.trim().length < 2 || phone.trim().length < 6 || address.trim().length < 4) {
      setError('Name, mobile number and address are needed.');
      return;
    }
    if (cars.some((c) => !c.make.trim() || !c.model.trim() || c.plate.trim().length < 4)) {
      setError('Each car needs a company, a model and a number.');
      return;
    }

    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/ops/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          source,
          referredById: referredById || undefined,
          name, phone,
          altPhone: altPhone || undefined,
          address,
          landmark: landmark || undefined,
          note: note || undefined,
          areaId,
          schedulePattern: pattern,
          assignedStaffId: assignedStaffId || undefined,
          advance: Number(advance) || 0,
          paymentMode,
          cars: cars.map((car) => ({
            ...car,
            colour: car.colour || 'Not noted',
            specialInstructions: car.specialInstructions || undefined,
          })),
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        customer?: { id: string };
      };
      if (!response.ok || !data.customer) {
        setError(data.error ?? 'Could not save this customer.');
        return;
      }
      router.push(`${onSavedHref}/${data.customer.id}`);
      router.refresh();
    } catch {
      setError('No connection. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <Card className="p-5">
        <div ref={sourceRef}>
          <SectionTitle>Where did they come from?</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {LEAD_SOURCES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={source === option}
                onClick={() => setSource(option)}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                  source === option
                    ? 'border-navy-800 bg-navy-800 text-white'
                    : 'border-line-strong bg-white text-ink hover:border-navy-400'
                }`}
              >
                {LEAD_SOURCE_LABEL[option]}
              </button>
            ))}
          </div>

          {source === 'STAFF_REF' ? (
            <label className="mt-3 block">
              <span className="field-label">Which wash boy referred them?</span>
              <select className="field" value={referredById}
                onChange={(e) => setReferredById(e.target.value)}>
                <option value="">Choose…</option>
                {areaStaff.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <SectionTitle>Customer</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="field-label">Full name</span>
            <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            <span className="field-label">WhatsApp number</span>
            <input className="field" inputMode="tel" value={phone}
              onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label>
            <span className="field-label">Alternate number</span>
            <input className="field" inputMode="tel" value={altPhone}
              onChange={(e) => setAltPhone(e.target.value)} />
          </label>
          <label>
            <span className="field-label">Nearby landmark</span>
            <input className="field" value={landmark}
              onChange={(e) => setLandmark(e.target.value)} />
          </label>
          <label className="sm:col-span-2">
            <span className="field-label">Address</span>
            <textarea className="field" rows={2} value={address}
              onChange={(e) => setAddress(e.target.value)} />
          </label>
          <label className="sm:col-span-2">
            <span className="field-label">Note for the wash boy</span>
            <input className="field" value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Ring the bell. Dog in compound. Park at gate side." />
          </label>
          {options.areas.length > 1 ? (
            <label>
              <span className="field-label">Area</span>
              <select className="field" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                {options.areas.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <SectionTitle>Cars</SectionTitle>
        {cars.map((car, index) => (
          <div key={index} className="mb-3 rounded-lg border border-line bg-surface-muted p-3">
            <div className="mb-2 flex items-center justify-between">
              <b className="text-sm">Car {index + 1}</b>
              {cars.length > 1 ? (
                <button type="button" className="text-xs font-bold text-danger-500"
                  onClick={() => setCars((c) => c.filter((_, i) => i !== index))}>
                  Remove
                </button>
              ) : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <input className="field" value={car.make} placeholder="Company — Maruti"
                onChange={(e) => updateCar(index, { make: e.target.value })} />
              <input className="field" value={car.model} placeholder="Model — Swift"
                onChange={(e) => updateCar(index, { model: e.target.value })} />
              <input className="field" value={car.colour} placeholder="Colour — White"
                onChange={(e) => updateCar(index, { colour: e.target.value })} />
              <input className="field uppercase" value={car.plate} placeholder="MH31 AB 4412"
                onChange={(e) => updateCar(index, { plate: e.target.value })} />
              <select className="field" value={car.packageId}
                onChange={(e) => updateCar(index, { packageId: e.target.value })}>
                {options.packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {p.washesPerMonth} washes — {money(p.price)}
                  </option>
                ))}
              </select>
              <select className="field" value={car.scheduleTime}
                onChange={(e) => updateCar(index, { scheduleTime: e.target.value })}>
                {SLOTS.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
              </select>
            </div>
          </div>
        ))}
        <Button variant="secondary" size="sm"
          onClick={() =>
            setCars((c) => [
              ...c,
              {
                model: '', make: '', colour: '', plate: '',
                packageId: options.packages[0]?.id ?? '',
                // The next slot along, so one visit covers both cars.
                scheduleTime: SLOTS[Math.min(SLOTS.indexOf(c[c.length - 1].scheduleTime) + 1, SLOTS.length - 1)],
                specialInstructions: 'Second car — same building',
              },
            ])
          }>
          + Another car
        </Button>

        <SectionTitle>Schedule and payment</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="field-label">Wash days</span>
            <select className="field" value={pattern}
              onChange={(e) => setPattern(e.target.value as WeekdayPattern)}>
              {WEEKDAY_PATTERNS.map((p) => (
                <option key={p} value={p}>{PATTERN_LABEL[p]}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Wash boy</span>
            <select className="field" value={assignedStaffId}
              onChange={(e) => setAssignedStaffId(e.target.value)}>
              <option value="">Decide later</option>
              {areaStaff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label>
            <span className="field-label">Advance taken</span>
            <input className="field" type="number" inputMode="numeric" value={advance}
              onChange={(e) => setAdvance(e.target.value)} />
          </label>
          <label>
            <span className="field-label">Paid by</span>
            <select className="field" value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}>
              {(['CASH', 'MANUAL_UPI', 'GATEWAY'] as PaymentMode[]).map((m) => (
                <option key={m} value={m}>{PAYMENT_MODE_LABEL[m]}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 rounded-lg border border-line bg-surface-muted p-3">
          <Row label="Cars" value={cars.length} />
          <Row label="Washes a month" value={washes} />
          <Row label="Monthly" value={money(monthly)} />
          <Row label="Advance" value={money(Number(advance) || 0)} />
        </div>

        {error ? (
          <div className="mt-3"><Note tone="danger">{error}</Note></div>
        ) : null}

        <Button className="mt-4" size="lg" block disabled={pending} onClick={save}>
          {pending ? 'Saving…' : `Save customer and create ${washes} washes`}
        </Button>
      </Card>
    </div>
  );
}
