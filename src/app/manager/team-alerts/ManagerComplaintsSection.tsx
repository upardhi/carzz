'use client';

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/primitives';
import { formatDateFull } from '@/lib/util/format';
import type { ComplaintStatus } from '@/lib/data/types';

export interface ComplaintDisplayItem {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string | null;
  staffId: string | null;
  staffName: string | null;
  type: string;
  body: string;
  status: ComplaintStatus;
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export function ManagerComplaintsSection({
  complaints,
  staffList,
}: {
  complaints: ComplaintDisplayItem[];
  staffList: { id: string; name: string }[];
}) {
  const [filter, setFilter] = useState<'ALL' | 'OPEN' | 'ESCALATED' | 'RESOLVED'>('ALL');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('ALL');

  // Group complaint counts by staff member
  const staffComplaintStats = useMemo(() => {
    const counts = new Map<string, { total: number; open: number }>();
    for (const c of complaints) {
      if (c.staffId) {
        const prev = counts.get(c.staffId) || { total: 0, open: 0 };
        prev.total += 1;
        if (c.status === 'OPEN' || c.status === 'ESCALATED') {
          prev.open += 1;
        }
        counts.set(c.staffId, prev);
      }
    }
    return counts;
  }, [complaints]);

  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      if (filter !== 'ALL' && c.status !== filter) return false;
      if (selectedStaffId !== 'ALL' && c.staffId !== selectedStaffId) return false;
      return true;
    });
  }, [complaints, filter, selectedStaffId]);

  const openCount = complaints.filter((c) => c.status === 'OPEN').length;
  const escalatedCount = complaints.filter((c) => c.status === 'ESCALATED').length;
  const resolvedCount = complaints.filter((c) => c.status === 'RESOLVED').length;

  return (
    <div className="space-y-4">
      {/* Top Header & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-navy-950 flex items-center gap-2">
            <span>Customer Complaints &amp; Staff Issues</span>
            <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-black text-rose-700">
              {complaints.length}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track unresolved issues, dissatisfied customers, and wash boys with recurring complaints.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter Pills */}
          <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs">
            <button
              type="button"
              onClick={() => setFilter('ALL')}
              className={`rounded-lg px-2.5 py-1 font-bold transition-colors cursor-pointer ${
                filter === 'ALL'
                  ? 'bg-white text-navy-950 shadow-2xs'
                  : 'text-slate-600 hover:text-navy-950'
              }`}
            >
              All ({complaints.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('OPEN')}
              className={`rounded-lg px-2.5 py-1 font-bold transition-colors cursor-pointer ${
                filter === 'OPEN'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'text-amber-700 hover:bg-amber-100/50'
              }`}
            >
              Open ({openCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('ESCALATED')}
              className={`rounded-lg px-2.5 py-1 font-bold transition-colors cursor-pointer ${
                filter === 'ESCALATED'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-rose-700 hover:bg-rose-100/50'
              }`}
            >
              Escalated ({escalatedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('RESOLVED')}
              className={`rounded-lg px-2.5 py-1 font-bold transition-colors cursor-pointer ${
                filter === 'RESOLVED'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-emerald-700 hover:bg-emerald-100/50'
              }`}
            >
              Resolved ({resolvedCount})
            </button>
          </div>

          {/* Wash Boy Filter */}
          <select
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy-950 shadow-2xs focus:border-blue-600 focus:outline-none"
          >
            <option value="ALL">All Wash Boys</option>
            {staffList.map((s) => {
              const stats = staffComplaintStats.get(s.id);
              return (
                <option key={s.id} value={s.id}>
                  {s.name} {stats ? `(${stats.total} complaints${stats.open > 0 ? `, ${stats.open} open` : ''})` : ''}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Staff Complaint Breakdown Chips */}
      {staffComplaintStats.size > 0 && (
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Wash Boys with Complaints ({staffComplaintStats.size})
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {staffList
              .filter((s) => staffComplaintStats.has(s.id))
              .map((s) => {
                const stats = staffComplaintStats.get(s.id)!;
                const isSelected = selectedStaffId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedStaffId(isSelected ? 'ALL' : s.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-600 text-white shadow-xs'
                        : stats.open > 0
                        ? 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>👤 {s.name}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-black ${
                        isSelected
                          ? 'bg-white text-blue-900'
                          : stats.open > 0
                          ? 'bg-rose-600 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {stats.total}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Complaint Cards */}
      {filteredComplaints.length === 0 ? (
        <Card className="p-5 text-center text-xs text-slate-500">
          No complaints found matching the selected filter.
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredComplaints.map((c) => {
            const isEscalated = c.status === 'ESCALATED';
            const isOpen = c.status === 'OPEN';

            return (
              <Card
                key={c.id}
                className={`p-4 transition-all ${
                  isEscalated
                    ? 'border-rose-300 bg-rose-50/30 ring-1 ring-rose-200'
                    : isOpen
                    ? 'border-amber-200 bg-amber-50/20'
                    : 'border-slate-200'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900">{c.customerName}</span>
                    <span className="text-xs font-mono text-slate-500">{c.customerPhone}</span>
                    <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      🏷️ {c.type.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-md border px-2.5 py-0.5 text-[11px] font-bold ${
                        isEscalated
                          ? 'border-rose-300 bg-rose-100 text-rose-800'
                          : isOpen
                          ? 'border-amber-300 bg-amber-100 text-amber-900'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {isEscalated ? '🚨 ESCALATED' : isOpen ? '⏳ OPEN' : '✓ RESOLVED'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatDateFull(c.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="mt-2 text-xs text-slate-800 font-medium leading-relaxed bg-white/80 rounded-lg p-2.5 border border-slate-100">
                  {c.body}
                </div>

                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-slate-500 pt-2 border-t border-slate-100">
                  <div className="flex flex-wrap items-center gap-3">
                    <span>
                      Wash boy:{' '}
                      <strong className="text-slate-800 font-semibold">
                        {c.staffName ? `👤 ${c.staffName}` : '— (General / Unassigned)'}
                      </strong>
                    </span>
                    {c.customerAddress && (
                      <span>
                        📍 <span className="text-slate-600">{c.customerAddress}</span>
                      </span>
                    )}
                  </div>

                  {c.resolution && (
                    <div className="text-emerald-700 font-medium">
                      ✓ Resolution: <span className="italic">{c.resolution}</span>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
