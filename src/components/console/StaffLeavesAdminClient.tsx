'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  IconCalendar,
  IconCheckCircle,
  IconClock,
  IconPlus,
  IconSearch,
  IconUserX,
  IconUsers,
} from '@/components/shell/icons';
import {
  StatCard,
  StatGrid,
} from '@/components/ui/primitives';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { DataTable } from '@/components/ui/DataTable';
import { formatDateFull, todayISO } from '@/lib/util/format';
import type { StaffLeave, LeaveType, LeaveStatus } from '@/lib/data/types';

export interface EnrichedStaffLeave extends StaffLeave {
  staffName: string;
  staffPhone: string;
  areaId: string;
  areaName: string;
}

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  PLANNED: 'Planned (Advance)',
  ON_THE_SPOT: 'On-the-spot / Urgent',
  EMERGENCY: 'Emergency',
  SICK: 'Sick / Medical',
  CASUAL: 'Casual Leave',
  HALF_DAY: 'Half Day',
  UNINFORMED: 'Uninformed',
  OTHER: 'Other Reason',
};

interface StaffLeavesAdminClientProps {
  leaves: EnrichedStaffLeave[];
  staff: Array<{ id: string; name: string; areaId: string; phone: string }>;
  areas: Array<{ id: string; name: string }>;
  base: string;
  backHref?: string;
}

