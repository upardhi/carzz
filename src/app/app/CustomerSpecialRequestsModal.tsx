'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/ToastProvider';
import { formatDateFull } from '@/lib/util/format';
import type { Car, ServicePackage } from '@/lib/data/types';

interface CustomerRequestItem {
  id: string;
  type: 'PACKAGE_CHANGE' | 'ONE_WASH' | 'OTHER_SERVICE';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  car?: { make: string; model: string; plate: string } | null;
  currentPackage?: { name: string; price?: number; washesPerMonth?: number; services?: string[] } | null;
  requestedPackage?: { name: string; price?: number; washesPerMonth?: number; services?: string[] } | null;
  washType?: string | null;
  preferredDate?: string | null;
  preferredTime?: string | null;
  serviceDetails?: string | null;
  notes?: string | null;
  adminRemarks?: string | null;
  paymentStatus?: string | null;
  paymentAmount?: number | null;
  createdAt: string;
}

export function CustomerSpecialRequestsModal({
  cars,
  packages,
}: {
  cars: Car[];
  packages: ServicePackage[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'PACKAGE_CHANGE' | 'ONE_WASH' | 'OTHER_SERVICE' | 'HISTORY'>('PACKAGE_CHANGE');
  const [pending, setPending] = useState(false);
  const [requestsList, setRequestsList] = useState<CustomerRequestItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Form states
  const [selectedCarId, setSelectedCarId] = useState(cars[0]?.id || 'NEW_CAR');
  const [isNewCar, setIsNewCar] = useState(cars.length === 0);
  const [newCarMakeModel, setNewCarMakeModel] = useState('');
  const [newCarPlate, setNewCarPlate] = useState('');

  const [requestedPackageId, setRequestedPackageId] = useState(packages[0]?.id || '');
  const [washType, setWashType] = useState('Deep Clean & Exterior Foam');
  const [preferredDate, setPreferredDate] = useState(() => {
    const tomorrow = new Date(Date.now() + 86400000);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [preferredTime, setPreferredTime] = useState('08:00');
  const [serviceDetails, setServiceDetails] = useState('');
  const [notes, setNotes] = useState('');

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/customer/requests');
      const data = await res.json();
      if (data.ok) {
        setRequestsList(data.requests || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void fetchHistory();
    }
  }, [open, fetchHistory]);

  // Keep car selection updated if cars change
  useEffect(() => {
    if (cars.length > 0 && selectedCarId === 'NEW_CAR' && !isNewCar) {
      setSelectedCarId(cars[0]?.id || '');
    }
  }, [cars, selectedCarId, isNewCar]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);

    try {
      const carPayloadId = isNewCar ? null : selectedCarId || null;
      let finalNotes = notes.trim();

      if (isNewCar && (newCarMakeModel.trim() || newCarPlate.trim())) {
        const carInfo = `[Vehicle: ${newCarMakeModel.trim() || 'New Car'} | Plate: ${newCarPlate.trim().toUpperCase() || 'Pending'}]`;
        finalNotes = finalNotes ? `${carInfo} ${finalNotes}` : carInfo;
      }

      const payload: Record<string, unknown> = {
        type: tab,
        carId: carPayloadId,
        notes: finalNotes || null,
      };

      if (tab === 'PACKAGE_CHANGE') {
        if (!requestedPackageId) {
          toast.error('Please select a target package.');
          setPending(false);
          return;
        }
        payload.requestedPackageId = requestedPackageId;
      } else if (tab === 'ONE_WASH') {
        payload.washType = washType;
        payload.preferredDate = preferredDate;
        payload.preferredTime = preferredTime;
      } else if (tab === 'OTHER_SERVICE') {
        if (!serviceDetails.trim()) {
          toast.error('Please describe the service you need.');
          setPending(false);
          return;
        }
        payload.serviceDetails = serviceDetails.trim();
        payload.preferredDate = preferredDate;
        payload.preferredTime = preferredTime;
      }

      const res = await fetch('/api/customer/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to submit request.');
        return;
      }

      toast.success(data.message || 'Request submitted successfully!');
      setNotes('');
      setServiceDetails('');
      setNewCarMakeModel('');
      setNewCarPlate('');
      setTab('HISTORY');
      await fetchHistory();
      router.refresh();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setPending(false);
    }
  }

  const selectedCar = cars.find((c) => c.id === selectedCarId);
  const currentPkg = packages.find((p) => p.id === selectedCar?.packageId);
  const requestedPkg = packages.find((p) => p.id === requestedPackageId);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99] transition-all cursor-pointer"
      >
        <span className="text-sm">✨</span>
        <span>Customer Requests</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Special Service Requests</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Plan upgrades, one-off single washes, and custom non-package services
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg p-1.5 text-sm font-bold transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Top Navigation Tabs */}
            <div className="flex rounded-xl bg-slate-100 p-1 mb-4 text-xs font-semibold gap-1">
              <button
                type="button"
                onClick={() => setTab('PACKAGE_CHANGE')}
                className={`flex-1 rounded-lg py-2 transition-all cursor-pointer ${
                  tab === 'PACKAGE_CHANGE'
                    ? 'bg-white text-blue-700 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📦 Change Plan
              </button>
              <button
                type="button"
                onClick={() => setTab('ONE_WASH')}
                className={`flex-1 rounded-lg py-2 transition-all cursor-pointer ${
                  tab === 'ONE_WASH'
                    ? 'bg-white text-blue-700 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🚿 One Wash
              </button>
              <button
                type="button"
                onClick={() => setTab('OTHER_SERVICE')}
                className={`flex-1 rounded-lg py-2 transition-all cursor-pointer ${
                  tab === 'OTHER_SERVICE'
                    ? 'bg-white text-blue-700 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ✨ Other Wash
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab('HISTORY');
                  void fetchHistory();
                }}
                className={`flex-1 rounded-lg py-2 transition-all cursor-pointer ${
                  tab === 'HISTORY'
                    ? 'bg-white text-blue-700 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📋 Status
              </button>
            </div>

            {/* TAB 1: PACKAGE CHANGE */}
            {tab === 'PACKAGE_CHANGE' && (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-800 mb-1.5">Select Vehicle *</label>
                  {cars.length === 0 ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs">
                      No registered cars found. Please add a vehicle first under My Cars.
                    </div>
                  ) : (
                    <select
                      value={selectedCarId}
                      onChange={(e) => setSelectedCarId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                    >
                      {cars.map((c) => (
                        <option key={c.id} value={c.id} className="text-slate-900 py-1">
                          🚗 {c.make} {c.model} ({c.plate})
                        </option>
                      ))}
                    </select>
                  )}

                  {currentPkg && (
                    <div className="mt-2 flex items-center justify-between rounded-lg bg-blue-50/80 border border-blue-100 px-3 py-2 text-xs text-blue-900">
                      <span>Current Active Plan:</span>
                      <span className="font-bold">{currentPkg.name} ({currentPkg.washesPerMonth} washes/mo · ₹{currentPkg.price})</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1.5">Requested New Package *</label>
                  <select
                    value={requestedPackageId}
                    onChange={(e) => setRequestedPackageId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  >
                    {packages.map((p) => (
                      <option key={p.id} value={p.id} className="text-slate-900 py-1">
                        📦 {p.name} — {p.washesPerMonth} Washes/Mo (₹{p.price})
                      </option>
                    ))}
                  </select>

                  {requestedPkg && (
                    <div className="mt-2 rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-[11px] text-slate-600 space-y-1.5">
                      <div className="font-bold text-slate-800 mb-0.5">Package & Sub-Services Included:</div>
                      <div>Includes {requestedPkg.washesPerMonth} regular washes per month at ₹{requestedPkg.price}.</div>
                      {requestedPkg.services && requestedPkg.services.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {requestedPkg.services.map((s, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1 rounded bg-blue-50 text-blue-800 border border-blue-200 px-1.5 py-0.5 text-[10px] font-semibold">
                              ✓ {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Additional Notes / Remarks</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Reason for change, preferred effective date..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
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
                    disabled={pending || cars.length === 0}
                    className="rounded-lg bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    {pending ? 'Submitting…' : 'Submit Package Change Request'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: ONE-TIME WASH */}
            {tab === 'ONE_WASH' && (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-slate-800">Select Vehicle *</label>
                    <button
                      type="button"
                      onClick={() => setIsNewCar(!isNewCar)}
                      className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      {isNewCar ? '← Pick Registered Car' : '➕ Request for Different/New Car'}
                    </button>
                  </div>

                  {!isNewCar && cars.length > 0 ? (
                    <select
                      value={selectedCarId}
                      onChange={(e) => setSelectedCarId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                    >
                      {cars.map((c) => (
                        <option key={c.id} value={c.id} className="text-slate-900 py-1">
                          🚗 {c.make} {c.model} ({c.plate})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Make & Model *</label>
                        <input
                          type="text"
                          required={isNewCar}
                          placeholder="e.g. Hyundai Creta"
                          value={newCarMakeModel}
                          onChange={(e) => setNewCarMakeModel(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Plate / Reg No. *</label>
                        <input
                          type="text"
                          required={isNewCar}
                          placeholder="e.g. MH12AB1234"
                          value={newCarPlate}
                          onChange={(e) => setNewCarPlate(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 uppercase focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1.5">Wash Service Type *</label>
                  <select
                    value={washType}
                    onChange={(e) => setWashType(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  >
                    <option value="Deep Clean & Exterior Foam">✨ Deep Clean & Exterior Foam Wash</option>
                    <option value="Interior Vacuuming & Dashboard Polish">🧹 Interior Vacuuming & Dashboard Polish</option>
                    <option value="Complete Premium Wash (In & Out)">💎 Complete Premium Wash (In & Out)</option>
                    <option value="Quick Emergency Rinse">⚡ Quick Emergency Rinse</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1.5">Preferred Date *</label>
                    <input
                      type="date"
                      required
                      value={preferredDate}
                      onChange={(e) => setPreferredDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-800 mb-1.5">Preferred Time *</label>
                    <input
                      type="time"
                      required
                      value={preferredTime}
                      onChange={(e) => setPreferredTime(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Special Instructions (Optional)</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Gate permission, exact parking spot, contact note..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
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
                    className="rounded-lg bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    {pending ? 'Submitting…' : 'Request One-Time Wash'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 3: OTHER CAR WASH REQUEST */}
            {tab === 'OTHER_SERVICE' && (
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="font-bold text-slate-800">Select Vehicle *</label>
                    <button
                      type="button"
                      onClick={() => setIsNewCar(!isNewCar)}
                      className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                    >
                      {isNewCar ? '← Pick Registered Car' : '➕ Request for Different/New Car'}
                    </button>
                  </div>

                  {!isNewCar && cars.length > 0 ? (
                    <select
                      value={selectedCarId}
                      onChange={(e) => setSelectedCarId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                    >
                      {cars.map((c) => (
                        <option key={c.id} value={c.id} className="text-slate-900 py-1">
                          🚗 {c.make} {c.model} ({c.plate})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Make & Model *</label>
                        <input
                          type="text"
                          required={isNewCar}
                          placeholder="e.g. Tata Nexon"
                          value={newCarMakeModel}
                          onChange={(e) => setNewCarMakeModel(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Plate / Reg No. *</label>
                        <input
                          type="text"
                          required={isNewCar}
                          placeholder="e.g. MH14CD5678"
                          value={newCarPlate}
                          onChange={(e) => setNewCarPlate(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 uppercase focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1.5">Describe Custom Service Needed *</label>
                  <textarea
                    rows={3}
                    required
                    value={serviceDetails}
                    onChange={(e) => setServiceDetails(e.target.value)}
                    placeholder="e.g. Engine bay cleaning, ceramic coating touchup, water mark removal, compound buffing..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1.5">Preferred Date</label>
                    <input
                      type="date"
                      value={preferredDate}
                      onChange={(e) => setPreferredDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-800 mb-1.5">Preferred Time</label>
                    <input
                      type="time"
                      value={preferredTime}
                      onChange={(e) => setPreferredTime(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Additional Notes</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any specific requests or requirements..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 focus:outline-none"
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
                    className="rounded-lg bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    {pending ? 'Submitting…' : 'Submit Custom Request'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 4: REQUEST HISTORY / STATUS */}
            {tab === 'HISTORY' && (
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {loadingHistory ? (
                  <p className="py-8 text-center text-xs text-slate-400">Loading your requests...</p>
                ) : requestsList.length === 0 ? (
                  <div className="py-8 text-center">
                    <div className="text-2xl mb-1">📋</div>
                    <p className="text-xs text-slate-500 font-medium">No requests submitted yet.</p>
                  </div>
                ) : (
                  requestsList.map((req) => (
                    <div
                      key={req.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs space-y-2 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>
                            {req.type === 'PACKAGE_CHANGE'
                              ? '📦'
                              : req.type === 'ONE_WASH'
                              ? '🚿'
                              : '✨'}
                          </span>
                          <span>
                            {req.type === 'PACKAGE_CHANGE'
                              ? 'Package Change Request'
                              : req.type === 'ONE_WASH'
                              ? 'One-Time Wash Request'
                              : 'Custom Wash Request'}
                          </span>
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${
                            req.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : req.status === 'PENDING'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>

                      {req.car && (
                        <div className="text-slate-700">
                          Vehicle: <b className="text-slate-900">{req.car.make} {req.car.model} ({req.car.plate})</b>
                        </div>
                      )}

                      {req.type === 'PACKAGE_CHANGE' && (
                        <div className="space-y-1 py-1">
                          <div className="flex items-center gap-1.5 flex-wrap text-xs">
                            <span className="font-medium text-slate-500">Plan Change:</span>
                            <span className="inline-flex items-center rounded bg-slate-100 border border-slate-300 px-2 py-0.5 font-bold text-slate-700">
                              {req.currentPackage?.name || 'Current Plan'}
                            </span>
                            <span className="text-blue-600 font-extrabold text-sm">➔</span>
                            <span className="inline-flex items-center rounded bg-blue-100 border border-blue-300 px-2 py-0.5 font-bold text-blue-900">
                              {req.requestedPackage?.name || 'New Plan'}
                            </span>
                          </div>
                          {req.requestedPackage && (
                            <div className="text-[11px] text-slate-500">
                              ₹{req.currentPackage?.price ?? '—'} ({req.currentPackage?.washesPerMonth ?? '—'} washes/mo) → <b className="text-blue-700">₹{req.requestedPackage.price} ({req.requestedPackage.washesPerMonth} washes/mo)</b>
                            </div>
                          )}
                        </div>
                      )}

                      {req.serviceDetails && (
                        <div className="text-slate-700 bg-white p-2 rounded-lg border border-slate-200">
                          <span className="font-bold text-slate-900">Custom Details:</span> {req.serviceDetails}
                        </div>
                      )}

                      {req.notes && (
                        <div className="text-[11px] text-slate-500">
                          <span className="font-medium">Notes:</span> {req.notes}
                        </div>
                      )}

                      {req.paymentAmount !== undefined && req.paymentAmount !== null && req.paymentAmount !== 0 && (
                        <div
                          className={`rounded-lg p-2.5 text-xs font-semibold flex items-center justify-between ${
                            req.paymentAmount > 0
                              ? 'bg-amber-50 text-amber-900 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                          }`}
                        >
                          <span className="flex items-center gap-1.5">
                            <span>{req.paymentAmount > 0 ? '🔺 Extra Charge:' : '💰 Account Credit:'}</span>
                            <span className="font-black text-sm">₹{Math.abs(req.paymentAmount)}</span>
                          </span>
                          {req.paymentAmount > 0 && (
                            <a
                              href="/app/payments"
                              className="rounded-md bg-amber-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-amber-700 transition-colors shadow-2xs"
                            >
                              Pay Online →
                            </a>
                          )}
                        </div>
                      )}

                      {req.adminRemarks && (
                        <div className="rounded-lg bg-emerald-50 p-2.5 border border-emerald-200 text-emerald-900 text-xs">
                          <b>Admin Response:</b> {req.adminRemarks}
                        </div>
                      )}

                      <div className="text-[10.5px] text-slate-400 pt-1 border-t border-slate-200/60">
                        Submitted on {formatDateFull(req.createdAt)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
