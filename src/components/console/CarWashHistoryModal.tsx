'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import {
  IconAlert,
  IconCar,
  IconCheck,
  IconClock,
  IconSearch,
  IconStar,
  IconUsers,
} from '@/components/shell/icons';
import { resolvePublicPhotoUrl } from '@/lib/util/photoUrl';
import { formatDateFull, formatClock } from '@/lib/util/format';
import { washDurationMinutes, formatDurationMinutes, washSpeedFlag } from '@/lib/util/washTiming';
import { MISS_REASON_LABEL } from '@/lib/util/labels';
import type { WashVisit } from '@/lib/data/types';

interface CarInfo {
  id: string;
  make: string;
  model: string;
  plate: string;
  packageName?: string;
  washesPerMonth?: number;
}

interface CustomerInfo {
  id: string;
  name: string;
  phone: string;
}

interface StaffMember {
  id: string;
  name: string;
  phone?: string;
}

interface Props {
  car: CarInfo;
  customer: CustomerInfo;
  visits: WashVisit[];
  staffList: StaffMember[];
  onClose: () => void;
}

export function CarWashHistoryModal({
  car,
  customer,
  visits,
  staffList,
  onClose,
}: Props) {
  const [filter, setFilter] = useState<'ALL' | 'DONE' | 'MISSED' | 'FLAGGED'>('ALL');
  const [search, setSearch] = useState('');
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string } | null>(null);

  const staffById = useMemo(
    () => new Map(staffList.map((s) => [s.id, s])),
    [staffList],
  );

  // App settings fallback thresholds
  const settings = { minWashMinutes: 8, maxWashMinutes: 40 };

  // Calculate statistics for this car
  const carVisits = useMemo(() => {
    return [...visits]
      .filter((v) => v.carId === car.id)
      .sort((a, b) => {
        const timeA = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
        const timeB = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
        return timeB - timeA;
      });
  }, [visits, car.id]);

  const doneVisits = useMemo(() => carVisits.filter((v) => v.status === 'DONE'), [carVisits]);
  const missedVisits = useMemo(() => carVisits.filter((v) => v.status === 'MISSED'), [carVisits]);
  const ratedVisits = useMemo(() => doneVisits.filter((v) => v.rating !== null), [doneVisits]);
  const avgRating = useMemo(() => {
    if (!ratedVisits.length) return null;
    return (
      ratedVisits.reduce((sum, v) => sum + (v.rating ?? 0), 0) / ratedVisits.length
    ).toFixed(1);
  }, [ratedVisits]);

  const flaggedVisits = useMemo(() => {
    return doneVisits.filter((v) => {
      const dur = washDurationMinutes(v);
      return washSpeedFlag(dur, settings) !== null;
    });
  }, [doneVisits, settings]);

  // Filter & Search
  const filteredVisits = useMemo(() => {
    return carVisits.filter((v) => {
      if (filter === 'DONE' && v.status !== 'DONE') return false;
      if (filter === 'MISSED' && v.status !== 'MISSED') return false;
      if (filter === 'FLAGGED') {
        const dur = washDurationMinutes(v);
        if (v.status !== 'DONE' || washSpeedFlag(dur, settings) === null) return false;
      }

      if (!search.trim()) return true;
      const q = search.toLowerCase().trim();
      const staffName = v.staffId ? staffById.get(v.staffId)?.name.toLowerCase() ?? '' : '';
      const dateStr = formatDateFull(v.scheduledDate).toLowerCase();
      const serviceStr = (v.servicesDone || []).join(' ').toLowerCase();
      const commentStr = (v.ratingComment || '').toLowerCase();
      const missStr = v.missReason ? (MISS_REASON_LABEL[v.missReason] ?? '').toLowerCase() : '';

      return (
        staffName.includes(q) ||
        dateStr.includes(q) ||
        serviceStr.includes(q) ||
        commentStr.includes(q) ||
        missStr.includes(q)
      );
    });
  }, [carVisits, filter, search, staffById, settings]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewPhoto) {
          setPreviewPhoto(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewPhoto, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-800">
              <IconCar width={22} height={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-navy-950">
                  {car.make} {car.model} — {car.plate}
                </h2>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-900 border border-blue-200">
                  {carVisits.length} washes total
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Customer: <span className="font-semibold text-slate-700">{customer.name}</span> ({customer.phone})
                {car.packageName ? ` · Package: ${car.packageName}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Top Summary Metrics Strip */}
        <div className="grid grid-cols-4 gap-2 border-b border-slate-100 bg-white px-6 py-3 text-center">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
            <div className="text-[11px] font-medium text-slate-500">Total Done</div>
            <div className="text-lg font-bold text-emerald-700">{doneVisits.length}</div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
            <div className="text-[11px] font-medium text-slate-500">Missed / Carried</div>
            <div className="text-lg font-bold text-amber-700">{missedVisits.length}</div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
            <div className="text-[11px] font-medium text-slate-500">Avg Rating</div>
            <div className="text-lg font-bold text-amber-600">
              {avgRating ? `${avgRating} ★` : '—'}
            </div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
            <div className="text-[11px] font-medium text-slate-500">Speed Flags</div>
            <div className="text-lg font-bold text-rose-700">{flaggedVisits.length}</div>
          </div>
        </div>

        {/* Filter Tabs & Search */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/40 px-6 py-2.5">
          {/* Tabs */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1">
            <button
              type="button"
              onClick={() => setFilter('ALL')}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                filter === 'ALL'
                  ? 'bg-white text-navy-950 shadow-sm'
                  : 'text-slate-600 hover:text-navy-950'
              }`}
            >
              All ({carVisits.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('DONE')}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                filter === 'DONE'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-emerald-800 hover:bg-emerald-100/60'
              }`}
            >
              ✓ Completed ({doneVisits.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('MISSED')}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                filter === 'MISSED'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-amber-800 hover:bg-amber-100/60'
              }`}
            >
              ⚠ Missed ({missedVisits.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('FLAGGED')}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                filter === 'FLAGGED'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-rose-700 hover:bg-rose-100/60'
              }`}
            >
              ⚡ Flagged ({flaggedVisits.length})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <IconSearch className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by date, wash boy, service..."
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-navy-950 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Content List Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {filteredVisits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
                <IconCar width={24} height={24} />
              </div>
              <h3 className="text-sm font-bold text-navy-950">No wash records found</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                {search ? 'No washes match your search query.' : 'No washes have been logged for this vehicle under this filter.'}
              </p>
            </div>
          ) : (
            filteredVisits.map((visit) => {
              const staffMember = visit.staffId ? staffById.get(visit.staffId) : null;
              const duration = washDurationMinutes(visit);
              const speedFlag = washSpeedFlag(duration, settings);
              const beforePhoto = resolvePublicPhotoUrl(visit.beforePhotoUrl);
              const afterPhoto = resolvePublicPhotoUrl(visit.afterPhotoUrl);

              return (
                <div
                  key={visit.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-slate-300 transition"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-navy-950 text-sm">
                          {formatDateFull(visit.scheduledDate)}
                        </span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs font-semibold text-slate-600">
                          Scheduled: {visit.scheduledTime}
                        </span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-500 font-medium">Cycle: {visit.cycle}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-600">
                        {staffMember ? (
                          <div className="flex items-center gap-1 font-medium">
                            <IconUsers width={13} height={13} className="text-slate-400" />
                            <span>Wash Boy:</span>
                            <span className="font-bold text-navy-950">{staffMember.name}</span>
                            {staffMember.phone && <span className="text-slate-400">({staffMember.phone})</span>}
                          </div>
                        ) : (
                          <span className="text-slate-400">Unassigned staff</span>
                        )}
                      </div>
                    </div>

                    {/* Status & Speed Badge */}
                    <div className="flex flex-wrap items-center gap-2">
                      {speedFlag === 'fast' && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                          ⚡ Too Fast ({duration}m)
                        </span>
                      )}
                      {speedFlag === 'slow' && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                          🐢 Too Slow ({duration}m)
                        </span>
                      )}

                      {visit.status === 'DONE' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          <IconCheck width={12} height={12} strokeWidth={3} /> Done
                        </span>
                      ) : visit.status === 'MISSED' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                          <IconAlert width={12} height={12} /> {visit.missReason ? MISS_REASON_LABEL[visit.missReason] : 'Missed'}
                        </span>
                      ) : visit.status === 'IN_PROGRESS' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                          ⚡ In Progress
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          📅 Scheduled
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body: Details, Timing, Services, Photos */}
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left: Timing & Services */}
                    <div className="space-y-1.5 text-xs">
                      {visit.startedAt && visit.completedAt && (
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <IconClock width={14} height={14} className="text-slate-400" />
                          <span className="font-medium text-slate-500">Wash Time:</span>
                          <span className="font-semibold text-slate-800">
                            {formatClock(visit.startedAt)} → {formatClock(visit.completedAt)}
                          </span>
                          {duration !== null && (
                            <span className="text-slate-500 font-medium">({formatDurationMinutes(duration)})</span>
                          )}
                        </div>
                      )}

                      {/* Services Done */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="font-medium text-slate-500">Services:</span>
                        {Array.isArray(visit.servicesDone) && visit.servicesDone.length > 0 ? (
                          visit.servicesDone.map((svc) => (
                            <span
                              key={svc}
                              className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700"
                            >
                              ✓ {svc}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-600 font-medium">
                            {visit.plannedService ?? 'Standard Wash'}
                          </span>
                        )}
                      </div>

                      {/* Miss note if missed */}
                      {visit.missNote && (
                        <div className="text-amber-800 text-[11px] bg-amber-50/60 rounded p-1.5 border border-amber-100">
                          <span className="font-semibold">Miss Note:</span> {visit.missNote}
                        </div>
                      )}

                      {/* Ratings & Comments */}
                      {(visit.rating !== null || visit.managerRating !== null || visit.ratingComment) && (
                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3">
                          {visit.rating !== null && (
                            <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px]">
                              <IconStar width={12} height={12} /> {visit.rating} ★ Customer
                            </span>
                          )}
                          {visit.managerRating !== null && (
                            <span className="inline-flex items-center gap-1 font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded text-[11px]">
                              <IconStar width={12} height={12} /> {visit.managerRating} ★ Manager
                            </span>
                          )}
                          {visit.ratingComment && (
                            <span className="text-[11px] text-slate-600 italic">
                              &ldquo;{visit.ratingComment}&rdquo;
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right: Photos */}
                    <div className="flex items-center justify-start md:justify-end gap-3">
                      <div className="text-center">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                          Before Wash
                        </div>
                        {beforePhoto ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewPhoto({
                                url: beforePhoto,
                                title: `Before Wash — ${formatDateFull(visit.scheduledDate)} (${car.plate})`,
                              })
                            }
                            className="relative h-16 w-20 rounded-lg overflow-hidden border border-slate-200 shadow-xs hover:opacity-90 transition group cursor-pointer"
                          >
                            <Image
                              src={beforePhoto}
                              alt="Before wash"
                              fill
                              sizes="80px"
                              className="object-cover group-hover:scale-105 transition duration-200"
                            />
                          </button>
                        ) : (
                          <div className="h-16 w-20 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-[10px] text-slate-400">
                            No photo
                          </div>
                        )}
                      </div>

                      <div className="text-center">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                          After Wash
                        </div>
                        {afterPhoto ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewPhoto({
                                url: afterPhoto,
                                title: `After Wash — ${formatDateFull(visit.scheduledDate)} (${car.plate})`,
                              })
                            }
                            className="relative h-16 w-20 rounded-lg overflow-hidden border border-slate-200 shadow-xs hover:opacity-90 transition group cursor-pointer"
                          >
                            <Image
                              src={afterPhoto}
                              alt="After wash"
                              fill
                              sizes="80px"
                              className="object-cover group-hover:scale-105 transition duration-200"
                            />
                          </button>
                        ) : (
                          <div className="h-16 w-20 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-[10px] text-slate-400">
                            No photo
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Lightbox Photo Preview */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-h-[85vh] max-w-3xl overflow-hidden rounded-2xl bg-navy-950 shadow-2xl p-2 border border-slate-700">
            <div className="flex items-center justify-between p-3 text-white border-b border-slate-800">
              <span className="text-sm font-semibold">{previewPhoto.title}</span>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="relative h-[65vh] w-[75vw] max-w-2xl">
              <Image
                src={previewPhoto.url}
                alt="Full photo"
                fill
                sizes="(max-width: 1200px) 100vw, 800px"
                className="object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
