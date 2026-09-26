'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  IconAlert,
  IconCar,
  IconClock,
  IconRefresh,
  IconSearch,
  IconStar,
  IconUsers,
} from '@/components/shell/icons';
import { useDebounce } from '@/lib/util/debounce';

export interface FlaggedWashItem {
  id: string;
  scheduledDate: string;
  dateLabel: string;
  timeLabel: string;
  startedAtLabel: string | null;
  completedAtLabel: string | null;
  durationMinutes: number | null;
  durationLabel: string;
  speedFlag: 'fast' | 'slow';
  speedThresholdMin: number;
  speedThresholdMax: number;
  plannedService: string;
  servicesDone: string[];
  rating: number | null;
  ratingComment: string | null;
  managerRating: number | null;
  managerRatingComment: string | null;
  beforePhotoUrl: string | null;
  afterPhotoUrl: string | null;
  customer: {
    id: string;
    name: string;
    phone: string;
    address: string;
  };
  car: {
    id: string;
    make: string;
    model: string;
    plateNumber: string;
    color: string;
  };
  staff: {
    id: string;
    name: string;
    phone: string;
  } | null;
  areaName: string;
}

interface FlaggedWashesStats {
  totalFlagged: number;
  fastCount: number;
  slowCount: number;
  minWashMinutes: number;
  maxWashMinutes: number;
}

interface FlaggedWashesModalProps {
  staffId?: string;
  staffName?: string;
  areaId?: string;
  cycle?: string;
  onClose: () => void;
}

