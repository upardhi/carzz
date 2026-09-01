'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Note } from '@/components/ui/primitives';
import { toast } from '@/components/ui/ToastProvider';
import { IconCheck } from '@/components/shell/icons';

const SERVICES = [
  'Exterior wash',
  'Pressure wash',
  'Interior vacuum',
  'Polish / wax',
  'Tyre dressing',
  'Dashboard polish',
  'Glass cleaning',
];

function useSave() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<{ ok?: string; error?: string }>({});

  async function save(payload: Record<string, unknown>) {
    setPending(true);
    setState({});
    try {
      const response = await fetch('/api/admin/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        const err = data.error ?? 'Could not save that.';
        setState({ error: err });
        toast.error(err);
        return false;
      }
      const msg = data.message ?? 'Saved.';
      setState({ ok: msg });
      toast.success(msg);
      router.refresh();
      return true;
    } catch {
      setState({ error: 'No connection.' });
      toast.error('No connection.');
      return false;
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

export function EditPackageForm({
  packageId,
  price,
  washesPerMonth,
  costToDeliver,
}: {
  packageId: string;
  price: number;
  washesPerMonth: number;
  costToDeliver: number;
}) {
  const { save, pending, state } = useSave();
  const [nextPrice, setPrice] = useState(String(price));
  const [nextWashes, setWashes] = useState(String(washesPerMonth));
  const [nextCost, setCost] = useState(String(costToDeliver));

  const dirty =
    Number(nextPrice) !== price ||
    Number(nextWashes) !== washesPerMonth ||
    Number(nextCost) !== costToDeliver;

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="field-label">Price</label>
          <input className="field" type="number" inputMode="numeric" value={nextPrice} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Washes</label>
          <input className="field" type="number" inputMode="numeric" value={nextWashes} onChange={(e) => setWashes(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Cost</label>
          <input className="field" type="number" inputMode="numeric" value={nextCost} onChange={(e) => setCost(e.target.value)} />
        </div>
      </div>

      <Button
        block
        size="sm"
        className="mt-2"
        variant="secondary"
        disabled={pending || !dirty}
        onClick={() =>
          save({
            action: 'update',
            packageId,
            price: Number(nextPrice),
            washesPerMonth: Number(nextWashes),
            costToDeliver: Number(nextCost),
          })
        }
      >
        {pending ? 'Saving…' : dirty ? 'Save changes' : 'No changes'}
      </Button>

      <Feedback state={state} />
    </div>
  );
}

export function CreatePackageForm() {
  const { save, pending, state } = useSave();
  const [name, setName] = useState('');
  const [washes, setWashes] = useState('8');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [services, setServices] = useState<string[]>([
    'Exterior wash',
    'Interior vacuum',
  ]);

  const valid =
    name.trim().length > 1 && Number(price) > 0 && Number(washes) > 0 && services.length > 0;

  return (
    <div>
      <label className="field-label" htmlFor="pk-name">Name</label>
      <input id="pk-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Premium Wash" />

      <div className="mt-2 grid grid-cols-3 gap-2">
        <div>
          <label className="field-label">Washes / month</label>
          <input className="field" type="number" inputMode="numeric" value={washes} onChange={(e) => setWashes(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Price</label>
          <input className="field" type="number" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="2400" />
        </div>
        <div>
          <label className="field-label">Cost to deliver</label>
          <input className="field" type="number" inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="900" />
        </div>
      </div>

      <span className="field-label mt-3 block">Services included</span>
      {SERVICES.map((service) => {
        const on = services.includes(service);
        return (
          <button
            key={service}
            type="button"
            aria-pressed={on}
            onClick={() =>
              setServices((current) =>
                on ? current.filter((s) => s !== service) : [...current, service],
              )
            }
            className="flex w-full items-center gap-3 border-b border-line-soft py-2 text-left text-sm last:border-0"
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
                on ? 'border-navy-800 bg-navy-800 text-white' : 'border-line-strong'
              }`}
            >
              {on ? <IconCheck width={13} height={13} strokeWidth={3} /> : null}
            </span>
            {service}
          </button>
        );
      })}

      <Button
        block
        className="mt-3"
        disabled={!valid || pending}
        onClick={() =>
          save({
            action: 'create',
            name,
            washesPerMonth: Number(washes),
            price: Number(price),
            costToDeliver: Number(cost) || 0,
            services,
          })
        }
      >
        {pending ? 'Creating…' : 'Create package'}
      </Button>

      <Feedback state={state} />
    </div>
  );
}
