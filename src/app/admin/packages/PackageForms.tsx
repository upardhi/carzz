'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Note } from '@/components/ui/primitives';
import { toast } from '@/components/ui/ToastProvider';
import { IconCheck } from '@/components/shell/icons';
import {
  BILLING_PERIODS,
  parsePackageServices,
  washesPerMonthFor,
  type BillingPeriod,
  type PackageServiceItem,
} from '@/lib/data/types';

const PERIOD_UNIT: Record<BillingPeriod, string> = {
  WEEKLY: '/wk',
  MONTHLY: '/mo',
  YEARLY: '/yr',
};

function getPeriodWashLimit(period: BillingPeriod): number {
  if (period === 'WEEKLY') return 7;
  if (period === 'MONTHLY') return 31;
  return 366;
}

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

export function CreatePackageForm({
  existingNames = [],
}: {
  existingNames?: string[];
}) {
  const { save, pending, state } = useSave();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('MONTHLY');
  const [washes, setWashes] = useState('8');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  // Selected services with their individual washes/month
  const [serviceItems, setServiceItems] = useState<PackageServiceItem[]>([
    { name: 'Exterior wash', washesPerMonth: 8 },
    { name: 'Interior vacuum', washesPerMonth: 8 },
  ]);

  // Custom service input state
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customWashes, setCustomWashes] = useState('8');

  const washesPerPeriod = Number(washes) || 8;
  const maxWashes = washesPerMonthFor(billingPeriod, washesPerPeriod);

  function resetForm() {
    setName('');
    setBillingPeriod('MONTHLY');
    setWashes('8');
    setPrice('');
    setCost('');
    setServiceItems([
      { name: 'Exterior wash', washesPerMonth: 8 },
      { name: 'Interior vacuum', washesPerMonth: 8 },
    ]);
    setShowAddCustom(false);
    setCustomName('');
    setCustomWashes('8');
    setDuplicateError(null);
  }

  function isDuplicatePackageName(candidate: string) {
    const normalized = candidate.trim().toLowerCase();
    if (!normalized) return false;
    return existingNames.some((n) => n.trim().toLowerCase() === normalized);
  }

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

  // Update all items if the effective monthly wash count drops below their counts
  function handleMainWashesChange(val: string) {
    setWashes(val);
    const newMax = washesPerMonthFor(billingPeriod, Number(val) || 1);
    setServiceItems((cur) => cur.map((s) => ({ ...s, washesPerMonth: Math.min(s.washesPerMonth, newMax) })));
  }

  function handlePeriodChange(period: BillingPeriod) {
    setBillingPeriod(period);
    const newMax = washesPerMonthFor(period, washesPerPeriod);
    setServiceItems((cur) => cur.map((s) => ({ ...s, washesPerMonth: Math.min(s.washesPerMonth, newMax) })));
  }

  async function handleCreate() {
    if (isDuplicatePackageName(name)) {
      const msg = 'A package with the same name already exists. Please use a different package name.';
      setDuplicateError(msg);
      toast.error(msg);
      return;
    }
    setDuplicateError(null);

    const res = await save({
      action: 'create',
      name: name.trim(),
      billingPeriod,
      washesPerPeriod: Number(washes),
      price: Number(price),
      costToDeliver: Number(cost) || 0,
      services: serviceItems,
    });

    if (res.ok) {
      resetForm();
      setOpen(false);
    }
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
    <>
      <button
        type="button"
        onClick={() => {
          setDuplicateError(null);
          setOpen(true);
        }}
        className="inline-flex items-center gap-2 rounded-xl bg-navy-800 hover:bg-navy-700 px-4 py-2.5 text-[13px] font-bold text-white transition-all shadow-xs cursor-pointer whitespace-nowrap"
      >
        <span className="text-base leading-none">+</span>
        <span>Create New Package</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150 text-left font-normal">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-auto text-left">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100 text-lg">
                  📦
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-slate-900">
                    Create New Package
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Define main monthly wash limit and assign custom wash frequencies for each service.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1 text-lg font-bold cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-6 max-h-[78vh] overflow-y-auto space-y-4">
              <div>
                <label className="field-label" htmlFor="pk-name">
                  Package Name *
                </label>
                <input
                  id="pk-name"
                  className={`field ${duplicateError ? 'border-rose-400 focus:border-rose-500' : ''}`}
                  value={name}
                  onChange={(e) => {
                    const val = e.target.value;
                    setName(val);
                    if (isDuplicatePackageName(val)) {
                      setDuplicateError(
                        'A package with the same name already exists. Please use a different package name.',
                      );
                    } else {
                      setDuplicateError(null);
                    }
                  }}
                  placeholder="e.g. Premium Monthly Wash"
                />
                {duplicateError && (
                  <p className="mt-1.5 text-xs font-semibold text-rose-600">
                    {duplicateError}
                  </p>
                )}
              </div>

              <div>
                <label className="field-label">Billing period</label>
                <div className="grid grid-cols-3 gap-2.5">
                  {BILLING_PERIODS.map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => handlePeriodChange(period)}
                      className={`rounded-xl border px-3 py-2 text-xs font-bold capitalize transition-colors cursor-pointer ${
                        billingPeriod === period
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {period.toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="field-label">
                    Washes {PERIOD_UNIT[billingPeriod]}
                  </label>
                  <input
                    className="field"
                    type="number"
                    min="1"
                    max={getPeriodWashLimit(billingPeriod)}
                    inputMode="numeric"
                    value={washes}
                    onChange={(e) => {
                      const maxAllowed = getPeriodWashLimit(billingPeriod);
                      const num = Number(e.target.value);
                      if (num > maxAllowed) {
                        handleMainWashesChange(String(maxAllowed));
                      } else {
                        handleMainWashesChange(e.target.value);
                      }
                    }}
                  />
                  {billingPeriod !== 'MONTHLY' && (
                    <p className="mt-0.5 text-[10.5px] text-slate-400">
                      ≈ {maxWashes} washes/month
                    </p>
                  )}
                </div>
                <div>
                  <label className="field-label">Price (₹) *</label>
                  <input
                    className="field"
                    type="number"
                    inputMode="numeric"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="2400"
                  />
                </div>
                <div>
                  <label className="field-label">Cost to deliver (₹)</label>
                  <input
                    className="field"
                    type="number"
                    inputMode="numeric"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="900"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="field-label mb-0 block">
                    Services included &amp; {billingPeriod.toLowerCase()} frequency
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddCustom(!showAddCustom)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 cursor-pointer"
                  >
                    {showAddCustom ? 'Cancel' : '+ Add custom service'}
                  </button>
                </div>

                {showAddCustom && (
                  <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3 space-y-2">
                    <div className="text-xs font-bold text-slate-800">
                      Add Custom Service
                    </div>
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
                        placeholder={`Washes${PERIOD_UNIT[billingPeriod]}`}
                        className="field bg-white"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={addCustomService}
                        disabled={!customName.trim()}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                      >
                        Add to list
                      </button>
                    </div>
                  </div>
                )}

                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs">
                  {allServicesList.map((serviceName) => {
                    const selected = serviceItems.find(
                      (s) => s.name.toLowerCase() === serviceName.toLowerCase(),
                    );
                    const on = Boolean(selected);

                    return (
                      <div
                        key={serviceName}
                        className="flex items-center justify-between py-2 px-1.5 text-slate-800 gap-2"
                      >
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleService(serviceName)}
                          className="flex items-center gap-2.5 text-left font-semibold text-xs flex-1 cursor-pointer"
                        >
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              on
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {on ? (
                              <IconCheck width={11} height={11} strokeWidth={3} />
                            ) : null}
                          </span>
                          <span
                            className={
                              on ? 'text-slate-900 font-bold' : 'text-slate-500'
                            }
                          >
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
                              onChange={(e) =>
                                updateServiceWashes(
                                  serviceName,
                                  Number(e.target.value),
                                )
                              }
                              className="w-14 rounded-lg border border-slate-300 bg-white px-2 py-1 text-center text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500"
                            />
                            <span className="text-[11px] text-slate-500 font-medium">
                              {PERIOD_UNIT[billingPeriod]}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <p className="mt-1.5 text-[11px] text-slate-400">
                  Each service can run up to {maxWashes} washes per month (the package limit).
                </p>
              </div>

              <Note tone="brand">
                A price or service change applies to customers added afterwards. Invoices
                already raised are left as they are, so nobody is re-billed for a
                month they have already paid.
              </Note>

              <Feedback state={state} />

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!valid || pending || Boolean(duplicateError)}
                  onClick={handleCreate}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-navy-800 hover:bg-navy-700 px-5 py-2.5 text-xs font-bold text-white transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {pending && (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  )}
                  <span>{pending ? 'Creating…' : 'Create Package'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function EditPackageForm({
  packageId,
  packageName,
  price,
  washesPerMonth,
  billingPeriod: initialBillingPeriod,
  washesPerPeriod: initialWashesPerPeriod,
  costToDeliver,
  services,
  active,
}: {
  packageId: string;
  packageName: string;
  price: number;
  washesPerMonth: number;
  billingPeriod: BillingPeriod;
  washesPerPeriod: number;
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
  const [nextBillingPeriod, setNextBillingPeriod] = useState<BillingPeriod>(initialBillingPeriod);
  const [nextWashes, setWashes] = useState(String(initialWashesPerPeriod || washesPerMonth));
  const [nextCost, setCost] = useState(String(costToDeliver));
  const [nextActive, setActive] = useState(active);

  const [serviceItems, setServiceItems] = useState<PackageServiceItem[]>(() =>
    parsePackageServices(services, washesPerMonth),
  );

  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customWashes, setCustomWashes] = useState(String(washesPerMonth));

  const maxWashes = washesPerMonthFor(nextBillingPeriod, Number(nextWashes) || 8);

  function handlePeriodChange(period: BillingPeriod) {
    setNextBillingPeriod(period);
    const newMax = washesPerMonthFor(period, Number(nextWashes) || 1);
    setServiceItems((cur) => cur.map((s) => ({ ...s, washesPerMonth: Math.min(s.washesPerMonth, newMax) })));
  }

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
      billingPeriod: nextBillingPeriod,
      washesPerPeriod: Number(nextWashes),
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
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4">
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

              <div>
                <label className="block mb-1 text-slate-600">Billing period</label>
                <div className="grid grid-cols-3 gap-2">
                  {BILLING_PERIODS.map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => handlePeriodChange(period)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-bold capitalize transition-colors ${
                        nextBillingPeriod === period
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {period.toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block mb-1 text-slate-600">Washes {PERIOD_UNIT[nextBillingPeriod]}</label>
                  <input
                    type="number"
                    min="1"
                    max={getPeriodWashLimit(nextBillingPeriod)}
                    value={nextWashes}
                    onChange={(e) => {
                      const maxAllowed = getPeriodWashLimit(nextBillingPeriod);
                      const val = Number(e.target.value) > maxAllowed ? String(maxAllowed) : e.target.value;
                      setWashes(val);
                      const m = washesPerMonthFor(nextBillingPeriod, Number(val) || 1);
                      setServiceItems((cur) => cur.map((s) => ({ ...s, washesPerMonth: Math.min(s.washesPerMonth, m) })));
                    }}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                  {nextBillingPeriod !== 'MONTHLY' && (
                    <p className="mt-0.5 text-[10.5px] text-slate-400">≈ {maxWashes} washes/month</p>
                  )}
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
                  <span className="text-slate-700 font-bold">
                    Services &amp; {nextBillingPeriod.toLowerCase()} frequencies
                  </span>
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
                        placeholder={`Washes${PERIOD_UNIT[nextBillingPeriod]}`}
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
                            <span className="text-[10.5px] text-slate-500">{PERIOD_UNIT[nextBillingPeriod]}</span>
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
