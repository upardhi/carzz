'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  IconCheck,
  IconClock,
  IconMapPin,
  IconRefresh,
  IconSearch,
  IconXCircle,
} from '@/components/shell/icons';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { toast } from '@/components/ui/ToastProvider';
import { formatDateFull } from '@/lib/util/format';
import { useDebounce } from '@/lib/util/debounce';

export interface CustomerRequestItem {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  areaId: string;
  areaName: string;
  carId: string | null;
  carName: string;
  carPlate: string;
  type: 'PACKAGE_CHANGE' | 'ONE_WASH' | 'OTHER_SERVICE';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  currentPackageName: string;
  requestedPackageName: string;
  requestedPackageId: string | null;
  washType: string | null;
  preferredDate: string | null;
  preferredTime: string | null;
  serviceDetails: string | null;
  assignedStaffId: string | null;
  assignedStaffName: string | null;
  notes: string | null;
  adminRemarks: string | null;
  createdAt: string;
  decidedAt: string | null;
  decidedByUserId: string | null;
}

interface RequestsStats {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  totalCount: number;
}

export function RequestsClient({
  base: _base,
  staffList,
}: {
  base?: string;
  staffList: { id: string; name: string; phone: string; areaId: string }[];
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CustomerRequestItem[]>([]);
  const [stats, setStats] = useState<RequestsStats>({
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    totalCount: 0,
  });

  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [total, setTotal] = useState(0);

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Action Modal state
  const [activeRequest, setActiveRequest] = useState<CustomerRequestItem | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [assignedStaffId, setAssignedStaffId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [adminRemarks, setAdminRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, typeFilter, statusFilter]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        status: statusFilter,
        type: typeFilter,
        q: debouncedSearch,
      });

      const res = await fetch(`/api/ops/requests?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load requests');

      const json = await res.json();
      if (json.ok) {
        setData(json.data || []);
        if (json.pagination) {
          setTotal(json.pagination.total || 0);
        }
        if (json.stats) {
          setStats(json.stats);
        }
      }
    } catch {
      toast.error('Could not load customer requests.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, typeFilter, debouncedSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openAction(item: CustomerRequestItem, type: 'APPROVE' | 'REJECT') {
    setActiveRequest(item);
    setActionType(type);
    setAssignedStaffId(item.assignedStaffId || '');
    setScheduledDate(item.preferredDate || new Date().toISOString().slice(0, 10));
    setAdminRemarks('');
  }

  async function handleConfirmDecision(e: React.FormEvent) {
    e.preventDefault();
    if (!activeRequest || !actionType) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/ops/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: activeRequest.id,
          decision: actionType === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          assignedStaffId: assignedStaffId || null,
          scheduledDate: scheduledDate || null,
          adminRemarks: adminRemarks.trim() || null,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || 'Action failed');
        return;
      }

      toast.success(result.message || 'Request updated');
      setActiveRequest(null);
      setActionType(null);
      await fetchData();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const columns: Column<CustomerRequestItem>[] = [
    {
      id: 'customer',
      header: 'CUSTOMER',
      render: (item) => (
        <div>
          <div className="font-semibold text-ink text-sm">{item.customerName}</div>
          <div className="text-xs text-ink-mute">{item.customerPhone || '—'}</div>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-surface-muted border border-line px-2 py-0.5 text-[10.5px] font-semibold text-ink-soft">
            <IconMapPin width={10} height={10} className="text-ink-mute" />
            {item.areaName}
          </span>
        </div>
      ),
    },
    {
      id: 'type',
      header: 'REQUEST TYPE',
      render: (item) => (
        <span
          className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-bold ${
            item.type === 'PACKAGE_CHANGE'
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : item.type === 'ONE_WASH'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-purple-50 text-purple-700 border border-purple-200'
          }`}
        >
          {item.type === 'PACKAGE_CHANGE'
            ? '📦 Package Change'
            : item.type === 'ONE_WASH'
            ? '🚿 One Wash'
            : '✨ Other Wash'}
        </span>
      ),
    },
    {
      id: 'details',
      header: 'REQUEST DETAILS',
      render: (item) => (
        <div className="text-xs space-y-1">
          {item.carName !== '—' && (
            <div>
              <span className="font-semibold text-slate-900">{item.carName}</span>
            </div>
          )}
          {item.type === 'PACKAGE_CHANGE' && (
            <div>
              <span className="text-slate-500">Upgrade to: </span>
              <span className="font-bold text-blue-700">{item.requestedPackageName}</span>
              <div className="text-[11px] text-slate-400">Current: {item.currentPackageName}</div>
            </div>
          )}
          {item.type === 'ONE_WASH' && (
            <div>
              <span className="font-bold text-emerald-700">{item.washType}</span>
              {item.preferredDate && (
                <div className="text-slate-600">
                  Target: <b>{formatDateFull(item.preferredDate)}</b> ({item.preferredTime || 'Anytime'})
                </div>
              )}
            </div>
          )}
          {item.type === 'OTHER_SERVICE' && (
            <div>
              <span className="font-medium text-slate-800 italic">&ldquo;{item.serviceDetails}&rdquo;</span>
              {item.preferredDate && (
                <div className="text-slate-600">
                  Target: <b>{formatDateFull(item.preferredDate)}</b> ({item.preferredTime || 'Anytime'})
                </div>
              )}
            </div>
          )}
          {item.notes && (
            <div className="text-[11px] text-slate-500 font-medium">
              Note: {item.notes}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'STATUS',
      render: (item) => {
        if (item.status === 'PENDING') {
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              <IconClock width={12} height={12} />
              Pending
            </span>
          );
        }
        if (item.status === 'APPROVED') {
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              <IconCheck width={12} height={12} />
              Approved
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
            <IconXCircle width={12} height={12} />
            Rejected
          </span>
        );
      },
    },
    {
      id: 'createdAt',
      header: 'REQUESTED ON',
      className: 'text-xs text-ink-mute',
      render: (item) => formatDateFull(item.createdAt),
    },
    {
      id: 'actions',
      header: 'ACTIONS',
      render: (item) => {
        if (item.status !== 'PENDING') {
          return (
            <div className="text-xs text-ink-faint">
              <div>Decided {item.decidedAt ? formatDateFull(item.decidedAt) : ''}</div>
              {item.adminRemarks && (
                <div className="text-[11px] text-slate-600">Remark: {item.adminRemarks}</div>
              )}
            </div>
          );
        }

        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openAction(item, 'APPROVE')}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => openAction(item, 'REJECT')}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-rose-700 transition-colors cursor-pointer"
            >
              Reject
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-950">
            Customer Special Requests
          </h1>
          <p className="text-xs text-ink-mute font-medium mt-0.5">
            Review and approve customer package changes, one-time washes, and special service requests.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchData()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-semibold text-ink shadow-2xs hover:bg-surface-muted transition-colors cursor-pointer"
        >
          <IconRefresh width={14} height={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* 4 Top KPI Cards */}
      <StatGrid columns={4}>
        <StatCard
          label="PENDING REQUESTS"
          value={stats.pendingCount}
          tone={stats.pendingCount > 0 ? 'rose' : 'emerald'}
          subtext={stats.pendingCount > 0 ? 'Action required' : 'All requests reviewed'}
        />
        <StatCard
          label="APPROVED"
          value={stats.approvedCount}
          tone="emerald"
          subtext="Processed & scheduled"
        />
        <StatCard
          label="REJECTED"
          value={stats.rejectedCount}
          tone="slate"
          subtext="Declined requests"
        />
        <StatCard
          label="TOTAL REQUESTS"
          value={stats.totalCount}
          tone="purple"
          subtext="All time submissions"
        />
      </StatGrid>

      {/* Main Table Card */}
      <div className="rounded-2xl border border-line bg-surface p-4 sm:p-6 shadow-xs">
        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-faint">
              <IconSearch width={14} height={14} />
            </div>
            <input
              type="text"
              placeholder="Search customer, phone, plate..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface py-1.5 pl-9 pr-3 text-xs text-ink placeholder:text-ink-faint focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500 transition-colors shadow-2xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Type Filter */}
            <div className="flex items-center gap-1 rounded-xl border border-line bg-surface-sunken p-1">
              {[
                { id: 'ALL', label: 'All Types' },
                { id: 'PACKAGE_CHANGE', label: '📦 Package' },
                { id: 'ONE_WASH', label: '🚿 One Wash' },
                { id: 'OTHER_SERVICE', label: '✨ Other' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTypeFilter(t.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                    typeFilter === t.id
                      ? 'bg-surface text-navy-950 shadow-2xs font-bold'
                      : 'text-ink-mute hover:text-navy-950'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1 rounded-xl border border-line bg-surface-sunken p-1">
              {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                    statusFilter === s
                      ? 'bg-surface text-navy-950 shadow-2xs'
                      : 'text-ink-mute hover:text-navy-950'
                  }`}
                >
                  {s === 'ALL'
                    ? 'All'
                    : s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Data Table */}
        <DataTable<CustomerRequestItem>
          data={data}
          columns={columns}
          keyExtractor={(item) => item.id}
          itemLabel="customer requests"
          page={page}
          pageSize={pageSize}
          totalItems={total}
          onPageChange={(p) => setPage(p)}
          emptyMessage={
            loading
              ? 'Loading customer requests...'
              : 'No customer requests match your current filters.'
          }
        />
      </div>

      {/* Decision Modal */}
      {activeRequest && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {actionType === 'APPROVE' ? 'Approve Customer Request' : 'Reject Customer Request'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeRequest.customerName} · {activeRequest.type}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveRequest(null);
                  setActionType(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmDecision} className="space-y-4 text-xs">
              {actionType === 'APPROVE' && activeRequest.type === 'PACKAGE_CHANGE' && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-blue-900">
                  <p className="font-bold">Package Update:</p>
                  <p className="mt-0.5">
                    Vehicle package will be updated from <b>{activeRequest.currentPackageName}</b> to{' '}
                    <b>{activeRequest.requestedPackageName}</b>.
                  </p>
                </div>
              )}

              {actionType === 'APPROVE' && (activeRequest.type === 'ONE_WASH' || activeRequest.type === 'OTHER_SERVICE') && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Assign Wash Boy *</label>
                    <select
                      value={assignedStaffId}
                      onChange={(e) => setAssignedStaffId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold bg-white focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Select Wash Boy</option>
                      {staffList
                        .filter((s) => !activeRequest.areaId || s.areaId === activeRequest.areaId)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.phone})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Scheduled Wash Date *</label>
                    <input
                      type="date"
                      required
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {actionType === 'APPROVE' ? 'Admin Remarks / Confirmation Note' : 'Reason for Rejection *'}
                </label>
                <textarea
                  rows={3}
                  required={actionType === 'REJECT'}
                  value={adminRemarks}
                  onChange={(e) => setAdminRemarks(e.target.value)}
                  placeholder={
                    actionType === 'APPROVE'
                      ? 'Optional note visible to customer and team...'
                      : 'Please explain why this request cannot be fulfilled...'
                  }
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs font-semibold focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setActiveRequest(null);
                    setActionType(null);
                  }}
                  className="rounded-lg border border-slate-300 px-4 py-2 font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`rounded-lg px-5 py-2 font-bold text-white transition-colors disabled:opacity-50 cursor-pointer ${
                    actionType === 'APPROVE'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {submitting
                    ? 'Processing…'
                    : actionType === 'APPROVE'
                    ? 'Confirm Approval'
                    : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
