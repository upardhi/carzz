'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconArrowUp,
  IconCalendar,
  IconChat,
  IconCheck,
  IconClock,
  IconFolder,
  IconGrid,
  IconList,
  IconMapPin,
  IconMoreVertical,
  IconTrendingUp,
  IconUser,
} from '@/components/shell/icons';
import { useToast } from '@/components/ui/ToastProvider';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { Button } from '@/components/ui/primitives';
import type { Complaint, Area, Staff, Customer } from '@/lib/data/types';
import { COMPLAINT_TYPE_LABEL } from '@/lib/util/labels';
import { formatDateFull, relativeDays } from '@/lib/util/format';

const QUICK_SUGGESTIONS = [
  'Free re-wash scheduled',
  'Rescheduled',
  'Receipt re-sent',
  'Slot changed',
  'Spoken to the wash boy',
];

interface ComplaintsClientProps {
  complaints: Complaint[];
  areas: Area[];
  staff: Staff[];
  customers: Customer[];
  canEscalate: boolean;
}

export function ComplaintsClient({
  complaints,
  areas,
  staff,
  customers,
  canEscalate,
}: ComplaintsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const showConfirm = useConfirm();

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'ESCALATED' | 'RESOLVED'>('ALL');
  const [timeFilter, setTimeFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');
  const [sortBy, setSortBy] = useState<'LATEST' | 'OLDEST'>('LATEST');
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');

  // Expanded reply state for each card
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<{ [id: string]: string }>({});
  const [pendingAction, setPendingAction] = useState<{ [id: string]: 'resolve' | 'escalate' | null }>({});

  const areaById = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);
  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  // Overall KPIs
  const openComplaints = useMemo(() => complaints.filter((c) => c.status === 'OPEN'), [complaints]);
  const escalatedComplaints = useMemo(() => complaints.filter((c) => c.status === 'ESCALATED'), [complaints]);
  const resolvedComplaints = useMemo(() => complaints.filter((c) => c.status === 'RESOLVED'), [complaints]);

  const resolutionDays = useMemo(() => {
    return resolvedComplaints
      .filter((c) => c.resolvedAt)
      .map(
        (c) =>
          (new Date(c.resolvedAt!).getTime() - new Date(c.createdAt).getTime()) /
          86400000,
      );
  }, [resolvedComplaints]);

  const avgResolutionTime = useMemo(() => {
    if (!resolutionDays.length) return '—';
    const avg = resolutionDays.reduce((a, b) => a + b, 0) / resolutionDays.length;
    return `${avg.toFixed(1)}d`;
  }, [resolutionDays]);

  const oldestOpen = useMemo(() => {
    const active = complaints.filter((c) => c.status !== 'RESOLVED');
    if (!active.length) return null;
    return [...active].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )[0];
  }, [complaints]);

  // Filtered & Sorted complaints
  const filteredComplaints = useMemo(() => {
    return complaints
      .filter((c) => {
        // Status filter
        if (statusFilter === 'OPEN' && c.status !== 'OPEN') return false;
        if (statusFilter === 'ESCALATED' && c.status !== 'ESCALATED') return false;
        if (statusFilter === 'RESOLVED' && c.status !== 'RESOLVED') return false;

        // Time filter
        if (timeFilter !== 'ALL') {
          const created = new Date(c.createdAt).getTime();
          const now = Date.now();
          const oneDay = 86400000;
          if (timeFilter === 'TODAY' && now - created > oneDay) return false;
          if (timeFilter === 'WEEK' && now - created > 7 * oneDay) return false;
          if (timeFilter === 'MONTH' && now - created > 30 * oneDay) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return sortBy === 'LATEST' ? timeB - timeA : timeA - timeB;
      });
  }, [complaints, statusFilter, timeFilter, sortBy]);

  async function handleSend(complaintId: string, action: 'resolve' | 'escalate') {
    const resolution = replyText[complaintId] || '';
    if (action === 'resolve' && resolution.trim().length < 3) {
      toast.error('Please enter a resolution note before closing.');
      return;
    }

    if (action === 'escalate') {
      const ok = await showConfirm({
        title: 'Escalate to Owner',
        message: 'Are you sure you want to escalate this complaint to the owner?',
        tone: 'danger',
        confirmText: 'Escalate',
      });
      if (!ok) return;
    }

    setPendingAction((prev) => ({ ...prev, [complaintId]: action }));
    try {
      const res = await fetch('/api/ops/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ complaintId, action, resolution }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? 'Could not complete request.');
        return;
      }
      toast.success(
        data.message ??
          (action === 'resolve'
            ? 'Closed and the customer has been told.'
            : 'Escalated to owner.'),
      );
      setReplyingId(null);
      setReplyText((prev) => ({ ...prev, [complaintId]: '' }));
      router.refresh();
    } catch {
      toast.error('No connection. Try again.');
    } finally {
      setPendingAction((prev) => ({ ...prev, [complaintId]: null }));
    }
  }

  return (
    <div className="space-y-5">
      {/* 5 KPI Metric Cards Header */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* Open */}
        <div className="flex items-center gap-3.5 rounded-xl border border-line-soft bg-white p-4 shadow-sm">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <IconFolder width={22} height={22} strokeWidth={2} />
          </div>
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-ink-mute">
              OPEN
            </div>
            <div className="text-2xl font-black text-navy-950">
              {openComplaints.length}
            </div>
            <div className="text-[11px] font-medium text-ink-faint">
              Active complaints
            </div>
          </div>
        </div>

        {/* Escalated */}
        <div className="flex items-center gap-3.5 rounded-xl border border-line-soft bg-white p-4 shadow-sm">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <IconTrendingUp width={22} height={22} strokeWidth={2} />
          </div>
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-ink-mute">
              ESCALATED
            </div>
            <div className="text-2xl font-black text-amber-600">
              {escalatedComplaints.length}
            </div>
            <div className="text-[11px] font-medium text-ink-faint">
              Needs attention
            </div>
          </div>
        </div>

        {/* Resolved */}
        <div className="flex items-center gap-3.5 rounded-xl border border-line-soft bg-white p-4 shadow-sm">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <IconCheck width={22} height={22} strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-ink-mute">
              RESOLVED
            </div>
            <div className="text-2xl font-black text-emerald-600">
              {resolvedComplaints.length}
            </div>
            <div className="text-[11px] font-medium text-ink-faint">
              Completed
            </div>
          </div>
        </div>

        {/* Avg Resolution */}
        <div className="flex items-center gap-3.5 rounded-xl border border-line-soft bg-white p-4 shadow-sm">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
            <IconClock width={22} height={22} strokeWidth={2} />
          </div>
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-ink-mute">
              AVG RESOLUTION
            </div>
            <div className="text-2xl font-black text-navy-950">
              {avgResolutionTime}
            </div>
            <div className="text-[11px] font-medium text-ink-faint">
              Average time
            </div>
          </div>
        </div>

        {/* Oldest Open */}
        <div className="col-span-2 flex items-center gap-3.5 rounded-xl border border-line-soft bg-white p-4 shadow-sm sm:col-span-1">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <IconCalendar width={22} height={22} strokeWidth={2} />
          </div>
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-ink-mute">
              OLDEST OPEN
            </div>
            <div className="text-xl font-black text-rose-600 sm:text-2xl">
              {oldestOpen ? relativeDays(oldestOpen.createdAt) : '—'}
            </div>
            <div className="text-[11px] font-medium text-ink-faint">
              {oldestOpen ? formatDateFull(oldestOpen.createdAt) : 'No open complaints'}
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Toolbar Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-soft bg-white p-3 shadow-sm">
        {/* Left: Status & Time Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="flex items-center rounded-lg bg-surface-muted p-1">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-navy-900 text-white shadow-sm'
                  : 'text-ink-mute hover:text-navy-900'
              }`}
            >
              All ({complaints.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('OPEN')}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                statusFilter === 'OPEN'
                  ? 'bg-navy-900 text-white shadow-sm'
                  : 'text-ink-mute hover:text-navy-900'
              }`}
            >
              Open ({openComplaints.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ESCALATED')}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                statusFilter === 'ESCALATED'
                  ? 'bg-navy-900 text-white shadow-sm'
                  : 'text-ink-mute hover:text-navy-900'
              }`}
            >
              Escalated ({escalatedComplaints.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('RESOLVED')}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                statusFilter === 'RESOLVED'
                  ? 'bg-navy-900 text-white shadow-sm'
                  : 'text-ink-mute hover:text-navy-900'
              }`}
            >
              Resolved ({resolvedComplaints.length})
            </button>
          </div>

          {/* Time Filter Group */}
          <div className="flex items-center rounded-lg border border-line-soft bg-white p-1">
            {(
              [
                ['ALL', 'All Time'],
                ['TODAY', 'Today'],
                ['WEEK', 'This Week'],
                ['MONTH', 'This Month'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTimeFilter(key)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  timeFilter === key
                    ? 'bg-navy-100 font-bold text-navy-900'
                    : 'text-ink-mute hover:text-navy-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Sort & View Toggle */}
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'LATEST' | 'OLDEST')}
            aria-label="Sort complaints"
            className="rounded-lg border border-line-strong bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-sm hover:border-navy-400 focus:border-navy-600 focus:outline-none"
          >
            <option value="LATEST">Latest raised</option>
            <option value="OLDEST">Oldest raised</option>
          </select>

          <div className="flex items-center rounded-lg border border-line-soft bg-surface-muted p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('GRID')}
              title="Grid view"
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-all ${
                viewMode === 'GRID'
                  ? 'bg-white font-bold text-navy-900 shadow-sm'
                  : 'text-ink-mute hover:text-navy-900'
              }`}
            >
              <IconGrid width={15} height={15} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('LIST')}
              title="List view"
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-all ${
                viewMode === 'LIST'
                  ? 'bg-white font-bold text-navy-900 shadow-sm'
                  : 'text-ink-mute hover:text-navy-900'
              }`}
            >
              <IconList width={15} height={15} strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </div>

      {/* Complaints Cards Display */}
      {filteredComplaints.length === 0 ? (
        <div className="rounded-2xl border border-line-soft bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-navy-50 text-navy-600">
            <IconCheck width={28} height={28} strokeWidth={2.5} />
          </div>
          <h3 className="mt-4 text-base font-bold text-navy-950">
            No complaints found
          </h3>
          <p className="mt-1 text-sm text-ink-mute">
            There are no complaints matching your selected filters.
          </p>
        </div>
      ) : (
        <div
          className={
            viewMode === 'GRID'
              ? 'grid gap-4 lg:grid-cols-2'
              : 'space-y-4'
          }
        >
          {filteredComplaints.map((complaint) => {
            const customer = customerById.get(complaint.customerId);
            const area = areaById.get(complaint.areaId);
            const washBoy = complaint.staffId ? staffById.get(complaint.staffId) : null;
            const isReplying = replyingId === complaint.id;
            const isPending = pendingAction[complaint.id];

            const borderAccent =
              complaint.status === 'ESCALATED'
                ? 'border-l-4 border-l-rose-500'
                : complaint.status === 'RESOLVED'
                  ? 'border-l-4 border-l-emerald-500'
                  : 'border-l-4 border-l-amber-400';

            return (
              <div
                key={complaint.id}
                className={`flex flex-col justify-between rounded-xl border border-line-soft bg-white p-5 shadow-sm transition-all hover:shadow-md ${borderAccent}`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-[15px] font-extrabold text-navy-950">
                      {COMPLAINT_TYPE_LABEL[complaint.type] || complaint.type}
                    </h3>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        complaint.status === 'ESCALATED'
                          ? 'bg-rose-100 text-rose-800'
                          : complaint.status === 'RESOLVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {complaint.status === 'ESCALATED'
                        ? 'Escalated'
                        : complaint.status === 'RESOLVED'
                          ? 'Resolved'
                          : 'Open'}
                    </span>
                  </div>

                  {/* Metadata Grid */}
                  <div className="mt-3.5 space-y-2 text-sm">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-2 text-ink-mute">
                        <IconUser width={15} height={15} className="text-slate-400" />
                        Customer
                      </span>
                      <span className="font-bold text-navy-950">
                        {customer?.name ?? '—'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-2 text-ink-mute">
                        <IconMapPin width={15} height={15} className="text-slate-400" />
                        Area
                      </span>
                      <span className="font-semibold text-slate-800">
                        {area?.name ?? '—'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-2 text-ink-mute">
                        <IconUser width={15} height={15} className="text-slate-400" />
                        Wash boy
                      </span>
                      <span className="font-semibold text-slate-800">
                        {washBoy?.name ?? '—'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-2 text-ink-mute">
                        <IconCalendar width={15} height={15} className="text-slate-400" />
                        Raised
                      </span>
                      <span className="text-xs font-semibold text-slate-700">
                        {formatDateFull(complaint.createdAt)} ·{' '}
                        <span className="font-normal text-ink-mute">
                          {relativeDays(complaint.createdAt)}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Customer Quote Bubble */}
                  <div className="my-3.5 rounded-xl bg-surface-muted p-3.5 text-sm italic text-slate-700">
                    &ldquo;{complaint.body}&rdquo;
                  </div>

                  {/* Quick Resolution Suggestion Chips (for open complaints) */}
                  {complaint.status !== 'RESOLVED' ? (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {QUICK_SUGGESTIONS.map((text) => (
                        <button
                          key={text}
                          type="button"
                          onClick={() => {
                            setReplyingId(complaint.id);
                            setReplyText((prev) => ({
                              ...prev,
                              [complaint.id]: text,
                            }));
                          }}
                          className="rounded-full border border-line-strong bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:border-navy-400 hover:bg-navy-50 hover:text-navy-900"
                        >
                          {text}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {/* Resolution Notes for Resolved complaints */}
                  {complaint.status === 'RESOLVED' && complaint.resolution ? (
                    <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5 text-xs text-emerald-900">
                      <span className="font-bold uppercase tracking-wider text-emerald-800">
                        Resolution:
                      </span>{' '}
                      {complaint.resolution}
                    </div>
                  ) : null}

                  {/* Inline Reply Box (when expanded) */}
                  {isReplying && complaint.status !== 'RESOLVED' ? (
                    <div className="mb-3 space-y-2 rounded-xl border border-navy-200 bg-navy-50/40 p-3">
                      <label className="block text-xs font-bold text-navy-950">
                        Resolution note for customer:
                      </label>
                      <textarea
                        rows={2}
                        value={replyText[complaint.id] || ''}
                        onChange={(e) =>
                          setReplyText((prev) => ({
                            ...prev,
                            [complaint.id]: e.target.value,
                          }))
                        }
                        placeholder="What action did you take? This will be communicated to the customer."
                        className="w-full rounded-lg border border-line-strong bg-white p-2.5 text-sm text-slate-800 focus:border-navy-600 focus:outline-none"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setReplyingId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          disabled={
                            isPending !== null ||
                            (replyText[complaint.id] || '').trim().length < 3
                          }
                          onClick={() => handleSend(complaint.id, 'resolve')}
                        >
                          {isPending === 'resolve' ? 'Closing…' : 'Submit & Close'}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Bottom Card Actions */}
                {complaint.status !== 'RESOLVED' ? (
                  <div className="mt-2 flex items-center gap-2 pt-2">
                    {!isReplying ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex items-center gap-1.5"
                        onClick={() => setReplyingId(complaint.id)}
                      >
                        <IconChat width={14} height={14} />
                        Reply & close
                      </Button>
                    ) : null}

                    {canEscalate && complaint.status !== 'ESCALATED' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={isPending !== null}
                        className="flex items-center gap-1.5"
                        onClick={() => handleSend(complaint.id, 'escalate')}
                      >
                        <IconArrowUp width={14} height={14} />
                        {isPending === 'escalate' ? 'Sending…' : 'Escalate to owner'}
                      </Button>
                    ) : complaint.status === 'ESCALATED' ? (
                      <button
                        disabled
                        className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600"
                      >
                        <IconArrowUp width={14} height={14} />
                        Escalated to owner
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-2 text-xs font-semibold text-emerald-700">
                    ✓ Closed on {formatDateFull(complaint.resolvedAt ?? complaint.createdAt)}
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
