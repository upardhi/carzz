'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Note } from '@/components/ui/primitives';
import { toast } from '@/components/ui/ToastProvider';
import { IconCheck } from '@/components/shell/icons';
import { parsePackageServices, type PackageServiceItem } from '@/lib/data/types';

const PREDEFINED_SERVICES = [
  'Exterior wash',
  'Pressure wash',
  'Interior vacuum',
  'Polish / wax',
  'Tyre dressing',
  'Dashboard polish',
  'Glass cleaning',
];

interface ImpactedCar {
  carId: string;
  make: string;
  model: string;
  plate: string;
  customerId: string;
  customerName: string;
}

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
      const data = (await response.json()) as {
        message?: string;
        error?: string;
        impacted?: ImpactedCar[];
        inUse?: number;
      };
      if (!response.ok) {
        const err = data.error ?? 'Could not save that.';
        setState({ error: err });
        toast.error(err);
        return { ok: false, data };
      }
      const msg = data.message ?? 'Saved.';
      setState({ ok: msg });
      toast.success(msg);
      router.refresh();
      return { ok: true, data };
    } catch {
      setState({ error: 'No connection.' });
      toast.error('No connection.');
      return { ok: false, error: 'No connection.' };
    } finally {
      setPending(false);
    }
  }

  return { save, pending, state };
}

function Feedback({ state }: { state: { ok?: string; error?: string } }) {
  if (state.error) return <div className="mt-2"><Note tone="danger">{state.error}</Note></div>;
  return null;
}

