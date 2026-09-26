'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/ToastProvider';
import {
  LEAD_SOURCES,
  parsePackageServices,
  trimWeeklyDays,
  type Area,
  type Car,
  type Customer,
  type DayServices,
  type LeadSource,
  type ServicePackage,
  type Staff,
  type WashVisit,
  type Weekday,
} from '@/lib/data/types';
import { LEAD_SOURCE_LABEL } from '@/lib/util/labels';
import { WeeklyScheduleEditor } from '@/components/ui/WeeklyScheduleEditor';

// ==========================================
// 1. EDIT CUSTOMER MODAL
// ==========================================
export function EditCustomerModalButton({
  customer,
  areas,
}: {
  customer: Customer;
  areas: Area[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone);
  const [altPhone, setAltPhone] = useState(customer.altPhone || '');
  const [address, setAddress] = useState(customer.address);
  const [landmark, setLandmark] = useState(customer.landmark || '');
  const [areaId, setAreaId] = useState(customer.areaId);
  const [source, setSource] = useState<LeadSource>(customer.source);
  const [note, setNote] = useState(customer.note || '');
  const [status, setStatus] = useState(customer.status);
  const [inactivationReason, setInactivationReason] = useState(customer.inactivationReason || '');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !address.trim()) {
      toast.error('Name, Phone and Address are required.');
      return;
    }

    if (status === 'INACTIVE' && !inactivationReason.trim()) {
      toast.error('Please specify a reason for deactivating this customer.');
      return;
    }

    setPending(true);
    try {
      const res = await fetch('/api/ops/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateCustomer',
          customerId: customer.id,
          name: name.trim(),
          phone: phone.trim(),
          altPhone: altPhone.trim() || null,
          address: address.trim(),
          landmark: landmark.trim() || null,
          areaId,
          source,
          note: note.trim() || null,
          status,
          inactivationReason: status === 'INACTIVE' ? inactivationReason.trim() : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to update customer details.');
        return;
      }

      toast.success('Customer details updated successfully!');
      setOpen(false);
      router.refresh();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
      >
        <span>✏️</span>
        <span>Edit Customer</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Edit Customer Details</h3>
                <p className="text-xs text-slate-500 mt-0.5">Update personal, area and contact information</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">WhatsApp Phone *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Alternate Phone</label>
                  <input
                    type="tel"
                    value={altPhone}
                    onChange={(e) => setAltPhone(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Assigned Area *</label>
                  <select
                    value={areaId}
                    onChange={(e) => setAreaId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold bg-white focus:border-blue-500 focus:outline-none"
                  >
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.city})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Account Status *</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as Customer['status'])}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold bg-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="HOLD">HOLD (Paused)</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              {status === 'INACTIVE' && (
                <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3">
                  <label className="block font-bold text-rose-800 mb-1">Inactivation Reason *</label>
                  <textarea
                    rows={2}
                    required
                    value={inactivationReason}
                    onChange={(e) => setInactivationReason(e.target.value)}
                    placeholder="Reason for deactivation (e.g. Relocated, Sold car, Dissatisfied with service, etc.)"
                    className="w-full rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-semibold focus:border-rose-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Full Address *</label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Landmark / Wing</label>
                  <input
                    type="text"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="e.g. Tower B, Flat 402"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lead Source</label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value as LeadSource)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold bg-white focus:border-blue-500 focus:outline-none"
                  >
                    {LEAD_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {LEAD_SOURCE_LABEL[s] || s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Internal Note / Special Notes</label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Gate instructions, parking notes, etc."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {pending ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function InactivateCustomerButton({
  customerId,
  customerName,
}: {
  customerId: string;
  customerName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, setPending] = useState(false);

  async function handleInactivate(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error('Please provide a reason for inactiving this customer.');
      return;
    }
    setPending(true);
    try {
      const res = await fetch('/api/ops/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setStatus',
          customerId,
          status: 'INACTIVE',
          reason: reason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to inactivate customer.');
        return;
      }
      toast.success('Customer set to inactive.');
      setOpen(false);
      setReason('');
      router.refresh();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
      >
        Set inactive
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Inactivate Customer</h3>
                <p className="text-xs text-slate-500 mt-0.5">{customerName}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleInactivate} className="space-y-4 text-xs">
              <div className="rounded-lg bg-amber-50 p-3 border border-amber-200 text-amber-800">
                <p className="font-semibold">⚠️ Warning</p>
                <p className="mt-0.5">
                  Making this customer inactive will unassign all their upcoming wash visits.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Reason for Inactivation *
                </label>
                <textarea
                  rows={3}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Relocated to another city, Dissatisfied with service, Shifted apartment, Sold vehicle..."
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs font-semibold focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-rose-600 px-5 py-2 font-bold text-white hover:bg-rose-700 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {pending ? 'Inactivating…' : 'Confirm Inactivation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ==========================================
// 2. EDIT CAR MODAL
// ==========================================
export function EditCarModalButton({
  customerId,
  car,
  packages,
  staffList,
}: {
  customerId: string;
  car: Car;
  packages: ServicePackage[];
  staffList: Staff[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const [make, setMake] = useState(car.make);
  const [model, setModel] = useState(car.model);
  const [colour, setColour] = useState(car.colour);
  const [plate, setPlate] = useState(car.plate);
  const [packageId, setPackageId] = useState(car.packageId);
  const [assignedStaffId, setAssignedStaffId] = useState(car.assignedStaffId || '');
  const [weeklyDays, setWeeklyDays] = useState<Weekday[]>(car.weeklyDays || []);
  const [dayServices, setDayServices] = useState<DayServices>(car.dayServices || {});
  const [scheduleTime, setScheduleTime] = useState(car.scheduleTime);
  const [specialInstructions, setSpecialInstructions] = useState(car.specialInstructions || '');
  const [active, setActive] = useState(car.active ?? true);

  const selectedPackage = packages.find((p) => p.id === packageId);
  const serviceOptions = parsePackageServices(selectedPackage?.services, selectedPackage?.washesPerMonth).map((s) => s.name);

  function handlePackageChange(nextPackageId: string) {
    setPackageId(nextPackageId);
    const nextPkg = packages.find((p) => p.id === nextPackageId);
    if (nextPkg) {
      setWeeklyDays((cur) => trimWeeklyDays(cur, nextPkg));
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    if (weeklyDays.length === 0) {
      toast.error('Pick at least one weekly wash day.');
      return;
    }

    if (!make.trim() || !model.trim() || !plate.trim()) {
      toast.error('Make, Model and Plate Number are required.');
      return;
    }

    setPending(true);
    try {
      const res = await fetch('/api/ops/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateCar',
          customerId,
          carId: car.id,
          make: make.trim(),
          model: model.trim(),
          colour: colour.trim(),
          plate: plate.trim().toUpperCase(),
          packageId,
          assignedStaffId: assignedStaffId || null,
          weeklyDays,
          dayServices: Object.keys(dayServices).length > 0 ? dayServices : null,
          scheduleTime,
          specialInstructions: specialInstructions.trim() || null,
          active,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to update vehicle details.');
        return;
      }

      toast.success('Vehicle details updated successfully!');
      setOpen(false);
      router.refresh();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
      >
        <span>✏️</span>
        <span>Edit Car</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Edit Vehicle: {car.make} {car.model}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Plate: {car.plate} · Update package, staff assignment & schedule
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Make *</label>
                  <input
                    type="text"
                    required
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Model *</label>
                  <input
                    type="text"
                    required
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Plate Number *</label>
                  <input
                    type="text"
                    required
                    value={plate}
                    onChange={(e) => setPlate(e.target.value.toUpperCase())}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono font-bold focus:border-blue-500 focus:outline-none uppercase"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Colour</label>
                  <input
                    type="text"
                    value={colour}
                    onChange={(e) => setColour(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Service Package *</label>
                  <select
                    value={packageId}
                    onChange={(e) => handlePackageChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold bg-white focus:border-blue-500 focus:outline-none"
                  >
                    {packages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.name} ({pkg.washesPerMonth} washes/mo)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Assigned Wash Boy</label>
                  <select
                    value={assignedStaffId}
                    onChange={(e) => setAssignedStaffId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold bg-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.phone})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Slot Time (HH:MM) *</label>
                <input
                  type="time"
                  required
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full max-w-[160px] rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                />
              </div>

              <WeeklyScheduleEditor
                weeklyDays={weeklyDays}
                dayServices={dayServices}
                serviceOptions={serviceOptions}
                pkg={selectedPackage}
                onChange={(next) => {
                  setWeeklyDays(next.weeklyDays);
                  setDayServices(next.dayServices);
                }}
              />

              <div>
                <label className="block font-bold text-slate-700 mb-1">Special Instructions / Parking Spot</label>
                <input
                  type="text"
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="e.g. Basement 1, Pillar 42, Key with guard"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id={`car-active-${car.id}`}
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor={`car-active-${car.id}`} className="font-bold text-slate-700 cursor-pointer">
                  Car is active & subscribed for washes
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {pending ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ==========================================
// 3. ADD CAR MODAL
// ==========================================
export function AddCarModalButton({
  customerId,
  packages,
  staffList,
}: {
  customerId: string;
  packages: ServicePackage[];
  staffList: Staff[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [colour, setColour] = useState('');
  const [plate, setPlate] = useState('');
  const [packageId, setPackageId] = useState(packages[0]?.id || '');
  const [assignedStaffId, setAssignedStaffId] = useState('');
  const [weeklyDays, setWeeklyDays] = useState<Weekday[]>(() =>
    trimWeeklyDays(['MON', 'THU'], packages[0] ?? { washesPerMonth: 8 }),
  );
  const [dayServices, setDayServices] = useState<DayServices>({});
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [autoStartService, setAutoStartService] = useState(true);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));

  const selectedPackage = packages.find((p) => p.id === packageId);
  const serviceOptions = parsePackageServices(selectedPackage?.services, selectedPackage?.washesPerMonth).map((s) => s.name);

  function handlePackageChange(nextPackageId: string) {
    setPackageId(nextPackageId);
    const nextPkg = packages.find((p) => p.id === nextPackageId);
    if (nextPkg) {
      setWeeklyDays((cur) => trimWeeklyDays(cur, nextPkg));
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!make.trim() || !model.trim() || !plate.trim() || !packageId) {
      toast.error('Make, Model, Plate and Package are required.');
      return;
    }

    if (weeklyDays.length === 0) {
      toast.error('Pick at least one weekly wash day.');
      return;
    }

    setPending(true);
    try {
      const res = await fetch('/api/ops/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'addCar',
          customerId,
          make: make.trim(),
          model: model.trim(),
          colour: colour.trim() || 'Unspecified',
          plate: plate.trim().toUpperCase(),
          packageId,
          assignedStaffId: assignedStaffId || null,
          weeklyDays,
          dayServices: Object.keys(dayServices).length > 0 ? dayServices : null,
          scheduleTime,
          specialInstructions: specialInstructions.trim() || null,
          autoStartService,
          startDate: startDate || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to add vehicle.');
        return;
      }

      toast.success(data.message || 'Vehicle added successfully!');
      setOpen(false);
      setMake('');
      setModel('');
      setColour('');
      setPlate('');
      setSpecialInstructions('');
      router.refresh();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer"
      >
        <span>+ Add Another Car</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Add Vehicle to Account</h3>
                <p className="text-xs text-slate-500 mt-0.5">Define vehicle details, package and wash slot</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdd} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Make *</label>
                  <input
                    type="text"
                    required
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    placeholder="e.g. Honda"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Model *</label>
                  <input
                    type="text"
                    required
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g. City"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Plate Number *</label>
                  <input
                    type="text"
                    required
                    value={plate}
                    onChange={(e) => setPlate(e.target.value.toUpperCase())}
                    placeholder="MH12AB1234"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono font-bold focus:border-blue-500 focus:outline-none uppercase"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Colour</label>
                  <input
                    type="text"
                    value={colour}
                    onChange={(e) => setColour(e.target.value)}
                    placeholder="e.g. White"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Package *</label>
                  <select
                    value={packageId}
                    onChange={(e) => handlePackageChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold bg-white focus:border-blue-500 focus:outline-none"
                  >
                    {packages.map((pkg) => (
                      <option key={pkg.id} value={pkg.id}>
                        {pkg.name} ({pkg.washesPerMonth} washes/mo)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Assigned Wash Boy</label>
                  <select
                    value={assignedStaffId}
                    onChange={(e) => setAssignedStaffId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold bg-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Unassigned</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.phone})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Slot Time *</label>
                <input
                  type="time"
                  required
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full max-w-[160px] rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                />
              </div>

              <WeeklyScheduleEditor
                weeklyDays={weeklyDays}
                dayServices={dayServices}
                serviceOptions={serviceOptions}
                pkg={selectedPackage}
                onChange={(next) => {
                  setWeeklyDays(next.weeklyDays);
                  setDayServices(next.dayServices);
                }}
              />

              <div>
                <label className="block font-bold text-slate-700 mb-1">Special Instructions / Parking Spot</label>
                <input
                  type="text"
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="e.g. B2, Slot 14"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-2 pt-2 pb-1 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="auto-start"
                    checked={autoStartService}
                    onChange={(e) => setAutoStartService(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="auto-start" className="font-bold text-slate-700 cursor-pointer">
                    Auto-start service (Payment Collected)
                  </label>
                </div>
                {autoStartService && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Service Start Date</label>
                    <input
                      type="date"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {pending ? 'Adding…' : '+ Add Car & Generate Visits'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ==========================================
// 4. DELETE / DEACTIVATE CAR ACTION
// ==========================================
export function DeleteCarButton({
  customerId,
  carId,
  carName,
}: {
  customerId: string;
  carId: string;
  carName: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (!confirm(`Are you sure you want to remove ${carName} from this account?`)) {
      return;
    }

    setPending(true);
    try {
      const res = await fetch('/api/ops/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deleteCar',
          customerId,
          carId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to remove car.');
        return;
      }

      toast.success(data.message || 'Car removed.');
      router.refresh();
    } catch {
      toast.error('Network error.');
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleDelete}
      className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer disabled:opacity-50"
    >
      <span>🗑️</span>
      <span>{pending ? 'Removing…' : 'Remove'}</span>
    </button>
  );
}

// ==========================================
// 5. RESCHEDULE (ONE-OFF) NEXT VISIT
// ==========================================
export function RescheduleVisitButton({
  customerId,
  visitId,
  currentDate,
  currentTime,
  staffList,
  currentStaffId,
}: {
  customerId: string;
  visitId: string;
  currentDate: string;
  currentTime: string;
  staffList: Staff[];
  currentStaffId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [date, setDate] = useState(currentDate);
  const [time, setTime] = useState(currentTime);
  const [staffId, setStaffId] = useState(currentStaffId || '');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await fetch('/api/ops/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rescheduleVisit',
          customerId,
          visitId,
          scheduledDate: date,
          scheduledTime: time,
          staffId: staffId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to reschedule.');
        return;
      }
      toast.success(data.message || 'Wash rescheduled.');
      setOpen(false);
      router.refresh();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
      >
        <span>🗓️</span>
        <span>Reschedule</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Reschedule this wash</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  One-off change — next week still follows the usual weekly plan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">New Date *</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">New Time *</label>
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Wash Boy</label>
                <select
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold bg-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Unassigned</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-lg bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {pending ? 'Saving…' : 'Save New Date'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ==========================================
// 6. CAR WASH HISTORY MODAL BUTTON
// ==========================================
import { CarWashHistoryModal } from './CarWashHistoryModal';
import { resolvePublicPhotoUrl } from '@/lib/util/photoUrl';
import Image from 'next/image';

export function CarWashHistoryButton({
  car,
  customer,
  visits,
  staffList,
}: {
  car: {
    id: string;
    make: string;
    model: string;
    plate: string;
    packageName?: string;
    washesPerMonth?: number;
  };
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  visits: WashVisit[];
  staffList: { id: string; name: string; phone?: string }[];
}) {
  const [open, setOpen] = useState(false);
  const doneCount = visits.filter((v) => v.carId === car.id && v.status === 'DONE').length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800 hover:bg-blue-100 hover:border-blue-300 transition cursor-pointer shadow-2xs"
        title="View complete wash history and photos for this vehicle"
      >
        <span>🚿 Wash History</span>
        {doneCount > 0 && (
          <span className="rounded-full bg-blue-200/80 px-1.5 py-0.2 text-[10px] font-extrabold text-blue-900">
            {doneCount}
          </span>
        )}
      </button>

      {open && (
        <CarWashHistoryModal
          car={car}
          customer={customer}
          visits={visits}
          staffList={staffList}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// ==========================================
// 7. VISIT PHOTO PREVIEW BUTTON
// ==========================================
export function VisitPhotoPreviewButton({
  beforePhotoUrl,
  afterPhotoUrl,
  title,
}: {
  beforePhotoUrl?: string | null;
  afterPhotoUrl?: string | null;
  title: string;
}) {
  const [activePhoto, setActivePhoto] = useState<{ url: string; label: string } | null>(null);

  const before = resolvePublicPhotoUrl(beforePhotoUrl);
  const after = resolvePublicPhotoUrl(afterPhotoUrl);

  if (!before && !after) return <span className="text-slate-400 text-xs">—</span>;

  return (
    <>
      <div className="inline-flex items-center gap-1.5">
        {before && (
          <button
            type="button"
            onClick={() => setActivePhoto({ url: before, label: `Before Wash — ${title}` })}
            className="rounded bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100 transition cursor-pointer"
            title="Click to view Before Photo"
          >
            📸 Before
          </button>
        )}
        {after && (
          <button
            type="button"
            onClick={() => setActivePhoto({ url: after, label: `After Wash — ${title}` })}
            className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100 transition cursor-pointer"
            title="Click to view After Photo"
          >
            📸 After
          </button>
        )}
      </div>

      {activePhoto && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in"
          onClick={() => setActivePhoto(null)}
        >
          <div className="relative max-h-[85vh] max-w-3xl overflow-hidden rounded-2xl bg-navy-950 shadow-2xl p-2 border border-slate-700">
            <div className="flex items-center justify-between p-3 text-white border-b border-slate-800">
              <span className="text-sm font-semibold">{activePhoto.label}</span>
              <button
                type="button"
                onClick={() => setActivePhoto(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="relative h-[65vh] w-[75vw] max-w-2xl">
              <Image
                src={activePhoto.url}
                alt="Full photo"
                fill
                sizes="(max-width: 1200px) 100vw, 800px"
                className="object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}