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

export interface PackageAudit {
  currentPackageName: string;
  currentPrice: number;
  currentWashesPerMonth: number;
  currentServices: string[];
  requestedPackageName: string;
  requestedPrice: number;
  requestedWashesPerMonth: number;
  requestedServices: string[];
  washesDoneCount: number;
  washesRemaining: number;
  unusedCredit: number;
  targetRemainingCost: number;
  proratedDifference: number;
  fullDifference: number;
  isUpgrade: boolean;
}

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
  paymentStatus: string | null;
  paymentAmount: number | null;
  packageAudit?: PackageAudit | null;
  washesDoneThisCycle?: number;
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
  const [activationMode, setActivationMode] = useState<'IMMEDIATE_PRORATED' | 'IMMEDIATE_FULL' | 'NEXT_CYCLE'>('IMMEDIATE_PRORATED');
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(0);
  const [applyFinancialAdjustment, setApplyFinancialAdjustment] = useState(true);
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

    if (item.type === 'PACKAGE_CHANGE' && item.packageAudit) {
      const audit = item.packageAudit;
      setActivationMode('IMMEDIATE_PRORATED');
      const diff = audit.proratedDifference;
      setAdjustmentAmount(diff);
      setApplyFinancialAdjustment(diff !== 0);

      if (diff > 0) {
        setAdminRemarks(
          `Approved: Upgraded to ${audit.requestedPackageName}. Prorated difference of ₹${diff} charged for ${audit.washesRemaining} remaining washes.`
        );
      } else if (diff < 0) {
        setAdminRemarks(
          `Approved: Downgraded to ${audit.requestedPackageName}. ₹${Math.abs(diff)} credited to customer account balance for next cycle.`
        );
      } else {
        setAdminRemarks(`Approved: Package updated to ${audit.requestedPackageName}.`);
      }
    } else if (item.type === 'ONE_WASH' || item.type === 'OTHER_SERVICE') {
      const defaultAmount = item.paymentAmount || 0;
      setAdjustmentAmount(defaultAmount);
      setApplyFinancialAdjustment(defaultAmount > 0);
      setAdminRemarks(
        defaultAmount > 0
          ? `Approved: Scheduled for ${item.preferredDate || 'upcoming slot'}. Charge: ₹${defaultAmount}.`
          : `Approved: Scheduled for ${item.preferredDate || 'upcoming slot'}.`
      );
    } else {
      setAdminRemarks('');
    }
  }

  function handleModeChange(mode: 'IMMEDIATE_PRORATED' | 'IMMEDIATE_FULL' | 'NEXT_CYCLE') {
    setActivationMode(mode);
    if (!activeRequest?.packageAudit) return;
    const audit = activeRequest.packageAudit;

    let diff = 0;
    if (mode === 'IMMEDIATE_PRORATED') {
      diff = audit.proratedDifference;
    } else if (mode === 'IMMEDIATE_FULL') {
      diff = audit.fullDifference;
    } else {
      diff = 0;
    }

    setAdjustmentAmount(diff);
    setApplyFinancialAdjustment(diff !== 0);

    if (mode === 'NEXT_CYCLE') {
      setAdminRemarks(`Approved: Package change to ${audit.requestedPackageName} will be effective from the 1st of next month.`);
    } else if (diff > 0) {
      setAdminRemarks(
        mode === 'IMMEDIATE_PRORATED'
          ? `Approved: Upgraded to ${audit.requestedPackageName}. Prorated difference of ₹${diff} charged for ${audit.washesRemaining} remaining washes.`
          : `Approved: Fresh plan activated for ${audit.requestedPackageName}. ₹${diff} charged after adjusting unused credit of ₹${audit.unusedCredit}.`
      );
    } else if (diff < 0) {
      setAdminRemarks(
        `Approved: Downgraded to ${audit.requestedPackageName}. ₹${Math.abs(diff)} credited to customer account balance.`
      );
    } else {
      setAdminRemarks(`Approved: Package updated to ${audit.requestedPackageName}.`);
    }
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
          activationMode: activeRequest.type === 'PACKAGE_CHANGE' ? activationMode : null,
          adjustmentAmount: applyFinancialAdjustment ? adjustmentAmount : 0,
          applyFinancialAdjustment: applyFinancialAdjustment,
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
      header: 'REQUEST DETAILS / PACKAGE CHANGE',
      render: (item) => (
        <div className="text-xs space-y-1.5 min-w-[220px]">
          {item.carName !== '—' && (
            <div className="font-semibold text-slate-900 flex items-center gap-1">
              <span>🚗</span>
              <span>{item.carName}</span>
            </div>
          )}

          {item.type === 'PACKAGE_CHANGE' && (
            <div className="space-y-1">
              {/* FROM -> TO Visual Transition */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center rounded-md bg-slate-100 border border-slate-300 px-2 py-0.5 text-xs font-bold text-slate-700">
                  {item.currentPackageName}
                </span>
                <span className="text-blue-600 font-extrabold text-sm">➔</span>
                <span className="inline-flex items-center rounded-md bg-blue-100 border border-blue-300 px-2 py-0.5 text-xs font-bold text-blue-900 shadow-2xs">
                  {item.requestedPackageName}
                </span>
              </div>

              {item.packageAudit ? (
                <div className="text-[11px] text-slate-500 font-medium">
                  ₹{item.packageAudit.currentPrice}/mo ({item.packageAudit.currentWashesPerMonth} washes) → <b className="text-blue-700">₹{item.packageAudit.requestedPrice}/mo</b> ({item.packageAudit.requestedWashesPerMonth} washes)
                </div>
              ) : (
                <div className="text-[11px] text-slate-500">
                  From: {item.currentPackageName} ➔ To: <b className="text-blue-700">{item.requestedPackageName}</b>
                </div>
              )}
            </div>
          )}

          {item.type === 'ONE_WASH' && (
            <div>
              <span className="font-bold text-emerald-700">{item.washType}</span>
              {item.preferredDate && (
                <div className="text-slate-600 text-[11px]">
                  Target: <b>{formatDateFull(item.preferredDate)}</b> ({item.preferredTime || 'Anytime'})
                </div>
              )}
            </div>
          )}

          {item.type === 'OTHER_SERVICE' && (
            <div>
              <span className="font-medium text-slate-800 italic">&ldquo;{item.serviceDetails}&rdquo;</span>
              {item.preferredDate && (
                <div className="text-slate-600 text-[11px]">
                  Target: <b>{formatDateFull(item.preferredDate)}</b> ({item.preferredTime || 'Anytime'})
                </div>
              )}
            </div>
          )}

          {item.notes && (
            <div className="text-[11px] text-slate-500 font-medium bg-slate-50 p-1.5 rounded border border-slate-200">
              Note: {item.notes}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'charges',
      header: 'EXTRA CHARGES',
      render: (item) => {
        if (item.type === 'PACKAGE_CHANGE' && item.packageAudit) {
          const audit = item.packageAudit;
          if (item.status === 'PENDING') {
            const isUpgrade = audit.proratedDifference > 0;
            const isDowngrade = audit.proratedDifference < 0;
            return (
              <div className="text-xs space-y-1 min-w-[150px]">
                <div
                  className={`font-bold inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs ${
                    isUpgrade
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : isDowngrade
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      : 'bg-slate-100 text-slate-800 border border-slate-200'
                  }`}
                >
                  <span>{isUpgrade ? '🔺' : isDowngrade ? '💰' : '✓'}</span>
                  <span>
                    {isUpgrade
                      ? `+₹${audit.proratedDifference} Extra`
                      : isDowngrade
                      ? `₹${Math.abs(audit.proratedDifference)} Credit`
                      : '₹0 Difference'}
                  </span>
                </div>
                <div className="text-[11px] text-slate-600 font-medium">
                  {audit.washesDoneCount} used / {audit.washesRemaining} remaining washes
                </div>
                <div className="text-[10px] text-slate-400">
                  Full reset: +₹{audit.fullDifference}
                </div>
              </div>
            );
          }

          // Approved / Rejected package change
          if (item.status === 'APPROVED') {
            if (item.paymentAmount !== null && item.paymentAmount !== undefined && item.paymentAmount !== 0) {
              const isCharge = item.paymentAmount > 0;
              return (
                <div className="text-xs space-y-0.5">
                  <div className="font-bold flex items-center gap-1">
                    <span className={isCharge ? 'text-amber-700' : 'text-emerald-700'}>
                      {isCharge ? `+₹${item.paymentAmount}` : `-₹${Math.abs(item.paymentAmount)} Credit`}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.2 text-[9.5px] font-bold ${
                        item.paymentStatus === 'PENDING'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}
                    >
                      {item.paymentStatus || 'INVOICED'}
                    </span>
                  </div>
                  <div className="text-[10.5px] text-slate-500">Plan adjusted</div>
                </div>
              );
            }
            return (
              <div className="text-xs text-emerald-700 font-semibold">
                ✓ No extra charge (₹0)
              </div>
            );
          }

          return <div className="text-xs text-slate-400">—</div>;
        }

        // ONE_WASH or OTHER_SERVICE
        if (item.paymentAmount !== null && item.paymentAmount !== undefined && item.paymentAmount > 0) {
          return (
            <div className="text-xs space-y-0.5">
              <div className="font-bold text-amber-700 flex items-center gap-1">
                <span>₹{item.paymentAmount}</span>
                <span
                  className={`rounded px-1.5 py-0.2 text-[9.5px] font-bold ${
                    item.paymentStatus === 'PENDING'
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {item.paymentStatus || 'INVOICED'}
                </span>
              </div>
              <div className="text-[10.5px] text-slate-500">
                {item.type === 'ONE_WASH' ? 'One-time Wash Charge' : 'Special Service Fee'}
              </div>
            </div>
          );
        }

        if (item.status === 'PENDING') {
          return (
            <div className="text-xs space-y-0.5">
              <span className="inline-flex items-center rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                Custom on approval
              </span>
            </div>
          );
        }

        return (
          <div className="text-xs text-slate-400">
            {item.status === 'APPROVED' ? 'Included / No fee' : '—'}
          </div>
        );
      },
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
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {actionType === 'APPROVE' ? 'Approve Customer Request' : 'Reject Customer Request'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeRequest.customerName} ({activeRequest.customerPhone}) · {activeRequest.type}
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
              {/* PACKAGE CHANGE BREAKDOWN & PRORATION MATH */}
              {actionType === 'APPROVE' && activeRequest.type === 'PACKAGE_CHANGE' && (
                <div className="space-y-3">
                  {/* Plan comparison badges */}
                  <div className="grid grid-cols-2 gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="border-r border-slate-200 pr-2">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Plan</div>
                      <div className="font-black text-slate-900 text-sm mt-0.5">
                        {activeRequest.packageAudit?.currentPackageName || activeRequest.currentPackageName}
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        ₹{activeRequest.packageAudit?.currentPrice ?? '—'} /mo · {activeRequest.packageAudit?.currentWashesPerMonth ?? '—'} washes
                      </div>
                    </div>

                    <div className="pl-1">
                      <div className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Requested Plan</div>
                      <div className="font-black text-blue-700 text-sm mt-0.5">
                        {activeRequest.packageAudit?.requestedPackageName || activeRequest.requestedPackageName}
                      </div>
                      <div className="text-[11px] text-blue-600 font-medium">
                        ₹{activeRequest.packageAudit?.requestedPrice ?? '—'} /mo · {activeRequest.packageAudit?.requestedWashesPerMonth ?? '—'} washes
                      </div>
                    </div>
                  </div>

                  {/* Quota & Unused Value Bar */}
                  {activeRequest.packageAudit && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                        <span>Washes Completed This Month:</span>
                        <span className="font-bold text-slate-900">
                          {activeRequest.packageAudit.washesDoneCount} done / {activeRequest.packageAudit.currentWashesPerMonth} total ({activeRequest.packageAudit.washesRemaining} left)
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                        <span>Unused Credit from Old Plan:</span>
                        <span className="font-bold text-emerald-700">₹{activeRequest.packageAudit.unusedCredit}</span>
                      </div>
                    </div>
                  )}

                  {/* Sub-Services Breakdown */}
                  {activeRequest.packageAudit && activeRequest.packageAudit.requestedServices.length > 0 && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                      <div className="font-bold text-slate-800 text-[11px] flex items-center justify-between">
                        <span>Sub-Services Included in Target Plan:</span>
                        <span className="text-blue-600">{activeRequest.packageAudit.requestedServices.length} services</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {activeRequest.packageAudit.requestedServices.map((srv, idx) => {
                          const isNew = !activeRequest.packageAudit?.currentServices.includes(srv);
                          return (
                            <span
                              key={idx}
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10.5px] font-semibold ${
                                isNew
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-white text-slate-700 border border-slate-200'
                              }`}
                            >
                              {isNew ? '✨' : '✓'} {srv}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Activation Mode Options */}
                  {activeRequest.packageAudit && (
                    <div className="space-y-2">
                      <label className="block font-bold text-slate-800">Select Billing / Activation Mode:</label>
                      <div className="space-y-2">
                        <label
                          className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                            activationMode === 'IMMEDIATE_PRORATED'
                              ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="activationMode"
                            checked={activationMode === 'IMMEDIATE_PRORATED'}
                            onChange={() => handleModeChange('IMMEDIATE_PRORATED')}
                            className="mt-0.5"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900">
                                ⚡ Prorated Mid-Cycle Upgrade / Downgrade (Recommended)
                              </span>
                              <span className={`font-black ${activeRequest.packageAudit.proratedDifference >= 0 ? 'text-blue-700' : 'text-emerald-700'}`}>
                                {activeRequest.packageAudit.proratedDifference >= 0 ? `+₹${activeRequest.packageAudit.proratedDifference}` : `-₹${Math.abs(activeRequest.packageAudit.proratedDifference)} Credit`}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Upgrades remaining {activeRequest.packageAudit.washesRemaining} washes this month. Difference between new plan cost (₹{activeRequest.packageAudit.targetRemainingCost}) and unused credit (₹{activeRequest.packageAudit.unusedCredit}).
                            </p>
                          </div>
                        </label>

                        <label
                          className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                            activationMode === 'IMMEDIATE_FULL'
                              ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="activationMode"
                            checked={activationMode === 'IMMEDIATE_FULL'}
                            onChange={() => handleModeChange('IMMEDIATE_FULL')}
                            className="mt-0.5"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900">
                                🔄 Full Fresh Reset (Full {activeRequest.packageAudit.requestedWashesPerMonth} Washes)
                              </span>
                              <span className="font-black text-blue-700">
                                +₹{activeRequest.packageAudit.fullDifference}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Provides fresh {activeRequest.packageAudit.requestedWashesPerMonth} washes immediately. ₹{activeRequest.packageAudit.requestedPrice} minus ₹{activeRequest.packageAudit.unusedCredit} unused credit.
                            </p>
                          </div>
                        </label>

                        <label
                          className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                            activationMode === 'NEXT_CYCLE'
                              ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="activationMode"
                            checked={activationMode === 'NEXT_CYCLE'}
                            onChange={() => handleModeChange('NEXT_CYCLE')}
                            className="mt-0.5"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-slate-900">
                                📅 Effective 1st of Next Month (Zero Charge Now)
                              </span>
                              <span className="font-black text-slate-500">
                                ₹0 Now
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Customer finishes current month on existing plan. Next month is billed at full ₹{activeRequest.packageAudit.requestedPrice}.
                            </p>
                          </div>
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Financial Action Banner */}
                  {activationMode !== 'NEXT_CYCLE' && (
                    <div
                      className={`p-3 rounded-xl border ${
                        adjustmentAmount > 0
                          ? 'bg-amber-50 border-amber-200 text-amber-900'
                          : adjustmentAmount < 0
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                          : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold flex items-center gap-1.5">
                          <span>{adjustmentAmount > 0 ? '🔺' : adjustmentAmount < 0 ? '💰' : 'ℹ️'}</span>
                          <span>
                            {adjustmentAmount > 0
                              ? 'Extra Amount to Collect from Customer:'
                              : adjustmentAmount < 0
                              ? 'Account Credit for Customer:'
                              : 'No Adjustment Needed'}
                          </span>
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="font-bold">₹</span>
                          <input
                            type="number"
                            value={Math.abs(adjustmentAmount)}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setAdjustmentAmount(adjustmentAmount < 0 ? -val : val);
                            }}
                            className="w-20 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-black text-slate-900 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                      <p className="text-[11px] mt-1 opacity-80">
                        {adjustmentAmount > 0
                          ? `An open invoice of ₹${adjustmentAmount} will be created for the customer to pay via UPI or cash.`
                          : adjustmentAmount < 0
                          ? `₹${Math.abs(adjustmentAmount)} will be credited to the customer's ledger and applied to their next bill.`
                          : 'Package will be updated with no financial charges.'}
                      </p>

                      <label className="mt-2.5 flex items-center gap-2 text-[11px] font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={applyFinancialAdjustment}
                          onChange={(e) => setApplyFinancialAdjustment(e.target.checked)}
                          className="rounded"
                        />
                        <span>Auto-apply this financial entry to customer ledger</span>
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* ONE WASH OR OTHER CUSTOM SERVICE */}
              {actionType === 'APPROVE' && (activeRequest.type === 'ONE_WASH' || activeRequest.type === 'OTHER_SERVICE') && (
                <div className="space-y-3">
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

                  {/* Optional Extra Charge for One Wash / Custom Service */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900 block">Extra Service Charge / Price:</span>
                        <span className="text-[11px] text-slate-500">Optional fee to collect for this special wash</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-bold text-slate-700">₹</span>
                        <input
                          type="number"
                          min="0"
                          value={adjustmentAmount}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value) || 0);
                            setAdjustmentAmount(val);
                            setApplyFinancialAdjustment(val > 0);
                          }}
                          placeholder="0"
                          className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-black text-slate-900 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    {adjustmentAmount > 0 && (
                      <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700 cursor-pointer pt-1 border-t border-slate-200/60">
                        <input
                          type="checkbox"
                          checked={applyFinancialAdjustment}
                          onChange={(e) => setApplyFinancialAdjustment(e.target.checked)}
                          className="rounded"
                        />
                        <span>Auto-generate open invoice of ₹{adjustmentAmount} on customer account</span>
                      </label>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {actionType === 'APPROVE' ? 'Admin Remarks / Confirmation Note to Customer' : 'Reason for Rejection *'}
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
