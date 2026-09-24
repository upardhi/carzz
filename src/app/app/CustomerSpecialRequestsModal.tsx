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
  currentPackage?: { name: string } | null;
  requestedPackage?: { name: string } | null;
  washType?: string | null;
  preferredDate?: string | null;
  preferredTime?: string | null;
  serviceDetails?: string | null;
  notes?: string | null;
  adminRemarks?: string | null;
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
  const [selectedCarId, setSelectedCarId] = useState(cars[0]?.id || '');
  const [requestedPackageId, setRequestedPackageId] = useState(packages[0]?.id || '');
  const [washType, setWashType] = useState('Deep Clean & Exterior Foam');
  const [preferredDate, setPreferredDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);

    try {
      const payload: Record<string, unknown> = {
        type: tab,
        carId: selectedCarId || null,
        notes: notes.trim() || null,
      };

      if (tab === 'PACKAGE_CHANGE') {
        payload.requestedPackageId = requestedPackageId;
      } else if (tab === 'ONE_WASH') {
        payload.washType = washType;
        payload.preferredDate = preferredDate;
        payload.preferredTime = preferredTime;
      } else if (tab === 'OTHER_SERVICE') {
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:from-blue-700 hover:to-indigo-700 transition-all cursor-pointer"
      >
        <span>✨</span>
        <span>Special Requests & Packages</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Special Service Requests</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Package upgrades, one-off washes, and customized services
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

            {/* Top Navigation Tabs */}
            <div className="flex rounded-xl bg-slate-100 p-1 mb-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setTab('PACKAGE_CHANGE')}
                className={`flex-1 rounded-lg py-1.5 transition-all cursor-pointer ${
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
                className={`flex-1 rounded-lg py-1.5 transition-all cursor-pointer ${
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
                className={`flex-1 rounded-lg py-1.5 transition-all cursor-pointer ${
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
                className={`flex-1 rounded-lg py-1.5 transition-all cursor-pointer ${
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
              <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Select Vehicle *</label>
                  <select
                    value={selectedCarId}
                    onChange={(e) => setSelectedCarId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold bg-white focus:border-blue-500 focus:outline-none"
                  >
                    {cars.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.make} {c.model} ({c.plate})
                      </option>
                    ))}
                  </select>
                  {currentPkg && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Current Plan: <b className="text-slate-800">{currentPkg.name}</b> ({currentPkg.washesPerMonth} washes/month)
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Requested New Package *</label>
                  <select
                    value={requestedPackageId}
                    onChange={(e) => setRequestedPackageId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold bg-white focus:border-blue-500 focus:outline-none"
                  >
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.washesPerMonth} Washes/Mo (₹{p.price})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Additional Notes / Remarks</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Reason for change, preferred start cycle..."
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
                    className="rounded-lg bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {pending ? 'Submitting…' : 'Submit Package Change Request'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: ONE-TIME WASH */}
            {tab === 'ONE_WASH' && (
              <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Select Vehicle *</label>
                  <select
                    value={selectedCarId}
                    onChange={(e) => setSelectedCarId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold bg-white focus:border-blue-500 focus:outline-none"
                  >
                    {cars.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.make} {c.model} ({c.plate})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Preferred Date *</label>
                    <input
                      type="date"
                      required
                      value={preferredDate}
                      onChange={(e) => setPreferredDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Preferred Time *</label>
                    <input
                      type="time"
                      required
                      value={preferredTime}
                      onChange={(e) => setPreferredTime(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Wash Type *</label>
                  <select
                    value={washType}
                    onChange={(e) => setWashType(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold bg-white focus:border-blue-500 focus:outline-none"
                  >
                    <option value="Deep Clean & Exterior Foam">Deep Clean & Exterior Foam</option>
                    <option value="Interior Vacuuming & Dashboard Polish">Interior Vacuuming & Dashboard Polish</option>
                    <option value="Complete Premium Wash (In & Out)">Complete Premium Wash (In & Out)</option>
                    <option value="Quick Emergency Rinse">Quick Emergency Rinse</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Special Instructions</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Gate permission, parking location..."
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
                    className="rounded-lg bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {pending ? 'Submitting…' : 'Request One-Time Wash'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 3: OTHER CAR WASH REQUEST */}
            {tab === 'OTHER_SERVICE' && (
              <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Vehicle</label>
                  <select
                    value={selectedCarId}
                    onChange={(e) => setSelectedCarId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold bg-white focus:border-blue-500 focus:outline-none"
                  >
                    {cars.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.make} {c.model} ({c.plate})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Describe Service Needed *</label>
                  <textarea
                    rows={3}
                    required
                    value={serviceDetails}
                    onChange={(e) => setServiceDetails(e.target.value)}
                    placeholder="e.g. Engine bay cleaning, ceramic coating touchup, secondary guest car wash..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Preferred Date</label>
                    <input
                      type="date"
                      value={preferredDate}
                      onChange={(e) => setPreferredDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Preferred Time</label>
                    <input
                      type="time"
                      value={preferredTime}
                      onChange={(e) => setPreferredTime(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                    />
                  </div>
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
                    className="rounded-lg bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {pending ? 'Submitting…' : 'Submit Custom Request'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 4: REQUEST HISTORY / STATUS */}
            {tab === 'HISTORY' && (
              <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                {loadingHistory ? (
                  <p className="py-8 text-center text-xs text-slate-400">Loading your requests...</p>
                ) : requestsList.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-400">No requests submitted yet.</p>
                ) : (
                  requestsList.map((req) => (
                    <div
                      key={req.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">
                          {req.type === 'PACKAGE_CHANGE'
                            ? '📦 Package Change Request'
                            : req.type === 'ONE_WASH'
                            ? '🚿 One-Time Wash Request'
                            : '✨ Other Wash Request'}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            req.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : req.status === 'PENDING'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>

                      {req.car && (
                        <div className="text-slate-600">
                          Car: <b>{req.car.make} {req.car.model} ({req.car.plate})</b>
                        </div>
                      )}

                      {req.type === 'PACKAGE_CHANGE' && req.requestedPackage && (
                        <div className="text-slate-600">
                          Requested Package: <b>{req.requestedPackage.name}</b>
                        </div>
                      )}

                      {req.serviceDetails && (
                        <div className="text-slate-600">
                          Details: <i>{req.serviceDetails}</i>
                        </div>
                      )}

                      {req.adminRemarks && (
                        <div className="mt-1 rounded bg-white p-2 border border-slate-200 text-slate-700">
                          <b>Admin Response:</b> {req.adminRemarks}
                        </div>
                      )}

                      <div className="text-[10px] text-slate-400 pt-1">
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
