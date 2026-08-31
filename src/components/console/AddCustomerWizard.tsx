'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Card, Note, Row, Tag } from '@/components/ui/primitives';
import { IconCheck } from '@/components/shell/icons';
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

export interface WizardOptions {
  areas: { id: string; name: string }[];
  packages: { id: string; name: string; price: number; washesPerMonth: number }[];
  staff: { id: string; name: string; areaId: string }[];
  defaultAreaId: string;
}

const SLOTS = [
  '07:00', '07:30', '08:00', '08:30', '09:00',
  '09:30', '10:00', '10:30', '11:00', '11:30',
];

const STEPS = ['Source', 'Details', 'Cars', 'Schedule', 'Payment'];

/**
 * The five-step intake.
 *
 * Step 1 is the lead source and it cannot be skipped: it is the only record of
 * which marketing actually works, and if it is optional it never gets filled
 * in. Saving generates the month's visits so the wash boy's route is live the
 * same day.
 */
export function AddCustomerWizard({
  options,
  onSavedHref,
}: {
  options: WizardOptions;
  onSavedHref: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [source, setSource] = useState<LeadSource | null>(null);
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
    (sum, car) =>
      sum + (options.packages.find((p) => p.id === car.packageId)?.price ?? 0),
    0,
  );
  const washes = cars.reduce(
    (sum, car) =>
      sum +
      (options.packages.find((p) => p.id === car.packageId)?.washesPerMonth ?? 0),
    0,
  );

  const stepValid = (() => {
    if (step === 1) return source !== null;
    if (step === 2) {
      return name.trim().length > 1 && phone.trim().length > 5 && address.trim().length > 3;
    }
    if (step === 3) {
      return cars.every(
        (c) => c.model.trim() && c.make.trim() && c.colour.trim() && c.plate.trim().length > 3,
      );
    }
    return true;
  })();

  function updateCar(index: number, patch: Partial<CarDraft>) {
    setCars((current) =>
      current.map((car, i) => (i === index ? { ...car, ...patch } : car)),
    );
  }

  async function save() {
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
    <Card className="max-w-3xl p-5">
      <ol className="mb-4 flex gap-1.5" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li key={label} className="flex-1">
            <div
              className={`h-1.5 rounded-pill ${i < step ? 'bg-teal-500' : 'bg-line-strong'}`}
            />
            <span
              className={`mt-1 block text-[10px] font-bold uppercase tracking-wide ${
                i < step ? 'text-teal-600' : 'text-ink-faint'
              }`}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      <h2 className="mb-3 text-base font-extrabold">
        Step {step} of 5 — {STEPS[step - 1]}
      </h2>

      {step === 1 ? (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <p className="text-sm text-ink-mute">
              Where did this customer come from?
            </p>
            <Tag tone="bad">Compulsory</Tag>
          </div>
          <p className="mb-3 text-xs text-ink-mute">
            This cannot be skipped — it is how the owner learns which marketing
            actually brings customers who stay.
          </p>

          {LEAD_SOURCES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={source === option}
              onClick={() => setSource(option)}
              className="flex w-full items-center gap-3 border-b border-line-soft py-2.5 text-left text-sm last:border-0"
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                  source === option
                    ? 'border-teal-500 bg-teal-500 text-white'
                    : 'border-line-strong'
                }`}
              >
                {source === option ? (
                  <IconCheck width={12} height={12} strokeWidth={3} />
                ) : null}
              </span>
              {LEAD_SOURCE_LABEL[option]}
            </button>
          ))}

          {source === 'STAFF_REF' ? (
            <div className="mt-3">
              <label className="field-label" htmlFor="referrer">
                Which wash boy referred them? (their bonus depends on it)
              </label>
              <select
                id="referrer"
                className="field"
                value={referredById}
                onChange={(e) => setReferredById(e.target.value)}
              >
                <option value="">Choose…</option>
                {areaStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="c-name">Full name</label>
            <input id="c-name" className="field" value={name} onChange={(e) => setName(e.target.value)} />

            <label className="field-label mt-3" htmlFor="c-phone">WhatsApp number</label>
            <input id="c-phone" className="field" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />

            <label className="field-label mt-3" htmlFor="c-alt">Alternate number</label>
            <input id="c-alt" className="field" inputMode="tel" value={altPhone} onChange={(e) => setAltPhone(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="c-address">Address</label>
            <textarea id="c-address" className="field" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />

            <label className="field-label mt-3" htmlFor="c-landmark">Nearby landmark</label>
            <input id="c-landmark" className="field" value={landmark} onChange={(e) => setLandmark(e.target.value)} />

            <label className="field-label mt-3" htmlFor="c-note">Note for the wash boy</label>
            <input id="c-note" className="field" placeholder="Ring the bell, dog in compound…" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {options.areas.length > 1 ? (
            <div>
              <label className="field-label" htmlFor="c-area">Area</label>
              <select id="c-area" className="field" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                {options.areas.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      ) : null}

      {step === 3 ? (
        <div>
          {cars.map((car, index) => (
            <div key={index} className="mb-3 rounded-lg border border-line bg-surface-muted p-3">
              <div className="mb-2 flex items-center justify-between">
                <b className="text-sm">Car {index + 1}</b>
                {cars.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => setCars((c) => c.filter((_, i) => i !== index))}
                    className="text-xs font-bold text-danger-500"
                  >
                    Remove
                  </button>
                ) : null}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="field-label">Company</label>
                  <input className="field" value={car.make} onChange={(e) => updateCar(index, { make: e.target.value })} placeholder="Maruti" />
                </div>
                <div>
                  <label className="field-label">Model</label>
                  <input className="field" value={car.model} onChange={(e) => updateCar(index, { model: e.target.value })} placeholder="Swift" />
                </div>
                <div>
                  <label className="field-label">Colour</label>
                  <input className="field" value={car.colour} onChange={(e) => updateCar(index, { colour: e.target.value })} placeholder="White" />
                </div>
                <div>
                  <label className="field-label">Car number</label>
                  <input className="field uppercase" value={car.plate} onChange={(e) => updateCar(index, { plate: e.target.value })} placeholder="MH31 AB 4412" />
                </div>
                <div className="sm:col-span-2">
                  <label className="field-label">Package for this car</label>
                  <select className="field" value={car.packageId} onChange={(e) => updateCar(index, { packageId: e.target.value })}>
                    {options.packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.washesPerMonth} washes — {money(p.price)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}

          <Button
            variant="secondary"
            onClick={() =>
              setCars((c) => [
                ...c,
                {
                  model: '', make: '', colour: '', plate: '',
                  packageId: options.packages[0]?.id ?? '',
                  // The second car of a household gets the next slot along, so
                  // the wash boy does both in one visit to the building.
                  scheduleTime: SLOTS[Math.min(SLOTS.indexOf(c[c.length - 1].scheduleTime) + 1, SLOTS.length - 1)],
                  specialInstructions: 'Second car — same building',
                },
              ])
            }
          >
            + Add another car
          </Button>

          <div className="mt-3">
            <Note tone="teal">
              Every car sits on this one account with a single payment history,
              but keeps its own wash count and time slot.
            </Note>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="s-pattern">Wash days</label>
            <select id="s-pattern" className="field" value={pattern} onChange={(e) => setPattern(e.target.value as WeekdayPattern)}>
              {WEEKDAY_PATTERNS.map((p) => (
                <option key={p} value={p}>{PATTERN_LABEL[p]}</option>
              ))}
            </select>

            {cars.map((car, index) => (
              <div key={index}>
                <label className="field-label mt-3">
                  Time slot — car {index + 1}
                  {car.plate ? ` (${car.plate})` : ''}
                </label>
                <select
                  className="field"
                  value={car.scheduleTime}
                  onChange={(e) => updateCar(index, { scheduleTime: e.target.value })}
                >
                  {SLOTS.map((slot) => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div>
            <label className="field-label" htmlFor="s-staff">Assign wash boy</label>
            <select id="s-staff" className="field" value={assignedStaffId} onChange={(e) => setAssignedStaffId(e.target.value)}>
              <option value="">Decide later</option>
              {areaStaff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <label className="field-label mt-3" htmlFor="s-instr">Special instructions</label>
            <textarea
              id="s-instr"
              className="field"
              rows={3}
              value={cars[0]?.specialInstructions ?? ''}
              onChange={(e) => updateCar(0, { specialInstructions: e.target.value })}
              placeholder="Park at gate side. Ring the bell."
            />

            <div className="mt-3">
              <Note tone="teal">
                Only staff working in this area are listed — a wash boy is never
                sent across the city.
              </Note>
            </div>
          </div>
        </div>
      ) : null}

      {step === 5 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="p-advance">Advance / deposit taken</label>
            <input id="p-advance" className="field" type="number" inputMode="numeric" value={advance} onChange={(e) => setAdvance(e.target.value)} />

            <label className="field-label mt-3" htmlFor="p-mode">Payment mode</label>
            <select id="p-mode" className="field" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}>
              {(['CASH', 'MANUAL_UPI', 'GATEWAY'] as PaymentMode[]).map((m) => (
                <option key={m} value={m}>{PAYMENT_MODE_LABEL[m]}</option>
              ))}
            </select>
          </div>

          <div className="rounded-lg border border-line bg-surface-muted p-3">
            <b className="text-sm">Summary</b>
            <Row label="Customer" value={name || '—'} />
            <Row label="Cars" value={cars.length} />
            <Row label="Washes per month" value={washes} />
            <Row label="Schedule" value={PATTERN_LABEL[pattern]} />
            <Row label="Monthly" value={money(monthly)} />
            <Row label="Advance" value={money(Number(advance) || 0)} />
            <Row label="Source" value={source ? LEAD_SOURCE_LABEL[source] : '—'} />
          </div>

          <div className="sm:col-span-2">
            <Note tone="teal">
              On save the system creates all {washes} wash visits for this month
              and the customer’s account is live immediately.
            </Note>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-3">
          <Note tone="danger">{error}</Note>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        {step > 1 ? (
          <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
            ← Back
          </Button>
        ) : null}
        {step < 5 ? (
          <Button disabled={!stepValid} onClick={() => setStep((s) => s + 1)}>
            Next step →
          </Button>
        ) : (
          <Button disabled={pending} onClick={save} size="lg">
            {pending ? 'Saving…' : 'Save customer'}
          </Button>
        )}
      </div>

      {!stepValid && step < 5 ? (
        <p className="mt-2 text-xs font-semibold text-gold-700">
          {step === 1
            ? 'Choose where this customer came from to continue.'
            : 'Fill in the required fields to continue.'}
        </p>
      ) : null}
    </Card>
  );
}