export function FlaggedWashesModal({
  staffId,
  staffName,
  areaId,
  cycle,
  onClose,
}: FlaggedWashesModalProps) {
  const [loading, setLoading] = useState(true);
  const [speedFilter, setSpeedFilter] = useState<'ALL' | 'fast' | 'slow'>('ALL');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  const [page, setPage] = useState(1);
  const pageSize = 8;
  const [stats, setStats] = useState<FlaggedWashesStats | null>(null);
  const [items, setItems] = useState<FlaggedWashItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 8,
    totalItems: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });

  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string } | null>(null);

  const fetchFlaggedWashes = useCallback(
    async (targetPage: number, filter: 'ALL' | 'fast' | 'slow', query: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          speedType: filter,
          page: String(targetPage),
          pageSize: String(pageSize),
        });
        if (staffId) params.set('staffId', staffId);
        if (areaId) params.set('areaId', areaId);
        if (cycle) params.set('cycle', cycle);
        if (query.trim()) params.set('search', query.trim());

        const res = await fetch(`/api/ops/washes/flagged?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to fetch flagged washes');

        const json = await res.json();
        if (json.ok) {
          setItems(json.items || []);
          if (json.stats) setStats(json.stats);
          if (json.pagination) setPagination(json.pagination);
        }
      } catch (err) {
        console.error('Failed to load flagged washes:', err);
      } finally {
        setLoading(false);
      }
    },
    [staffId, areaId, cycle, pageSize],
  );

  useEffect(() => {
    fetchFlaggedWashes(page, speedFilter, debouncedSearch);
  }, [page, speedFilter, debouncedSearch, fetchFlaggedWashes]);

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
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
              <IconAlert width={22} height={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-navy-950">
                  {staffName ? `${staffName} — Flagged Washes` : 'Flagged Washes Audit'}
                </h2>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 border border-amber-200">
                  {pagination.totalItems} flagged
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Washes that finished unusually fast or took much longer than normal thresholds.
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

        {/* Stats and Thresholds Strip */}
        {stats && (
          <div className="grid grid-cols-3 gap-2 border-b border-slate-100 bg-white px-6 py-3 text-center">
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
              <div className="text-[11px] font-medium text-slate-500">Total Flagged</div>
              <div className="text-lg font-bold text-navy-950">{stats.totalFlagged}</div>
            </div>
            <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-2.5">
              <div className="text-[11px] font-medium text-rose-700">⚡ Too Fast (&lt; {stats.minWashMinutes}m)</div>
              <div className="text-lg font-bold text-rose-700">{stats.fastCount}</div>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-2.5">
              <div className="text-[11px] font-medium text-amber-800">🐢 Too Slow (&gt; {stats.maxWashMinutes}m)</div>
              <div className="text-lg font-bold text-amber-800">{stats.slowCount}</div>
            </div>
          </div>
        )}

        {/* Filter Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/40 px-6 py-2.5">
          {/* Tabs */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-200/70 p-1">
            <button
              type="button"
              onClick={() => {
                setSpeedFilter('ALL');
                setPage(1);
              }}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
                speedFilter === 'ALL'
                  ? 'bg-white text-navy-950 shadow-sm'
                  : 'text-slate-600 hover:text-navy-950'
              }`}
            >
              All ({stats ? stats.totalFlagged : '...'})
            </button>
            <button
              type="button"
              onClick={() => {
                setSpeedFilter('fast');
                setPage(1);
              }}
              className={`flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold transition ${
                speedFilter === 'fast'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-rose-700 hover:bg-rose-100/60'
              }`}
            >
              <span>⚡ Too Fast</span>
              {stats && <span className="opacity-90">({stats.fastCount})</span>}
            </button>
            <button
              type="button"
              onClick={() => {
                setSpeedFilter('slow');
                setPage(1);
              }}
              className={`flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold transition ${
                speedFilter === 'slow'
                  ? 'bg-amber-700 text-white shadow-sm'
                  : 'text-amber-800 hover:bg-amber-100/60'
              }`}
            >
              <span>🐢 Too Slow</span>
              {stats && <span className="opacity-90">({stats.slowCount})</span>}
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
            <IconSearch className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, plate, staff..."
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-navy-950 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <IconRefresh className="h-6 w-6 animate-spin text-amber-600 mb-2" />
              <p className="text-sm">Loading flagged washes...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-3">
                <IconCar width={24} height={24} />
              </div>
              <h3 className="text-sm font-bold text-navy-950">No flagged washes found</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                All washes for this period completed within standard time thresholds.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 transition"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-navy-950 text-sm">{item.customer.name}</span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs font-semibold text-slate-600">{item.customer.phone}</span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                          {item.areaName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                        <span className="font-medium text-slate-700">
                          {item.car.make} {item.car.model} ({item.car.plateNumber})
                        </span>
                        {item.customer.address && (
                          <>
                            <span>·</span>
                            <span className="truncate max-w-[280px]" title={item.customer.address}>
                              {item.customer.address}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Speed Flag Badge */}
                    <div className="flex items-center gap-2">
                      {item.speedFlag === 'fast' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 shadow-sm">
                          <span>⚡ Too Fast:</span>
                          <span className="underline">{item.durationLabel}</span>
                          <span className="text-[10px] opacity-75 font-normal">(&lt;{item.speedThresholdMin}m)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 shadow-sm">
                          <span>🐢 Too Slow:</span>
                          <span className="underline">{item.durationLabel}</span>
                          <span className="text-[10px] opacity-75 font-normal">(&gt;{item.speedThresholdMax}m)</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body Info: Staff & Photos */}
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left: Timing & Staff Info */}
                    <div className="space-y-1.5 text-xs">
                      {item.staff && (
                        <div className="flex items-center gap-1.5 text-slate-700">
                          <IconUsers width={14} height={14} className="text-slate-400" />
                          <span className="font-medium text-slate-500">Wash Boy:</span>
                          <span className="font-bold text-navy-950">{item.staff.name}</span>
                          <span className="text-slate-400">({item.staff.phone})</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <IconClock width={14} height={14} className="text-slate-400" />
                        <span className="font-medium text-slate-500">Scheduled:</span>
                        <span className="font-semibold text-slate-800">{item.dateLabel} at {item.timeLabel}</span>
                      </div>
                      {item.startedAtLabel && item.completedAtLabel && (
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <span className="font-medium text-slate-500">Actual Wash:</span>
                          <span>Started {item.startedAtLabel} → Completed {item.completedAtLabel}</span>
                        </div>
                      )}

                      {/* Ratings or notes if any */}
                      {(item.rating !== null || item.managerRating !== null || item.ratingComment) && (
                        <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3">
                          {item.rating !== null && (
                            <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px]">
                              <IconStar width={12} height={12} /> {item.rating} ★ Customer
                            </span>
                          )}
                          {item.managerRating !== null && (
                            <span className="inline-flex items-center gap-1 font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded text-[11px]">
                              <IconStar width={12} height={12} /> {item.managerRating} ★ Manager
                            </span>
                          )}
                          {item.ratingComment && (
                            <span className="text-[11px] text-slate-600 italic">
                              &ldquo;{item.ratingComment}&rdquo;
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right: Before & After Photos */}
                    <div className="flex items-center justify-start md:justify-end gap-3">
                      <div className="text-center">
                        <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                          Before Photo
                        </div>
                        {item.beforePhotoUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewPhoto({
                                url: item.beforePhotoUrl!,
                                title: `Before Wash — ${item.customer.name} (${item.car.plateNumber})`,
                              })
                            }
                            className="relative h-16 w-20 rounded-lg overflow-hidden border border-slate-200 shadow-sm hover:opacity-90 transition group"
                          >
                            <Image
                              src={item.beforePhotoUrl}
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
                          After Photo
                        </div>
                        {item.afterPhotoUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewPhoto({
                                url: item.afterPhotoUrl!,
                                title: `After Wash — ${item.customer.name} (${item.car.plateNumber})`,
                              })
                            }
                            className="relative h-16 w-20 rounded-lg overflow-hidden border border-slate-200 shadow-sm hover:opacity-90 transition group"
                          >
                            <Image
                              src={item.afterPhotoUrl}
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
              ))}
            </div>
          )}
        </div>

        {/* Footer with Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-3 text-xs text-slate-600">
            <div>
              Showing <span className="font-bold text-navy-950">{(page - 1) * pageSize + 1}</span> to{' '}
              <span className="font-bold text-navy-950">
                {Math.min(page * pageSize, pagination.totalItems)}
              </span>{' '}
              of <span className="font-bold text-navy-950">{pagination.totalItems}</span> flagged washes
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!pagination.hasPrev}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Previous
              </button>
              <span className="text-slate-500 font-medium">
                Page {page} of {pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={!pagination.hasNext}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox / Full Photo Preview Modal */}
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
