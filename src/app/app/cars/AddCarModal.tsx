'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { WEEKDAYS, maxWeeklyDaysForPackage, trimWeeklyDays, type BillingPeriod, type Weekday } from '@/lib/data/types';
import { WEEKDAY_SHORT } from '@/lib/util/labels';

interface PackageOption {
  id: string;
  name: string;
  price: number;
  washesPerMonth: number;
  billingPeriod?: BillingPeriod;
  washesPerPeriod?: number;
}

export function AddCarModal({ packages }: { packages: PackageOption[] }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [make, setMake] = useState('Maruti Suzuki');
  const [model, setModel] = useState('');
  const [colour, setColour] = useState('White');
  const [plate, setPlate] = useState('');
  const [packageId, setPackageId] = useState(packages[0]?.id || '');
  const [scheduleTime, setScheduleTime] = useState('06:30');
  const [instructions, setInstructions] = useState('');
  const [weeklyDays, setWeeklyDays] = useState<Weekday[]>(() =>
    trimWeeklyDays(['MON', 'THU'], packages[0] ?? { washesPerMonth: 8 }),
  );

  const selectedPackage = packages.find((p) => p.id === packageId);
  const maxDays = selectedPackage ? maxWeeklyDaysForPackage(selectedPackage) : 7;

  function handlePackageChange(nextPackageId: string) {
    setPackageId(nextPackageId);
    const nextPkg = packages.find((p) => p.id === nextPackageId);
    if (nextPkg) {
      setWeeklyDays((cur) => trimWeeklyDays(cur, nextPkg));
    }
  }

  function toggleDay(day: Weekday) {
    setWeeklyDays((current) => {
      const isOn = current.includes(day);
      if (!isOn && current.length >= maxDays) return current;
      return isOn ? current.filter((d) => d !== day) : [...current, day];
    });
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!model.trim() || !plate.trim()) {
      setError('Please provide car model and plate number.');
      return;
    }
    if (weeklyDays.length === 0) {
      setError('Please pick at least one day of the week for washing.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/customer/cars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          make: make.trim() || 'Car',
          model: model.trim(),
          colour: colour.trim() || 'White',
          plate: plate.trim().toUpperCase(),
          packageId: packageId || undefined,
          weeklyDays,
          scheduleTime,
          specialInstructions: instructions.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add car.');
      }

      // Reset form
      setModel('');
      setPlate('');
      setInstructions('');
      setIsOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full rounded-xl border border-navy-200 bg-white py-3.5 text-center text-[13.5px] font-semibold text-[#0f2347] shadow-xs transition-all hover:bg-navy-50 hover:border-navy-400 active:scale-[0.99] cursor-pointer"
      >
        + Add another car
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-fade-up max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-navy-950">Add Another Car</h3>
                <p className="text-xs text-ink-mute font-medium mt-0.5">
                  Register a new car under your account
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {error ? (
              <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-700 font-semibold">
                {error}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
              {/* Make & Model */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Make / Brand</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maruti, Tata"
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-navy-600 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Car Model</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Swift, Nexon"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-navy-600 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Number Plate & Colour */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Number Plate</label>
                  <input
                    type="text"
                    required
                    placeholder="MH31 AB 1234"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm uppercase text-slate-900 focus:border-navy-600 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Colour</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. White, Grey"
                    value={colour}
                    onChange={(e) => setColour(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-navy-600 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Package Selection */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">Wash Package</label>
                <select
                  value={packageId}
                  onChange={(e) => handlePackageChange(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-navy-600 focus:outline-hidden bg-white"
                >
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} — ₹{pkg.price}/mo ({pkg.washesPerMonth} washes)
                    </option>
                  ))}
                </select>
              </div>

              {/* Time Slot */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">Preferred Time Slot</label>
                <select
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-navy-600 focus:outline-hidden bg-white"
                >
                  <option value="06:30">06:30 AM</option>
                  <option value="07:30">07:30 AM</option>
                  <option value="08:30">08:30 AM</option>
                  <option value="17:30">05:30 PM</option>
                  <option value="18:30">06:30 PM</option>
                </select>
              </div>

              {/* Weekly wash days */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">Wash Days (every week)</label>
                <p className="mb-1.5 text-[11px] text-slate-500">
                  This package allows up to {maxDays} day{maxDays === 1 ? '' : 's'}/week.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((day) => {
                    const checked = weeklyDays.includes(day);
                    const disabled = !checked && weeklyDays.length >= maxDays;
                    return (
                      <button
                        key={day}
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleDay(day)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                          checked
                            ? 'border-navy-600 bg-navy-600 text-white'
                            : disabled
                              ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {WEEKDAY_SHORT[day]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Special Instructions */}
              <div>
                <label className="block font-medium text-slate-700 mb-1">Special Note (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Parked at slot B-14, basement 1"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-navy-600 focus:outline-hidden"
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={loading}
                  className="rounded-lg px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-navy-600 px-5 py-2 font-semibold text-white shadow-xs hover:bg-navy-700 active:scale-95 disabled:opacity-50"
                >
                  {loading ? 'Adding car...' : 'Save Car'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
