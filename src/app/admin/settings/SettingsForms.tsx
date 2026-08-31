'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Button, Note, Tag } from '@/components/ui/primitives';
import { IconCheck } from '@/components/shell/icons';
import type { AppSettings, PaymentMode, PayoutSettings } from '@/lib/data/types';
import { money } from '@/lib/util/format';
import { PAYMENT_MODE_LABEL } from '@/lib/util/labels';

function useSettings(scope: 'app' | 'payout') {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<{ ok?: string; error?: string }>({});

  async function save(patch: Record<string, unknown>) {
    setPending(true);
    setState({});
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, ...patch }),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setState({ error: data.error ?? 'Could not save.' });
        return;
      }
      setState({ ok: data.message ?? 'Saved.' });
      router.refresh();
    } catch {
      setState({ error: 'No connection.' });
    } finally {
      setPending(false);
    }
  }

  return { save, pending, state };
}

function Feedback({ state }: { state: { ok?: string; error?: string } }) {
  if (state.ok) return <div className="mt-2"><Note tone="success">{state.ok}</Note></div>;
  if (state.error) return <div className="mt-2"><Note tone="danger">{state.error}</Note></div>;
  return null;
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: ReactNode;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 border-b border-line-soft py-2.5 text-left last:border-0"
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
          checked ? 'border-navy-800 bg-navy-800 text-white' : 'border-line-strong'
        }`}
      >
        {checked ? <IconCheck width={13} height={13} strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        {hint ? <span className="block text-xs text-ink-mute">{hint}</span> : null}
      </span>
    </button>
  );
}

/**
 * The base-pay rule.
 *
 * The brief left this genuinely unsettled — a flat per-wash rate and the
 * day slab differ by roughly three times on the same work — so it is a
 * setting rather than a hardcoded assumption.
 */
export function PayoutBaseForm({ settings }: { settings: PayoutSettings }) {
  const { save, pending, state } = useSettings('payout');
  const [mode, setMode] = useState(settings.baseMode);
  const [rate, setRate] = useState(String(settings.perWashRate));
  const [slab, setSlab] = useState(settings.slabByCarIndex.join(', '));

  const slabValues = slab
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v) && v >= 0);

  return (
    <div>
      <div className="mb-3 flex gap-1 rounded-lg bg-surface-raised p-1" role="radiogroup" aria-label="Base pay rule">
        {(['PER_WASH', 'DAY_SLAB'] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={mode === option}
            onClick={() => setMode(option)}
            className={`flex-1 rounded-md py-2 text-sm font-bold transition-colors ${
              mode === option
                ? 'bg-white text-navy-800 shadow-card'
                : 'text-ink-mute hover:text-ink'
            }`}
          >
            {option === 'PER_WASH' ? 'Flat per wash' : 'Slab by car of the day'}
          </button>
        ))}
      </div>

      {mode === 'PER_WASH' ? (
        <>
          <label className="field-label" htmlFor="pw-rate">Rate per wash</label>
          <input
            id="pw-rate"
            className="field"
            type="number"
            inputMode="numeric"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
          <p className="mt-1 text-xs text-ink-mute">
            A wash boy doing 140 washes would earn{' '}
            {money(140 * (Number(rate) || 0))} before bonuses.
          </p>
        </>
      ) : (
        <>
          <label className="field-label" htmlFor="pw-slab">
            Rate by the car&rsquo;s position in that day&rsquo;s route
          </label>
          <input
            id="pw-slab"
            className="field"
            value={slab}
            onChange={(e) => setSlab(e.target.value)}
            placeholder="300, 350, 400"
          />
          <p className="mt-1 text-xs text-ink-mute">
            First car {money(slabValues[0] ?? 0)}, second{' '}
            {money(slabValues[1] ?? slabValues[0] ?? 0)}, and so on. Beyond the
            list, {money(settings.slabBeyond)} each. A boy doing 140 washes at
            roughly 5 a day would earn about{' '}
            {money(
              Math.round(
                (slabValues.slice(0, 5).reduce((a, b) => a + b, 0) /
                  Math.max(1, Math.min(5, slabValues.length))) *
                  140,
              ),
            )}
            .
          </p>
        </>
      )}

      <Button
        block
        className="mt-3"
        disabled={pending}
        onClick={() =>
          save(
            mode === 'PER_WASH'
              ? { baseMode: mode, perWashRate: Number(rate) || 0 }
              : { baseMode: mode, slabByCarIndex: slabValues },
          )
        }
      >
        {pending ? 'Saving…' : 'Save base pay rule'}
      </Button>

      <Feedback state={state} />
    </div>
  );
}

export function PayoutRulesForm({ settings }: { settings: PayoutSettings }) {
  const { save, pending, state } = useSettings('payout');
  const [values, setValues] = useState({
    onTimeBonus: String(settings.onTimeBonus),
    goodReviewBonus: String(settings.goodReviewBonus),
    carReferralBonus: String(settings.carReferralBonus),
    staffReferralBonus: String(settings.staffReferralBonus),
    offsAllowedPerMonth: String(settings.offsAllowedPerMonth),
    extraOffPenalty: String(settings.extraOffPenalty),
    uninformedLeavePenalty: String(settings.uninformedLeavePenalty),
    pocketWeeklyCapPercent: String(settings.pocketWeeklyCapPercent),
    pocketMinimumBalance: String(settings.pocketMinimumBalance),
  });

  const fields: [keyof typeof values, string][] = [
    ['onTimeBonus', 'On-time bonus per wash'],
    ['goodReviewBonus', 'Good review bonus per wash'],
    ['carReferralBonus', 'New car referral'],
    ['staffReferralBonus', 'New wash boy referral'],
    ['offsAllowedPerMonth', 'Offs allowed per month'],
    ['extraOffPenalty', 'Extra off penalty'],
    ['uninformedLeavePenalty', 'Leave without informing'],
    ['pocketWeeklyCapPercent', 'Pocket money weekly cap (%)'],
    ['pocketMinimumBalance', 'Minimum balance to leave in account'],
  ];

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2">
        {fields.map(([key, label]) => (
          <div key={key}>
            <label className="field-label" htmlFor={`pr-${key}`}>{label}</label>
            <input
              id={`pr-${key}`}
              className="field"
              type="number"
              inputMode="numeric"
              value={values[key]}
              onChange={(e) =>
                setValues((v) => ({ ...v, [key]: e.target.value }))
              }
            />
          </div>
        ))}
      </div>

      <Button
        block
        className="mt-3"
        disabled={pending}
        onClick={() =>
          save(
            Object.fromEntries(
              Object.entries(values).map(([k, v]) => [k, Number(v) || 0]),
            ),
          )
        }
      >
        {pending ? 'Saving…' : 'Save payout rules'}
      </Button>

      <Feedback state={state} />
    </div>
  );
}

export function OperatingRulesForm({ settings }: { settings: AppSettings }) {
  const { save, pending, state } = useSettings('app');
  const [requireBothPhotos, setRequireBothPhotos] = useState(settings.requireBothPhotos);
  const [missedReturns, setMissedReturns] = useState(settings.missedWashReturnsToCount);
  const [retention, setRetention] = useState(String(settings.photoRetentionMonths));
  const [reminderDays, setReminderDays] = useState(String(settings.reminderDaysBeforeDue));
  const [teaBreak, setTeaBreak] = useState(String(settings.teaBreakMinutes));
  const [modes, setModes] = useState<PaymentMode[]>(settings.paymentModesEnabled);

  return (
    <div>
      <Toggle
        label="Both photos required to close a wash"
        hint="Turning this off removes the proof the whole system rests on."
        checked={requireBothPhotos}
        onChange={setRequireBothPhotos}
      />
      <Toggle
        label="A missed wash returns to the customer's count"
        hint="The customer keeps the wash he paid for; it is rescheduled."
        checked={missedReturns}
        onChange={setMissedReturns}
      />

      <span className="field-label mt-3 block">Payment modes customers can use</span>
      {(['CASH', 'MANUAL_UPI', 'GATEWAY'] as PaymentMode[]).map((mode) => (
        <Toggle
          key={mode}
          label={PAYMENT_MODE_LABEL[mode]}
          checked={modes.includes(mode)}
          onChange={(on) =>
            setModes((current) =>
              on ? [...current, mode] : current.filter((m) => m !== mode),
            )
          }
        />
      ))}

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div>
          <label className="field-label" htmlFor="op-retention">Keep photos (months)</label>
          <input id="op-retention" className="field" type="number" inputMode="numeric" value={retention} onChange={(e) => setRetention(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="op-reminder">Remind before due (days)</label>
          <input id="op-reminder" className="field" type="number" inputMode="numeric" value={reminderDays} onChange={(e) => setReminderDays(e.target.value)} />
        </div>
        <div>
          <label className="field-label" htmlFor="op-tea">Tea break (minutes)</label>
          <input id="op-tea" className="field" type="number" inputMode="numeric" value={teaBreak} onChange={(e) => setTeaBreak(e.target.value)} />
        </div>
      </div>

      {Number(retention) < 3 ? (
        <div className="mt-2">
          <Note>
            At {retention} {Number(retention) === 1 ? 'month' : 'months'}, a
            dispute about a wash from further back cannot be settled with
            photos. Keeping them longer costs storage but settles arguments.
          </Note>
        </div>
      ) : null}

      {!requireBothPhotos ? (
        <div className="mt-2">
          <Note tone="danger">
            With photos optional, a wash can be closed without any proof it
            happened. <Tag tone="bad">Not recommended</Tag>
          </Note>
        </div>
      ) : null}

      <Button
        block
        className="mt-3"
        disabled={pending || modes.length === 0}
        onClick={() =>
          save({
            requireBothPhotos,
            missedWashReturnsToCount: missedReturns,
            photoRetentionMonths: Number(retention) || 1,
            reminderDaysBeforeDue: Number(reminderDays) || 0,
            teaBreakMinutes: Number(teaBreak) || 0,
            paymentModesEnabled: modes,
          })
        }
      >
        {pending ? 'Saving…' : 'Save operating rules'}
      </Button>

      {modes.length === 0 ? (
        <p className="mt-2 text-xs font-semibold text-danger-500">
          Leave at least one way for customers to pay.
        </p>
      ) : null}

      <Feedback state={state} />
    </div>
  );
}
