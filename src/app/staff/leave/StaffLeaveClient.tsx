'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconCalendar,
  IconGift,
} from '@/components/shell/icons';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { formatDateFull, todayISO } from '@/lib/util/format';
import type { StaffLeave, LeaveType } from '@/lib/data/types';

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  PLANNED: 'Planned Leave (Advance)',
  ON_THE_SPOT: 'On-the-spot / Urgent',
  EMERGENCY: 'Emergency',
  SICK: 'Sick / Medical',
  CASUAL: 'Casual Leave',
  HALF_DAY: 'Half Day',
  UNINFORMED: 'Uninformed',
  OTHER: 'Other Reason',
};

interface StaffLeaveClientProps {
  userName?: string;
  leaves: StaffLeave[];
  offsAllowed: number;
  offsTaken: number;
  extraOffPenalty: number;
}

function parseDateBadge(dateStr: string) {
  try {
    const d = new Date(`${dateStr}T00:00:00`);
    const day = d.getDate();
    const month = d.toLocaleString('en-IN', { month: 'short' });
    return { day, month };
  } catch {
    return { day: '—', month: '—' };
  }
}

export function StaffLeaveClient({
  userName,
  leaves: initialLeaves,
  offsAllowed,
  offsTaken,
  extraOffPenalty,
}: StaffLeaveClientProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const today = todayISO();

  const firstName = userName ? userName.split(' ')[0] : 'Rahul';

  const [leaves, setLeaves] = useState<StaffLeave[]>(initialLeaves);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [leaveType, setLeaveType] = useState<LeaveType>('PLANNED');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Helper for quick date presets
  function setPreset(daysInAdvance: number, type: LeaveType) {
    const d = new Date();
    d.setDate(d.getDate() + daysInAdvance);
    const isoDate = d.toISOString().slice(0, 10);
    setStartDate(isoDate);
    setEndDate(isoDate);
    setLeaveType(type);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Please provide a reason for the leave.');
      return;
    }
    if (startDate > endDate) {
      setError('End date must be on or after start date.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/staff/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          type: leaveType,
          reason: reason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not submit leave request.');
        return;
      }

      setSuccess('Leave request submitted! Awaiting manager approval.');
      setReason('');
      if (data.leave) {
        setLeaves((prev) => [data.leave, ...prev]);
      }
      router.refresh();
    } catch {
      setError('No network connection. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(leaveId: string) {
    const ok = await confirm({
      title: 'Cancel Leave Request?',
      message: 'Are you sure you want to cancel this leave request?',
      confirmText: 'Yes, Cancel Request',
      tone: 'danger',
    });
    if (!ok) return;

    setCancellingId(leaveId);
    setError(null);

    try {
      const res = await fetch(`/api/staff/leave?id=${leaveId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Could not cancel leave request.');
        return;
      }

      setLeaves((prev) =>
        prev.map((l) => (l.id === leaveId ? { ...l, status: 'CANCELLED' } : l)),
      );
      router.refresh();
    } catch {
      setError('Failed to cancel. Check your connection.');
    } finally {
      setCancellingId(null);
    }
  }

  const remainingAllowance = Math.max(0, offsAllowed - offsTaken);

  const overlappingLeave = leaves.find(
    (l) =>
      (l.status === 'PENDING' || l.status === 'APPROVED') &&
      !(endDate < l.startDate || startDate > l.endDate),
  );

  return (
    <div className="space-y-5">
      {/* 1. Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#071329] via-[#0d2247] to-[#123164] p-6 text-white shadow-md border border-navy-800/60">
        <div className="relative z-10 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl text-white flex items-center gap-2">
              Hello, {firstName}! <span className="animate-wiggle">👋</span>
            </h2>
            <p className="mt-1 text-xs md:text-sm text-slate-300 font-medium max-w-xl">
              Manage your cars, bookings and leaves — all in one place.
            </p>
          </div>

          <div className="hidden md:flex flex-col items-end justify-center text-right shrink-0">
            <p className="font-serif italic text-xs md:text-sm text-slate-300 tracking-wide">
              &ldquo;A cleaner car for a brighter you.&rdquo;
            </p>
            <div className="mt-1.5 h-1 w-12 rounded-full bg-blue-500 shadow-sm" />
          </div>
        </div>

        {/* Subtle decorative background water accents */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-1/4 h-32 w-32 rounded-full bg-cyan-400/10 blur-2xl" />
      </div>

      {/* 2. Top Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Card 1: Free Offs */}
        <div className="relative flex items-center justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-100/80 bg-blue-50 text-blue-600">
              <IconGift width={24} height={24} />
            </div>
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                FREE OFFS THIS MONTH
              </div>
              <div className="mt-0.5 text-2xl font-black tracking-tight text-amber-500">
                {remainingAllowance} left
              </div>
              <div className="mt-0.5 text-xs font-medium text-slate-500">
                {offsAllowed} allowed / month
              </div>
            </div>
          </div>
          {/* Subtle Car/Clean Icon Graphic */}
          <div className="hidden sm:flex opacity-20 text-blue-400">
            <svg width="60" height="40" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 8l-2-5H7L5 8H3v8h2v1c0 1.1.9 2 2 2h1c1.1 0 2-.9 2-2v-1h8v1c0 1.1.9 2 2 2h1c1.1 0 2-.9 2-2v-1h2V8h-2zm-12.5 7c-.8 0-1.5-.7-1.5-1.5S5.7 12 6.5 12s1.5.7 1.5 1.5-.7 1.5-1.5 1.5zm11 0c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5zM6.5 7h11l1.2 3H5.3L6.5 7z" />
            </svg>
          </div>
        </div>

        {/* Card 2: Offs Taken */}
        <div className="relative flex items-center justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-rose-100/80 bg-rose-50 text-rose-600">
              <IconCalendar width={24} height={24} />
            </div>
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                OFFS TAKEN
              </div>
              <div className="mt-0.5 text-2xl font-black tracking-tight text-rose-600">
                {offsTaken} days
              </div>
              <div className="mt-0.5 text-xs font-semibold text-rose-600/90">
                {offsTaken > offsAllowed
                  ? `+₹${(offsTaken - offsAllowed) * extraOffPenalty} deduction`
                  : 'Within monthly allowance'}
              </div>
            </div>
          </div>
          {/* Calendar Graphic */}
          <div className="hidden sm:flex opacity-20 text-rose-400">
            <svg width="50" height="50" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
            </svg>
          </div>
        </div>
      </div>

      {/* 3. Apply for Leave Form Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
              <IconCalendar width={20} height={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Apply for Leave</h3>
              <p className="text-xs text-slate-500">
                Apply in advance (4–5 days prior) or on-the-spot for emergencies.
              </p>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPreset(0, 'ON_THE_SPOT')}
              className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-1.5 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-100"
            >
              <span>📅</span> Today (Urgent)
            </button>
            <button
              type="button"
              onClick={() => setPreset(1, 'PLANNED')}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
            >
              <span>📅</span> Tomorrow
            </button>
            <button
              type="button"
              onClick={() => setPreset(4, 'PLANNED')}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
            >
              <span>📅</span> After 4 Days
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Start Date & End Date Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Start Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (e.target.value > endDate) setEndDate(e.target.value);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-xs font-semibold text-slate-800 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                End Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-xs font-semibold text-slate-800 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
          </div>

          {/* Leave Type Dropdown */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Leave Type
            </label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as LeaveType)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-xs font-semibold text-slate-800 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {(Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]).map((type) => (
                <option key={type} value={type}>
                  {LEAVE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          {/* Reason / Note Textarea */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Reason / Note
            </label>
            <textarea
              required
              rows={2}
              placeholder="e.g. Village function, family emergency, unwell..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-800 placeholder:text-slate-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Error & Success alerts */}
          {error && (
            <div className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-xs font-medium text-danger-700">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-xl border border-success-200 bg-success-50 p-3 text-xs font-medium text-success-700">
              {success}
            </div>
          )}

          {/* Overlapping Warning Banner */}
          {overlappingLeave && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900 flex items-center gap-2.5">
              <span className="text-base">⚠️</span>
              <div>
                <b className="font-bold">Already requested!</b> You already have an{' '}
                <span className="font-bold">
                  {overlappingLeave.status === 'APPROVED' ? 'approved leave' : 'pending leave request'}
                </span>{' '}
                on{' '}
                {overlappingLeave.startDate === overlappingLeave.endDate
                  ? formatDateFull(overlappingLeave.startDate)
                  : `${formatDateFull(overlappingLeave.startDate)} to ${formatDateFull(overlappingLeave.endDate)}`}.
              </div>
            </div>
          )}

          {/* Action Submit Button */}
          <button
            type="submit"
            disabled={submitting || Boolean(overlappingLeave)}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 py-3 text-xs font-bold text-white shadow-sm transition-all disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            {submitting
              ? 'Submitting...'
              : overlappingLeave
                ? 'Leave Already Exists For This Date'
                : 'Submit Leave Request'}
          </button>
        </form>
      </div>

      {/* 4. Leave History Section */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
              <IconCalendar width={20} height={20} />
            </div>
            <h3 className="text-base font-bold text-slate-900">Leave History</h3>
          </div>

          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            View All
          </button>
        </div>

        {leaves.length === 0 ? (
          <p className="py-8 text-center text-xs font-medium text-slate-400">
            No leave records found.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {leaves.map((leave) => {
              const badge = parseDateBadge(leave.startDate);
              return (
                <div
                  key={leave.id}
                  className="flex items-center justify-between gap-4 py-3.5 first:pt-4 last:pb-0"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Date Badge */}
                    <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl border border-blue-100/80 bg-blue-50 text-blue-600">
                      <span className="text-sm font-extrabold leading-none">{badge.day}</span>
                      <span className="text-[10px] font-bold uppercase leading-tight mt-0.5">{badge.month}</span>
                    </div>

                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {LEAVE_TYPE_LABELS[leave.type] || leave.type}
                      </div>
                      <div className="text-[11.5px] text-slate-500 font-medium truncate mt-0.5">
                        {leave.reason}
                      </div>
                      {leave.rejectionReason && (
                        <div className="text-[11px] text-danger-600 font-medium mt-0.5">
                          Reason: {leave.rejectionReason}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {leave.status === 'PENDING' ? (
                      <button
                        type="button"
                        disabled={cancellingId === leave.id}
                        onClick={() => handleCancel(leave.id)}
                        className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 hover:bg-amber-100 transition-colors"
                      >
                        {cancellingId === leave.id ? '...' : 'Pending (Cancel)'}
                      </button>
                    ) : leave.status === 'APPROVED' ? (
                      <span className="rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                        Approved
                      </span>
                    ) : (
                      <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        {leave.status === 'REJECTED' ? 'Rejected' : 'Cancelled'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
