'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/ToastProvider';
import {
  LEAD_SOURCES,
  WEEKDAY_PATTERNS,
  type Area,
  type Car,
  type Customer,
  type LeadSource,
  type ServicePackage,
  type Staff,
  type WeekdayPattern,
} from '@/lib/data/types';
import { LEAD_SOURCE_LABEL, PATTERN_LABEL } from '@/lib/util/labels';

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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !address.trim()) {
      toast.error('Name, Phone and Address are required.');
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
  const [schedulePattern, setSchedulePattern] = useState<WeekdayPattern>(car.schedulePattern);
  const [scheduleTime, setScheduleTime] = useState(car.scheduleTime);
  const [specialInstructions, setSpecialInstructions] = useState(car.specialInstructions || '');
  const [customDates, setCustomDates] = useState<string[]>(() => {
    return (car.customDates || []).map(d => typeof d === 'string' ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10));
  });
  const [active, setActive] = useState(car.active ?? true);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    
    if (schedulePattern === 'CUSTOM') {
      const pkg = packages.find(p => p.id === packageId);
      if (pkg && customDates.filter(Boolean).length !== pkg.washesPerMonth) {
        toast.error(`For custom dates, you must select exactly ${pkg.washesPerMonth} dates.`);
        return;
      }
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
          schedulePattern,
          scheduleTime,
          specialInstructions: specialInstructions.trim() || null,
          customDates: schedulePattern === 'CUSTOM' ? customDates : undefined,
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
                    onChange={(e) => setPackageId(e.target.value)}
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Schedule Pattern *</label>
                  <select
                    value={schedulePattern}
                    onChange={(e) => setSchedulePattern(e.target.value as WeekdayPattern)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold bg-white focus:border-blue-500 focus:outline-none"
                  >
                    {WEEKDAY_PATTERNS.map((pat) => (
                      <option key={pat} value={pat}>
                        {PATTERN_LABEL[pat] || pat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Slot Time (HH:MM) *</label>
                  <input
                    type="time"
                    required
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {schedulePattern === 'CUSTOM' && (() => {
                const pkg = packages.find((p) => p.id === packageId);
                if (!pkg) return null;
                
                return (
                  <div className="mt-2">
                    <label className="mb-2 block text-xs font-bold text-slate-700">
                      Select exactly {pkg.washesPerMonth} dates *
                    </label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {Array.from({ length: pkg.washesPerMonth }).map((_, dateIndex) => (
                        <input
                          key={dateIndex}
                          type="date"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                          value={customDates[dateIndex] || ''}
                          onChange={(e) => {
                            const newDates = [...customDates];
                            newDates[dateIndex] = e.target.value;
                            setCustomDates(newDates);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })()}

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
  const [schedulePattern, setSchedulePattern] = useState<WeekdayPattern>('MON_THU');
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [customDates, setCustomDates] = useState<string[]>([]);
  const [autoStartService, setAutoStartService] = useState(true);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!make.trim() || !model.trim() || !plate.trim() || !packageId) {
      toast.error('Make, Model, Plate and Package are required.');
      return;
    }

    if (schedulePattern === 'CUSTOM') {
      const pkg = packages.find(p => p.id === packageId);
      if (pkg && customDates.filter(Boolean).length !== pkg.washesPerMonth) {
        toast.error(`For custom dates, you must select exactly ${pkg.washesPerMonth} dates.`);
        return;
      }
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
          schedulePattern,
          scheduleTime,
          specialInstructions: specialInstructions.trim() || null,
          customDates: schedulePattern === 'CUSTOM' ? customDates : undefined,
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
                    onChange={(e) => setPackageId(e.target.value)}
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Schedule Pattern *</label>
                  <select
                    value={schedulePattern}
                    onChange={(e) => setSchedulePattern(e.target.value as WeekdayPattern)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold bg-white focus:border-blue-500 focus:outline-none"
                  >
                    {WEEKDAY_PATTERNS.map((pat) => (
                      <option key={pat} value={pat}>
                        {PATTERN_LABEL[pat] || pat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Slot Time *</label>
                  <input
                    type="time"
                    required
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {schedulePattern === 'CUSTOM' && (() => {
                const pkg = packages.find((p) => p.id === packageId);
                if (!pkg) return null;
                
                return (
                  <div className="mt-2">
                    <label className="mb-2 block text-xs font-bold text-slate-700">
                      Select exactly {pkg.washesPerMonth} dates *
                    </label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {Array.from({ length: pkg.washesPerMonth }).map((_, dateIndex) => (
                        <input
                          key={dateIndex}
                          type="date"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                          value={customDates[dateIndex] || ''}
                          onChange={(e) => {
                            const newDates = [...customDates];
                            newDates[dateIndex] = e.target.value;
                            setCustomDates(newDates);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })()}

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