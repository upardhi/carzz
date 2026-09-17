'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button, Note } from '@/components/ui/primitives';

interface Option { id: string; name: string; unit?: string; areaId?: string }

function useAction(endpoint: string) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<{ ok?: string; error?: string }>({});

  async function run(payload: Record<string, unknown>) {
    setPending(true);
    setState({});
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setState({ error: data.error ?? 'That did not work.' });
        return false;
      }
      setState({ ok: data.message ?? 'Done.' });
      router.refresh();
      return true;
    } catch {
      setState({ error: 'No connection.' });
      return false;
    } finally {
      setPending(false);
    }
  }

  return { run, pending, state };
}

function Feedback({ state }: { state: { ok?: string; error?: string } }) {
  if (state.error) return <div className="mt-2"><Note tone="danger">{state.error}</Note></div>;
  return null;
}

export function PurchaseRequestForm({
  areas,
  items,
}: {
  areas: Option[];
  items: Option[];
}) {
  const { run, pending, state } = useAction('/api/ops/inventory');
  const [areaId, setAreaId] = useState(areas[0]?.id ?? '');
  const [itemId, setItemId] = useState(items[0]?.id ?? '__custom__');
  const [isCustom, setIsCustom] = useState(items.length === 0);
  const [customName, setCustomName] = useState('');
  const [customUnit, setCustomUnit] = useState('Pieces');
  const [customCost, setCustomCost] = useState('150');
  const [quantity, setQuantity] = useState('40');
  const [neededBy, setNeededBy] = useState('');
  const [reason, setReason] = useState('');

  // Default neededBy to 3 days in the future after initial mount
  useEffect(() => {
    setNeededBy(new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10));
  }, []);

  const selectedItem = items.find((i) => i.id === itemId);
  const unit = isCustom ? customUnit : selectedItem?.unit ?? '';
  const today = new Date().toISOString().slice(0, 10);

  function handleItemChange(val: string) {
    if (val === '__custom__') {
      setIsCustom(true);
      setItemId('__custom__');
    } else {
      setIsCustom(false);
      setItemId(val);
    }
  }

  const isValid =
    Number(quantity) > 0 &&
    Boolean(neededBy) &&
    (!isCustom ? Boolean(itemId && itemId !== '__custom__') : Boolean(customName.trim()));

  return (
    <div>
      {areas.length > 1 ? (
        <>
          <label className="field-label" htmlFor="pr-area">Area</label>
          <select id="pr-area" className="field" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </>
      ) : null}

      <div className="mt-2 flex items-center justify-between">
        <label className="field-label mb-0" htmlFor="pr-item">Item</label>
        <button
          type="button"
          onClick={() => {
            setIsCustom(!isCustom);
            if (!isCustom) setItemId('__custom__');
            else setItemId(items[0]?.id ?? '');
          }}
          className="text-[11px] font-bold text-blue-600 hover:text-blue-700"
        >
          {isCustom ? '← Pick from list' : '+ Custom item'}
        </button>
      </div>

      {!isCustom ? (
        <select id="pr-item" className="field" value={itemId} onChange={(e) => handleItemChange(e.target.value)}>
          {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          <option value="__custom__">✨ + Request new / custom item (not in list)...</option>
        </select>
      ) : (
        <div className="mt-1 space-y-2 rounded-xl border border-blue-100 bg-blue-50/50 p-2.5 text-xs">
          <div>
            <label className="field-label text-slate-700">Custom item name</label>
            <input
              type="text"
              placeholder="e.g. Foam Lance Spare Nozzle"
              className="field bg-white"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="field-label text-slate-700">Unit</label>
              <input
                type="text"
                placeholder="e.g. Pieces, Litres"
                className="field bg-white"
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label text-slate-700">Est. cost / unit (₹)</label>
              <input
                type="number"
                placeholder="₹"
                className="field bg-white"
                value={customCost}
                onChange={(e) => setCustomCost(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      <label className="field-label mt-2" htmlFor="pr-qty">Quantity ({unit || 'Units'})</label>
      <input id="pr-qty" className="field" type="number" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />

      <label className="field-label mt-2" htmlFor="pr-by">Needed by</label>
      <input id="pr-by" className="field" type="date" min={today} value={neededBy} onChange={(e) => setNeededBy(e.target.value)} suppressHydrationWarning />

      <label className="field-label mt-2" htmlFor="pr-why">Reason</label>
      <textarea id="pr-why" className="field" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this needed..." />

      <Button
        block
        className="mt-3"
        disabled={pending || !isValid}
        onClick={() => {
          if (isCustom) {
            run({
              action: 'request',
              areaId,
              isCustom: true,
              customItemName: customName,
              customUnit,
              customUnitCost: Number(customCost) || 100,
              quantity: Number(quantity),
              neededBy,
              reason: reason || undefined,
            });
          } else {
            run({
              action: 'request',
              areaId,
              itemId,
              quantity: Number(quantity),
              neededBy,
              reason: reason || undefined,
            });
          }
        }}
      >
        {pending ? 'Sending…' : 'Send to owner for approval'}
      </Button>

      <Feedback state={state} />
    </div>
  );
}

export function IssueStockForm({
  areas,
  items,
  staff,
}: {
  areas: Option[];
  items: Option[];
  staff: Option[];
}) {
  const { run, pending, state } = useAction('/api/ops/inventory');
  const [areaId, setAreaId] = useState(areas[0]?.id ?? '');
  const [itemId, setItemId] = useState(items[0]?.id ?? '');
  const [quantity, setQuantity] = useState('1');

  const areaStaff = staff.filter((s) => s.areaId === areaId);
  const [staffId, setStaffId] = useState(areaStaff[0]?.id ?? '');
  const unit = items.find((i) => i.id === itemId)?.unit ?? '';

  // Changing the area must not leave a wash boy from the previous one selected.
  const effectiveStaffId = areaStaff.some((s) => s.id === staffId)
    ? staffId
    : (areaStaff[0]?.id ?? '');

  return (
    <div>
      {areas.length > 1 ? (
        <>
          <label className="field-label" htmlFor="is-area">Area</label>
          <select id="is-area" className="field" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </>
      ) : null}

      <label className="field-label mt-2" htmlFor="is-staff">Wash boy</label>
      <select id="is-staff" className="field" value={effectiveStaffId} onChange={(e) => setStaffId(e.target.value)}>
        {areaStaff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        {areaStaff.length === 0 ? <option value="">No staff in this area</option> : null}
      </select>

      <label className="field-label mt-2" htmlFor="is-item">Item</label>
      <select id="is-item" className="field" value={itemId} onChange={(e) => setItemId(e.target.value)}>
        {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
      </select>

      <label className="field-label mt-2" htmlFor="is-qty">Quantity issued ({unit})</label>
      <input id="is-qty" className="field" type="number" inputMode="decimal" step="0.1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />

      <Button
        block
        variant="secondary"
        className="mt-3"
        disabled={pending || !effectiveStaffId || !(Number(quantity) > 0)}
        onClick={() =>
          run({
            action: 'issue', areaId, itemId,
            staffId: effectiveStaffId, quantity: Number(quantity),
          })
        }
      >
        {pending ? 'Recording…' : 'Record issue'}
      </Button>

      <Feedback state={state} />
    </div>
  );
}