export function CreatePackageForm() {
  const { save, pending, state } = useSave();
  const [name, setName] = useState('');
  const [washes, setWashes] = useState('8');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');

  // Selected services with their individual washes/month
  const [serviceItems, setServiceItems] = useState<PackageServiceItem[]>([
    { name: 'Exterior wash', washesPerMonth: 8 },
    { name: 'Interior vacuum', washesPerMonth: 8 },
  ]);

  // Custom service input state
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customWashes, setCustomWashes] = useState('8');

  const maxWashes = Number(washes) || 8;

  function toggleService(serviceName: string) {
    const exists = serviceItems.some((s) => s.name.toLowerCase() === serviceName.toLowerCase());
    if (exists) {
      setServiceItems((cur) => cur.filter((s) => s.name.toLowerCase() !== serviceName.toLowerCase()));
    } else {
      setServiceItems((cur) => [...cur, { name: serviceName, washesPerMonth: maxWashes }]);
    }
  }

  function updateServiceWashes(serviceName: string, count: number) {
    const safeCount = Math.max(1, Math.min(count, maxWashes));
    setServiceItems((cur) =>
      cur.map((s) => (s.name.toLowerCase() === serviceName.toLowerCase() ? { ...s, washesPerMonth: safeCount } : s)),
    );
  }

  function addCustomService() {
    if (!customName.trim()) return;
    const exists = serviceItems.some((s) => s.name.toLowerCase() === customName.trim().toLowerCase());
    if (!exists) {
      const safeCount = Math.max(1, Math.min(Number(customWashes) || maxWashes, maxWashes));
      setServiceItems((cur) => [...cur, { name: customName.trim(), washesPerMonth: safeCount }]);
    }
    setCustomName('');
    setShowAddCustom(false);
  }

  // Update all items if main wash count drops below their counts
  function handleMainWashesChange(val: string) {
    setWashes(val);
    const newMax = Number(val) || 1;
    setServiceItems((cur) => cur.map((s) => ({ ...s, washesPerMonth: Math.min(s.washesPerMonth, newMax) })));
  }

  const valid =
    name.trim().length > 1 &&
    Number(price) > 0 &&
    Number(washes) > 0 &&
    serviceItems.length > 0;

  // Combine predefined with any custom added
  const allServicesList = Array.from(
    new Set([...PREDEFINED_SERVICES, ...serviceItems.map((s) => s.name)]),
  );

  return (
    <div>
      <label className="field-label" htmlFor="pk-name">Package Name</label>
      <input id="pk-name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Premium Monthly Wash" />

      <div className="mt-2 grid grid-cols-3 gap-2">
        <div>
          <label className="field-label">Total washes / mo</label>
          <input className="field" type="number" min="1" max="31" inputMode="numeric" value={washes} onChange={(e) => handleMainWashesChange(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Price (₹)</label>
          <input className="field" type="number" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="2400" />
        </div>
        <div>
          <label className="field-label">Cost to deliver (₹)</label>
          <input className="field" type="number" inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="900" />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="field-label mb-0 block">Services included & monthly frequency</span>
        <button
          type="button"
          onClick={() => setShowAddCustom(!showAddCustom)}
          className="text-xs font-bold text-blue-600 hover:text-blue-700"
        >
          {showAddCustom ? 'Cancel' : '+ Add custom service'}
        </button>
      </div>

      {showAddCustom && (
        <div className="mt-2 rounded-xl border border-blue-200 bg-blue-50/60 p-3 space-y-2">
          <div className="text-xs font-bold text-slate-800">Add Custom Service</div>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="e.g. Engine Bay Degreasing"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="col-span-2 field bg-white"
            />
            <input
              type="number"
              min="1"
              max={maxWashes}
              value={customWashes}
              onChange={(e) => setCustomWashes(e.target.value)}
              placeholder="Washes/mo"
              className="field bg-white"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={addCustomService}
              disabled={!customName.trim()}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Add to list
            </button>
          </div>
        </div>
      )}

      <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/50 p-2 text-xs">
        {allServicesList.map((serviceName) => {
          const selected = serviceItems.find((s) => s.name.toLowerCase() === serviceName.toLowerCase());
          const on = Boolean(selected);

          return (
            <div
              key={serviceName}
              className="flex items-center justify-between py-2 px-1 text-slate-800 gap-2"
            >
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggleService(serviceName)}
                className="flex items-center gap-2.5 text-left font-semibold text-xs flex-1 cursor-pointer"
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    on ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'
                  }`}
                >
                  {on ? <IconCheck width={11} height={11} strokeWidth={3} /> : null}
                </span>
                <span className={on ? 'text-slate-900 font-bold' : 'text-slate-500'}>
                  {serviceName}
                </span>
              </button>

              {on ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    min="1"
                    max={maxWashes}
                    value={selected?.washesPerMonth ?? maxWashes}
                    onChange={(e) => updateServiceWashes(serviceName, Number(e.target.value))}
                    className="w-14 rounded-lg border border-slate-300 bg-white px-2 py-1 text-center text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-[11px] text-slate-500 font-medium">/mo</span>
                </div>
              ) : (
                <span className="text-[11px] text-slate-400">—</span>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-1 text-[11px] text-slate-400">
        Each service can run up to {maxWashes} washes per month (the package limit).
      </p>

      <Button
        block
        className="mt-4 inline-flex items-center justify-center gap-2"
        disabled={!valid || pending}
        onClick={() =>
          save({
            action: 'create',
            name,
            washesPerMonth: Number(washes),
            price: Number(price),
            costToDeliver: Number(cost) || 0,
            services: serviceItems,
          })
        }
      >
        {pending && (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        <span>{pending ? 'Creating…' : 'Create package'}</span>
      </Button>

      <Feedback state={state} />
    </div>
  );
}

export function EditPackageForm({
  packageId,
  packageName,
  price,
  washesPerMonth,
  costToDeliver,
  services,
  active,
}: {
  packageId: string;
  packageName: string;
  price: number;
  washesPerMonth: number;
  costToDeliver: number;
  services: string[];
  active: boolean;
}) {
  const { save, pending, state } = useSave();
  const [loadingAction, setLoadingAction] = useState<'toggle' | 'delete' | 'confirm_delete' | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [impactModalOpen, setImpactModalOpen] = useState(false);
  const [impactedCars, setImpactedCars] = useState<ImpactedCar[]>([]);

  const [nextName, setName] = useState(packageName);
  const [nextPrice, setPrice] = useState(String(price));
  const [nextWashes, setWashes] = useState(String(washesPerMonth));
  const [nextCost, setCost] = useState(String(costToDeliver));
  const [nextActive, setActive] = useState(active);

  const [serviceItems, setServiceItems] = useState<PackageServiceItem[]>(() =>
    parsePackageServices(services, washesPerMonth),
  );

  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customWashes, setCustomWashes] = useState(String(washesPerMonth));

  const maxWashes = Number(nextWashes) || 8;

  function toggleService(serviceName: string) {
    const exists = serviceItems.some((s) => s.name.toLowerCase() === serviceName.toLowerCase());
    if (exists) {
      setServiceItems((cur) => cur.filter((s) => s.name.toLowerCase() !== serviceName.toLowerCase()));
    } else {
      setServiceItems((cur) => [...cur, { name: serviceName, washesPerMonth: maxWashes }]);
    }
  }

  function updateServiceWashes(serviceName: string, count: number) {
    const safeCount = Math.max(1, Math.min(count, maxWashes));
    setServiceItems((cur) =>
      cur.map((s) => (s.name.toLowerCase() === serviceName.toLowerCase() ? { ...s, washesPerMonth: safeCount } : s)),
    );
  }

  function addCustomService() {
    if (!customName.trim()) return;
    const exists = serviceItems.some((s) => s.name.toLowerCase() === customName.trim().toLowerCase());
    if (!exists) {
      const safeCount = Math.max(1, Math.min(Number(customWashes) || maxWashes, maxWashes));
      setServiceItems((cur) => [...cur, { name: customName.trim(), washesPerMonth: safeCount }]);
    }
    setCustomName('');
    setShowAddCustom(false);
  }

  const allServicesList = Array.from(
    new Set([...PREDEFINED_SERVICES, ...serviceItems.map((s) => s.name)]),
  );

  async function handleDeleteClick() {
    setLoadingAction('delete');
    try {
      const res = await save({ action: 'impact', packageId });
      if (res.ok && res.data) {
        const impacted = res.data.impacted || [];
        if (impacted.length > 0) {
          setImpactedCars(impacted);
          setImpactModalOpen(true);
        } else {
          setDeleteConfirmOpen(true);
        }
      }
    } finally {
      setLoadingAction(null);
    }
  }

  async function confirmDelete() {
    setLoadingAction('confirm_delete');
    try {
      const res = await save({ action: 'delete', packageId });
      if (res.ok) {
        setDeleteConfirmOpen(false);
        setModalOpen(false);
      }
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleToggleActive() {
    setLoadingAction('toggle');
    try {
      await save({
        action: 'update',
        packageId,
        active: !active,
      });
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleSavePackage() {
    const res = await save({
      action: 'update',
      packageId,
      name: nextName,
      price: Number(nextPrice),
      washesPerMonth: Number(nextWashes),
      costToDeliver: Number(nextCost),
      services: serviceItems,
      active: nextActive,
    });
    if (res.ok) {
      setModalOpen(false);
    }
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={pending || loadingAction !== null}
          className="flex-1 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 shadow-sm transition-all text-center disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap sm:whitespace-normal"
        >
          Edit package & services
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleToggleActive}
            disabled={pending || loadingAction !== null}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border shadow-sm transition-all ${
              pending || loadingAction !== null ? 'opacity-60 cursor-not-allowed' : ''
            } ${
              active
                ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
            title={active ? 'Disable package (hides from new signups)' : 'Activate package'}
          >
            {loadingAction === 'toggle' && (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
            <span>
              {loadingAction === 'toggle'
                ? active
                  ? 'Disabling…'
                  : 'Enabling…'
                : active
                  ? 'Disable'
                  : 'Enable'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleDeleteClick}
            disabled={pending || loadingAction !== null}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 px-3 py-2 text-xs font-bold text-rose-700 shadow-sm transition-all ${
              pending || loadingAction !== null ? 'opacity-60 cursor-not-allowed' : ''
            }`}
            title="Delete package"
          >
            {loadingAction === 'delete' && (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-rose-700 border-t-transparent" />
            )}
            <span>{loadingAction === 'delete' ? 'Deleting…' : 'Delete'}</span>
          </button>
        </div>
      </div>

      {/* EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Edit {packageName}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs font-semibold text-slate-700">
              <div>
                <label className="block mb-1 text-slate-600">Package Name</label>
                <input
                  type="text"
                  value={nextName}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block mb-1 text-slate-600">Washes / mo</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={nextWashes}
                    onChange={(e) => {
                      setWashes(e.target.value);
                      const m = Number(e.target.value) || 1;
                      setServiceItems((cur) => cur.map((s) => ({ ...s, washesPerMonth: Math.min(s.washesPerMonth, m) })));
                    }}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-slate-600">Price (₹)</label>
                  <input
                    type="number"
                    value={nextPrice}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-slate-600">Cost to deliver (₹)</label>
                  <input
                    type="number"
                    value={nextCost}
                    onChange={(e) => setCost(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 pb-1">
                <input
                  type="checkbox"
                  id={`pkg-active-${packageId}`}
                  checked={nextActive}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor={`pkg-active-${packageId}`} className="text-slate-800 cursor-pointer font-bold text-xs">
                  Active (available for new signups)
                </label>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-700 font-bold">Services & frequencies</span>
                  <button
                    type="button"
                    onClick={() => setShowAddCustom(!showAddCustom)}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700"
                  >
                    {showAddCustom ? 'Cancel' : '+ Add custom service'}
                  </button>
                </div>

                {showAddCustom && (
                  <div className="mb-2 rounded-xl border border-blue-200 bg-blue-50/60 p-2.5 space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Custom Service Name"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        className="col-span-2 field bg-white"
                      />
                      <input
                        type="number"
                        min="1"
                        max={maxWashes}
                        value={customWashes}
                        onChange={(e) => setCustomWashes(e.target.value)}
                        placeholder="Washes/mo"
                        className="field bg-white"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={addCustomService}
                        disabled={!customName.trim()}
                        className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Add service
                      </button>
                    </div>
                  </div>
                )}

                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/50 p-2 max-h-56 overflow-y-auto">
                  {allServicesList.map((serviceName) => {
                    const selected = serviceItems.find((s) => s.name.toLowerCase() === serviceName.toLowerCase());
                    const on = Boolean(selected);

                    return (
                      <div
                        key={serviceName}
                        className="flex items-center justify-between py-1.5 px-1 text-slate-800 gap-2"
                      >
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleService(serviceName)}
                          className="flex items-center gap-2 text-left font-semibold text-xs flex-1 cursor-pointer"
                        >
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              on ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'
                            }`}
                          >
                            {on ? <IconCheck width={11} height={11} strokeWidth={3} /> : null}
                          </span>
                          <span className={on ? 'text-slate-900 font-bold' : 'text-slate-500'}>
                            {serviceName}
                          </span>
                        </button>

                        {on ? (
                          <div className="flex items-center gap-1 shrink-0">
                            <input
                              type="number"
                              min="1"
                              max={maxWashes}
                              value={selected?.washesPerMonth ?? maxWashes}
                              onChange={(e) => updateServiceWashes(serviceName, Number(e.target.value))}
                              className="w-12 rounded-lg border border-slate-300 bg-white px-1.5 py-0.5 text-center text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                            />
                            <span className="text-[10.5px] text-slate-500">/mo</span>
                          </div>
                        ) : (
                          <span className="text-[10.5px] text-slate-400">—</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <Feedback state={state} />

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={pending}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending || serviceItems.length === 0 || !Number(nextPrice)}
                onClick={handleSavePackage}
                className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-2.5 text-xs font-bold disabled:opacity-50 shadow-sm inline-flex items-center justify-center gap-1.5"
              >
                {pending && (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                <span>{pending ? 'Saving…' : 'Save changes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMPACTED CUSTOMERS MODAL (When attempting to delete a package in use) */}
      {impactModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 font-bold text-lg">
                ⚠️
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Cannot Delete: {impactedCars.length} Active {impactedCars.length === 1 ? 'Car' : 'Cars'} Subscribed
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  The following customers are currently subscribed to <b>{packageName}</b>.
                </p>
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/50 p-2 text-xs">
              {impactedCars.map((c) => (
                <div key={c.carId} className="py-2 px-1 flex items-center justify-between text-slate-800">
                  <div>
                    <div className="font-bold text-slate-900">{c.customerName}</div>
                    <div className="text-[11px] text-slate-500">{c.make} {c.model}</div>
                  </div>
                  <span className="rounded bg-slate-200/80 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700">
                    {c.plate}
                  </span>
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">
              💡 <b>Recommended Action:</b> Disable this package instead. Existing customers will continue their cycle normally, but new customers won&apos;t be able to see or purchase it.
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setImpactModalOpen(false)}
                disabled={loadingAction === 'toggle' || pending}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Close
              </button>
              {active && (
                <button
                  type="button"
                  disabled={loadingAction === 'toggle' || pending}
                  onClick={async () => {
                    await handleToggleActive();
                    setImpactModalOpen(false);
                  }}
                  className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-700 text-white py-2.5 text-xs font-bold shadow-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loadingAction === 'toggle' && (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  )}
                  <span>{loadingAction === 'toggle' ? 'Disabling…' : 'Disable package now'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL (When 0 cars are on it) */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">
              Delete &quot;{packageName}&quot;?
            </h3>
            <p className="text-xs text-slate-600">
              No active cars are currently subscribed to this package. Are you sure you want to permanently delete it?
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={loadingAction === 'confirm_delete' || pending}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={loadingAction === 'confirm_delete' || pending}
                className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white py-2.5 text-xs font-bold shadow-sm inline-flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loadingAction === 'confirm_delete' && (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                <span>{loadingAction === 'confirm_delete' ? 'Deleting…' : 'Yes, delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
