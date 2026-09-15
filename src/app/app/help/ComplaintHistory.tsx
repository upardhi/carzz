'use client';

import { useState } from 'react';
import type { ComplaintType, ComplaintStatus } from '@/lib/data/types';
import { COMPLAINT_TYPE_LABEL } from '@/lib/util/labels';
import { formatDateFull } from '@/lib/util/format';

export interface ComplaintItemData {
  id: string;
  type: ComplaintType;
  body: string;
  status: ComplaintStatus;
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
  carName?: string | null;
  carPlate?: string | null;
  staffName?: string | null;
}

export function ComplaintHistory({ complaints }: { complaints: ComplaintItemData[] }) {
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('ALL');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const totalCount = complaints.length;
  const openCount = complaints.filter(
    (c) => c.status === 'OPEN' || c.status === 'ESCALATED',
  ).length;
  const resolvedCount = complaints.filter((c) => c.status === 'RESOLVED').length;

  const filtered = complaints.filter((c) => {
    if (filter === 'OPEN') return c.status === 'OPEN' || c.status === 'ESCALATED';
    if (filter === 'RESOLVED') return c.status === 'RESOLVED';
    return true;
  });

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: prev[id] === undefined ? false : !prev[id],
    }));
  };

  const isRescheduled = (resolution: string | null) => {
    if (!resolution) return false;
    const lower = resolution.toLowerCase();
    return (
      lower.includes('reschedul') ||
      lower.includes('re-wash') ||
      lower.includes('rewash') ||
      lower.includes('returned to count')
    );
  };

  return (
    <div className="space-y-3">
      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1 rounded-lg text-[12px] font-semibold transition-all ${
              filter === 'ALL'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            All ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('OPEN')}
            className={`px-3 py-1 rounded-lg text-[12px] font-semibold transition-all ${
              filter === 'OPEN'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-500 hover:text-amber-700'
            }`}
          >
            Under Review ({openCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('RESOLVED')}
            className={`px-3 py-1 rounded-lg text-[12px] font-semibold transition-all ${
              filter === 'RESOLVED'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-500 hover:text-emerald-700'
            }`}
          >
            Resolved ({resolvedCount})
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
          <p className="text-sm font-medium text-slate-500">
            {filter === 'RESOLVED'
              ? 'No resolved complaints found.'
              : filter === 'OPEN'
                ? 'No active complaints under review.'
                : 'You have not raised any complaints yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((complaint) => {
            const isExpanded = expandedIds[complaint.id] ?? true;
            const isResolved = complaint.status === 'RESOLVED';
            const isEscalated = complaint.status === 'ESCALATED';
            const rescheduled = isRescheduled(complaint.resolution);

            return (
              <div
                key={complaint.id}
                className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs transition-all hover:border-slate-300"
              >
                {/* Header row */}
                <div
                  onClick={() => toggleExpand(complaint.id)}
                  className="flex cursor-pointer items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13.5px] font-semibold text-slate-900">
                        {COMPLAINT_TYPE_LABEL[complaint.type] || complaint.type}
                      </span>
                      {complaint.carName && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50/80 px-2 py-0.5 text-[11px] font-semibold text-blue-900 border border-blue-200">
                          <span>🚗</span>
                          <span>{complaint.carName}</span>
                          {complaint.carPlate && (
                            <span className="text-blue-600">· {complaint.carPlate}</span>
                          )}
                        </span>
                      )}
                      {rescheduled && isResolved && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                          <svg
                            className="h-3 w-3"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                            <path d="M21 3v5h-5" />
                            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                            <path d="M3 21v-5h5" />
                          </svg>
                          Rescheduled
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11.5px] font-medium text-slate-500">
                      Filed on {formatDateFull(complaint.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold border shadow-2xs ${
                        isResolved
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : isEscalated
                            ? 'border-rose-200 bg-rose-50 text-rose-700'
                            : 'border-amber-200 bg-amber-50 text-amber-700'
                      }`}
                    >
                      {isResolved ? (
                        <>
                          <svg
                            className="h-3 w-3"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Resolved
                        </>
                      ) : isEscalated ? (
                        <>
                          <svg
                            className="h-3 w-3"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <path d="M12 9v4M12 17h.01" />
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          </svg>
                          Escalated
                        </>
                      ) : (
                        <>
                          <svg
                            className="h-3 w-3 animate-spin"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                          </svg>
                          Under Review
                        </>
                      )}
                    </span>

                    <button
                      type="button"
                      aria-label="Toggle details"
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <svg
                        className={`h-4 w-4 transform transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Expanded Details Body */}
                {isExpanded && (
                  <div className="p-4 space-y-3">
                    {/* Vehicle & Cleaner summary bar */}
                    {(complaint.carName || complaint.staffName) && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-xs">
                        {complaint.carName && (
                          <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                            <span>🚗</span>
                            <span>{complaint.carName}</span>
                            {complaint.carPlate && (
                              <span className="font-medium text-slate-500">({complaint.carPlate})</span>
                            )}
                          </div>
                        )}
                        {complaint.staffName && (
                          <div className="text-[11.5px] font-medium text-slate-600">
                            Assigned cleaner:{' '}
                            <span className="font-semibold text-slate-900">{complaint.staffName}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* What the customer reported */}
                    {complaint.body && (
                      <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                          What you reported
                        </div>
                        <p className="text-[13px] text-slate-700 leading-relaxed font-medium">
                          {complaint.body}
                        </p>
                      </div>
                    )}

                    {/* What happened with the complaint (Resolution Section) */}
                    {isResolved ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-emerald-800 uppercase tracking-wide">
                            <svg
                              className="h-4 w-4 text-emerald-600 shrink-0"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                            >
                              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                              <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                            Action Taken / Manager Response
                          </div>
                          {complaint.resolvedAt && (
                            <span className="text-[11px] font-semibold text-emerald-700/80">
                              {formatDateFull(complaint.resolvedAt)}
                            </span>
                          )}
                        </div>

                        <div className="text-[13.5px] font-medium text-emerald-950 bg-white/80 rounded-lg p-2.5 border border-emerald-100">
                          {complaint.resolution || 'Your complaint has been resolved by the area manager.'}
                        </div>

                        {rescheduled && (
                          <div className="mt-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-emerald-800">
                            <span>✨</span>
                            <span>
                              Free re-wash credited to{' '}
                              <strong className="underline decoration-emerald-500">
                                {complaint.carName || 'your car'}{complaint.carPlate ? ` (${complaint.carPlate})` : ''}
                              </strong>
                              . You can check your updated quota on the <strong>My Cars</strong> tab.
                            </span>
                          </div>
                        )}
                      </div>
                    ) : isEscalated ? (
                      <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5">
                        <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-rose-800 uppercase tracking-wide mb-1.5">
                          <svg
                            className="h-4 w-4 text-rose-600 shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                          >
                            <path d="M12 9v4M12 17h.01" />
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          </svg>
                          Priority Escalation in Progress
                        </div>
                        <p className="text-[12.5px] font-medium text-rose-900 leading-relaxed">
                          Your complaint has been escalated directly to Senior Management / Area Owner for priority resolution. An update or reschedule confirmation will be posted here shortly.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
                        <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-amber-800 uppercase tracking-wide mb-1.5">
                          <svg
                            className="h-4 w-4 text-amber-600 shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          Under Manager Investigation
                        </div>
                        <p className="text-[12.5px] font-medium text-amber-900 leading-relaxed">
                          Your Area Manager is currently reviewing this with the assigned wash staff. As soon as action is taken (e.g. rescheduling your wash, re-wash, or slot adjustment), the resolution details will appear right here.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