export function StaffLeavesAdminClient({
  leaves: initialLeaves,
  staff,
  areas,
  base,
  backHref,
}: StaffLeavesAdminClientProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const today = todayISO();

  const [leaves, setLeaves] = useState<EnrichedStaffLeave[]>(initialLeaves);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [staffFilter, setStaffFilter] = useState<string>('ALL');
  const [areaFilter, setAreaFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Add Leave Modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState(staff[0]?.id ?? '');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [leaveType, setLeaveType] = useState<LeaveType>('PLANNED');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Reject Modal state
  const [rejectingLeave, setRejectingLeave] = useState<EnrichedStaffLeave | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // Quick preset dates
  function setPreset(daysInAdvance: number, type: LeaveType) {
    const d = new Date();
    d.setDate(d.getDate() + daysInAdvance);
    const isoDate = d.toISOString().slice(0, 10);
    setStartDate(isoDate);
    setEndDate(isoDate);
    setLeaveType(type);
  }

  // Filtered leaves
  const filteredLeaves = leaves.filter((l) => {
    if (statusFilter !== 'ALL' && l.status !== statusFilter) return false;
    if (staffFilter !== 'ALL' && l.staffId !== staffFilter) return false;
    if (areaFilter !== 'ALL' && l.areaId !== areaFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchStaff = l.staffName.toLowerCase().includes(q);
      const matchArea = l.areaName.toLowerCase().includes(q);
      const matchReason = l.reason.toLowerCase().includes(q);
      if (!matchStaff && !matchArea && !matchReason) return false;
    }
    return true;
  });

  const pendingLeaves = leaves.filter((l) => l.status === 'PENDING');
  const onLeaveToday = leaves.filter(
    (l) => l.status === 'APPROVED' && l.startDate <= today && l.endDate >= today,
  );
  const upcomingLeaves = leaves.filter(
    (l) => l.status === 'APPROVED' && l.startDate > today,
  );

  async function handleApprove(leave: EnrichedStaffLeave) {
    setActionError(null);
    setActionMessage(null);
    try {
      const res = await fetch('/api/ops/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          leaveId: leave.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || 'Could not approve leave.');
        return;
      }

      setActionMessage(data.message || `Leave approved for ${leave.staffName}.`);
      setLeaves((prev) =>
        prev.map((item) =>
          item.id === leave.id ? { ...item, status: 'APPROVED' as LeaveStatus } : item,
        ),
      );
      router.refresh();
    } catch {
      setActionError('Network error while approving leave.');
    }
  }

  async function handleRejectSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rejectingLeave) return;
    if (!rejectionReason.trim()) {
      setActionError('Please provide a reason for rejecting the leave.');
      return;
    }

    setRejecting(true);
    setActionError(null);
    try {
      const res = await fetch('/api/ops/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject',
          leaveId: rejectingLeave.id,
          rejectionReason: rejectionReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || 'Could not reject leave.');
        return;
      }

      setActionMessage(`Leave rejected for ${rejectingLeave.staffName}.`);
      setLeaves((prev) =>
        prev.map((item) =>
          item.id === rejectingLeave.id
            ? { ...item, status: 'REJECTED' as LeaveStatus, rejectionReason }
            : item,
        ),
      );
      setRejectingLeave(null);
      setRejectionReason('');
      router.refresh();
    } catch {
      setActionError('Network error while rejecting leave.');
    } finally {
      setRejecting(false);
    }
  }

  async function handleCreateLeave(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStaffId) {
      setActionError('Please select a staff member.');
      return;
    }
    if (!reason.trim()) {
      setActionError('Please specify the reason for the leave.');
      return;
    }
    if (endDate < startDate) {
      setActionError('End date cannot be earlier than start date.');
      return;
    }

    setSubmitting(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const res = await fetch('/api/ops/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          staffId: selectedStaffId,
          startDate,
          endDate,
          type: leaveType,
          reason: reason.trim(),
          status: 'APPROVED',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || 'Could not schedule leave.');
        return;
      }

      setActionMessage(data.message || 'Staff leave recorded successfully.');
      setIsAddOpen(false);
      setReason('');
      router.refresh();

      // Refresh list
      const fetchRes = await fetch('/api/ops/leaves');
      if (fetchRes.ok) {
        const fresh = await fetchRes.json();
        if (fresh.leaves) setLeaves(fresh.leaves);
      }
    } catch {
      setActionError('Network error while creating leave.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm">
            <IconCalendar width={20} height={20} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-navy-950">
              Staff Leave & Absence Management
            </h1>
            <p className="mt-0.5 text-xs font-medium text-ink-mute">
              Schedule advance leaves, approve boy requests, and manage on-the-spot absence
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={backHref ?? `${base}/staff`}
            className="rounded-xl border border-line-strong bg-white px-3.5 py-2 text-xs font-semibold text-navy-950 shadow-sm hover:bg-surface-muted"
          >
            ← Back to Staff
          </Link>
          <button
            type="button"
            onClick={() => {
              setIsAddOpen(true);
              setActionError(null);
              setActionMessage(null);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 cursor-pointer"
          >
            <IconPlus width={15} height={15} />
            <span>Schedule Staff Leave</span>
          </button>
        </div>
      </div>

      {/* Action Notification Banners */}
      {actionMessage && (
        <div className="flex items-center justify-between rounded-xl border border-success-200 bg-success-50 p-4 text-xs font-semibold text-success-800 shadow-xs">
          <div className="flex items-center gap-2">
            <span>✅</span>
            <span>{actionMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="text-success-600 hover:text-success-900"
          >
            ✕
          </button>
        </div>
      )}

      {actionError && (
        <div className="flex items-center justify-between rounded-xl border border-danger-200 bg-danger-50 p-4 text-xs font-semibold text-danger-800 shadow-xs">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-danger-600 hover:text-danger-900"
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI Stats */}
      <StatGrid columns={4}>
        <StatCard
          label="PENDING APPROVAL"
          value={pendingLeaves.length}
          icon={<IconClock width={20} height={20} strokeWidth={2} />}
          tone={pendingLeaves.length > 0 ? 'amber' : 'slate'}
          subtext={
            pendingLeaves.length > 0
              ? `${pendingLeaves.length} requests awaiting your decision`
              : 'No pending requests'
          }
          subtextTone={pendingLeaves.length > 0 ? 'warning' : 'muted'}
        />
        <StatCard
          label="ON LEAVE TODAY"
          value={onLeaveToday.length}
          icon={<IconUserX width={20} height={20} strokeWidth={2} />}
          tone={onLeaveToday.length > 0 ? 'rose' : 'emerald'}
          subtext={
            onLeaveToday.length > 0
              ? `${onLeaveToday.map((l) => l.staffName).join(', ')}`
              : 'Full staff attendance today'
          }
          subtextTone={onLeaveToday.length > 0 ? 'danger' : 'success'}
        />
        <StatCard
          label="UPCOMING ADVANCE LEAVES"
          value={upcomingLeaves.length}
          icon={<IconCalendar width={20} height={20} strokeWidth={2} />}
          tone="blue"
          subtext="Planned in next days"
          subtextTone="info"
        />
        <StatCard
          label="TOTAL LEAVES RECORDED"
          value={leaves.length}
          icon={<IconUsers width={20} height={20} strokeWidth={2} />}
          tone="purple"
          subtext="All staff history"
          subtextTone="muted"
        />
      </StatGrid>

      {/* Pending Approval Section (if any) */}
      {pendingLeaves.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-900">
                ⏳
              </span>
              <h2 className="text-sm font-bold text-amber-950">
                Pending Staff Leave Requests ({pendingLeaves.length})
              </h2>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {pendingLeaves.map((leave) => (
              <div
                key={leave.id}
                className="rounded-xl border border-amber-200/80 bg-white p-4 shadow-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-bold text-sm text-navy-950">
                        {leave.staffName}
                      </span>
                      <span className="ml-2 text-xs text-slate-500 font-medium">
                        ({leave.areaName})
                      </span>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                      {LEAVE_TYPE_LABELS[leave.type] || leave.type}
                    </span>
                  </div>

                  <div className="mt-2 text-xs font-semibold text-slate-700">
                    🗓️{' '}
                    {leave.startDate === leave.endDate
                      ? formatDateFull(leave.startDate)
                      : `${formatDateFull(leave.startDate)} – ${formatDateFull(leave.endDate)}`}{' '}
                    <span className="text-slate-500 font-normal">
                      ({leave.daysCount} {leave.daysCount === 1 ? 'day' : 'days'})
                    </span>
                  </div>

                  <div className="mt-1.5 rounded-lg bg-slate-50 p-2 text-xs text-slate-700 italic border border-slate-100">
                    &ldquo;{leave.reason}&rdquo;
                  </div>
                </div>

                <div className="mt-3.5 flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleApprove(leave)}
                    className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-emerald-700 transition-colors"
                  >
                    ✓ Approve Leave
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRejectingLeave(leave);
                      setRejectionReason('');
                    }}
                    className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
                  >
                    ✕ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line-soft bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-navy-950 focus:border-brand focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Area Filter */}
          {areas.length > 1 && (
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-navy-950 focus:border-brand focus:outline-none"
            >
              <option value="ALL">All Areas</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}

          {/* Staff Filter */}
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-navy-950 focus:border-brand focus:outline-none"
          >
            <option value="ALL">All Staff Members</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative min-w-[220px]">
          <IconSearch
            width={14}
            height={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Search staff, reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-line bg-white py-1.5 pl-9 pr-3 text-xs font-medium text-navy-950 placeholder-slate-400 shadow-xs focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Leaves History Table */}
      <DataTable<EnrichedStaffLeave>
        data={filteredLeaves}
        keyExtractor={(l) => l.id}
        itemLabel="leave records"
        emptyMessage="No leave records match the filters."
        columns={[
          {
            id: 'staff',
            header: 'STAFF MEMBER',
            className: 'font-semibold text-navy-950',
            render: (l) => (
              <div>
                <div>{l.staffName}</div>
                <div className="text-[11px] text-slate-500 font-normal">{l.staffPhone}</div>
              </div>
            ),
          },
          {
            id: 'area',
            header: 'AREA',
            render: (l) => l.areaName || '—',
          },
          {
            id: 'dates',
            header: 'LEAVE DATES',
            render: (l) => (
              <div>
                <div className="font-semibold text-slate-900">
                  {l.startDate === l.endDate
                    ? formatDateFull(l.startDate)
                    : `${formatDateFull(l.startDate)} – ${formatDateFull(l.endDate)}`}
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  {l.daysCount} {l.daysCount === 1 ? 'day' : 'days'}
                </div>
              </div>
            ),
          },
          {
            id: 'type',
            header: 'TYPE',
            render: (l) => (
              <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                {LEAVE_TYPE_LABELS[l.type] || l.type}
              </span>
            ),
          },
          {
            id: 'reason',
            header: 'REASON & NOTE',
            render: (l) => (
              <div className="max-w-xs">
                <div className="text-xs text-slate-800 font-medium">{l.reason}</div>
                {l.rejectionReason && (
                  <div className="text-[11px] text-rose-600 font-semibold mt-0.5">
                    Rejection: {l.rejectionReason}
                  </div>
                )}
                {l.note && (
                  <div className="text-[11px] text-slate-500 mt-0.5">{l.note}</div>
                )}
              </div>
            ),
          },
          {
            id: 'status',
            header: 'STATUS',
            render: (l) => (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                  l.status === 'APPROVED'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : l.status === 'PENDING'
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : l.status === 'REJECTED'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                {l.status === 'APPROVED' && <IconCheckCircle width={12} height={12} />}
                {l.status === 'PENDING' && <IconClock width={12} height={12} />}
                {l.status}
              </span>
            ),
          },
          {
            id: 'actions',
            header: 'ACTIONS',
            render: (l) => (
              <div className="flex items-center gap-2">
                {l.status === 'PENDING' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleApprove(l)}
                      className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectingLeave(l);
                        setRejectionReason('');
                      }}
                      className="rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-200 hover:bg-rose-100"
                    >
                      Reject
                    </button>
                  </>
                ) : l.status === 'APPROVED' ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Cancel Approved Leave?',
                        message: `Are you sure you want to cancel the approved leave for ${l.staffName}?`,
                        confirmText: 'Yes, Cancel Leave',
                        tone: 'danger',
                      });
                      if (!ok) return;
                      await fetch('/api/ops/leaves', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'cancel', leaveId: l.id }),
                      });
                      setLeaves((prev) =>
                        prev.map((item) =>
                          item.id === l.id
                            ? { ...item, status: 'CANCELLED' as LeaveStatus }
                            : item,
                        ),
                      );
                      router.refresh();
                    }}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-400">—</span>
                )}
              </div>
            ),
          },
        ]}
      />

      {/* Modal: Schedule Staff Leave Directly */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-navy-950">
                Schedule Staff Leave
              </h3>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLeave} className="mt-4 space-y-4">
              {/* Select Staff */}
              <div>
                <label className="block text-xs font-bold text-navy-950 mb-1">
                  Staff Member <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-navy-950 focus:border-blue-500 focus:outline-none"
                >
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({areas.find((a) => a.id === s.areaId)?.name ?? 'Area'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quick Preset Buttons */}
              <div>
                <span className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Quick Presets:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPreset(0, 'ON_THE_SPOT')}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    ⚡ Today (On the spot)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreset(1, 'PLANNED')}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    📅 Tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreset(4, 'PLANNED')}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    ⏳ In 4 Days (Advance)
                  </button>
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-navy-950 mb-1">
                    Start Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (e.target.value > endDate) setEndDate(e.target.value);
                    }}
                    className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-navy-950 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-navy-950 mb-1">
                    End Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-navy-950 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Leave Type */}
              <div>
                <label className="block text-xs font-bold text-navy-950 mb-1">
                  Leave Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-navy-950 focus:border-blue-500 focus:outline-none"
                >
                  {(Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map((type) => (
                    <option key={type} value={type}>
                      {LEAVE_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-bold text-navy-950 mb-1">
                  Reason / Notes <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Village emergency, festival, reported sick..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface p-2.5 text-xs text-navy-950 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 leading-relaxed">
                ℹ️ Adding an approved leave automatically marks the staff member as <b>OFF</b> for the selected dates and frees their assigned cars to the <b>unassigned queue</b> so you can easily reassign them.
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save & Mark Leave'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reject Leave */}
      {rejectingLeave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-base font-bold text-navy-950 mb-2">
              Reject Leave Request
            </h3>
            <p className="text-xs text-slate-600 mb-4">
              Rejecting leave for <b>{rejectingLeave.staffName}</b> (
              {rejectingLeave.startDate === rejectingLeave.endDate
                ? formatDateFull(rejectingLeave.startDate)
                : `${formatDateFull(rejectingLeave.startDate)} – ${formatDateFull(rejectingLeave.endDate)}`}
              ).
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-navy-950 mb-1">
                  Rejection Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. High booking load, too many staff on leave on that date..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface p-2.5 text-xs text-navy-950 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRejectingLeave(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rejecting}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
                >
                  {rejecting ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
