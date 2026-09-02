'use client';

import Link from 'next/link';
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
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { formatDateFull, money } from '@/lib/util/format';

export interface PocketRequestItem {
  id: string;
  staffId: string;
  staffName: string;
  staffPhone: string;
  areaId: string;
  areaName: string;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
  requestedAt: string;
  decidedAt: string | null;
  decidedByUserId: string | null;
  overrodeCap: boolean;
  note: string | null;
  availableAllowance: number;
  inAccount: number;
  weeklyCap: number;
  takenThisWeek: number;
  overCap: boolean;
  weeklyCapPercent: number;
}

interface PocketStats {
  totalCount: number;
  pendingCount: number;
  pendingAmount: number;
  approvedCount: number;
  approvedAmount: number;
  rejectedCount: number;
}

const AVATAR_COLORS = [
  'bg-navy-50 text-navy-700',
  'bg-success-50 text-success-700',
  'bg-gold-50 text-gold-700',
  'bg-navy-100 text-navy-800',
  'bg-warning-50 text-warning-700',
  'bg-danger-50 text-danger-700',
];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface PocketRequestsClientProps {
  base: string;
}

export function PocketRequestsClient({ base }: PocketRequestsClientProps) {
  const showConfirm = useConfirm();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PocketRequestItem[]>([]);
  const [stats, setStats] = useState<PocketStats>({
    totalCount: 0,
    pendingCount: 0,
    pendingAmount: 0,
    approvedCount: 0,
    approvedAmount: 0,
    rejectedCount: 0,
  });

  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [total, setTotal] = useState(0);

  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        status: statusFilter,
        q: debouncedSearch,
      });

      const res = await fetch(`/api/ops/pocket?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to load pocket requests');
      }

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
      toast.error('Could not load pocket requests.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter, debouncedSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleDecision(
    requestId: string,
    decision: 'APPROVED' | 'REJECTED',
    overCap: boolean,
  ) {
    if (decision === 'APPROVED' && overCap) {
      const ok = await showConfirm({
        title: 'Weekly cap exceeded',
        message: 'This request is above the 25% weekly limit. Approve it anyway?',
        tone: 'gold',
        confirmText: 'Approve anyway',
        cancelText: 'Cancel',
      });
      if (!ok) return;
    }

    setActionInProgress(requestId);
    try {
      const res = await fetch('/api/ops/pocket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, decision }),
      });

      const result = await res.json();
      if (!res.ok) {
        toast.error(result.error || 'Action failed');
        return;
      }

      toast.success(result.message || 'Request updated');
      await fetchData();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setActionInProgress(null);
    }
  }

  const columns: Column<PocketRequestItem>[] = [
    {
      id: 'staff',
      header: 'STAFF MEMBER',
      render: (item, idx) => {
        const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
        return (
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black ${avatarColor}`}
            >
              {getInitials(item.staffName)}
            </div>
            <div>
              <div className="font-bold text-ink text-sm">{item.staffName}</div>
              <div className="text-xs text-ink-mute">{item.staffPhone || '—'}</div>
            </div>
          </div>
        );
      },
    },
    {
      id: 'area',
      header: 'AREA',
      render: (item) => (
        <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted border border-line px-2.5 py-0.5 text-xs font-semibold text-ink-soft">
          <IconMapPin width={11} height={11} className="text-ink-mute" />
          {item.areaName}
        </span>
      ),
    },
    {
      id: 'amount',
      header: 'AMOUNT',
      className: 'font-black text-ink text-sm',
      render: (item) => money(item.amount),
    },
    {
      id: 'allowance',
      header: 'ALLOWANCE & BALANCE',
      render: (item) => (
        <div className="text-xs">
          <div className="font-medium text-ink">
            Limit: <span className="font-bold">{money(item.availableAllowance)}</span>
          </div>
          <div className="text-ink-mute">
            In account: {money(item.inAccount)}
          </div>
        </div>
      ),
    },
    {
      id: 'cap',
      header: 'LIMIT STATUS',
      render: (item) =>
        item.overCap ? (
          <div>
            <span className="rounded px-2 py-0.5 text-[10px] font-bold text-danger-600 bg-danger-50 border border-danger-100">
              Over limit
            </span>
            <div className="mt-1 text-[11px] font-medium text-danger-600">
              +{money(item.amount - item.availableAllowance)} above cap
            </div>
          </div>
        ) : (
          <span className="rounded px-2 py-0.5 text-[10px] font-bold text-success-600 bg-success-50 border border-success-100">
            Within limit
          </span>
        ),
    },
    {
      id: 'status',
      header: 'STATUS',
      render: (item) => {
        if (item.status === 'PENDING') {
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 border border-warning-200 px-2.5 py-0.5 text-xs font-bold text-warning-700">
              <IconClock width={12} height={12} />
              Pending
            </span>
          );
        }
        if (item.status === 'APPROVED' || item.status === 'PAID') {
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-50 border border-success-200 px-2.5 py-0.5 text-xs font-bold text-success-700">
              <IconCheck width={12} height={12} />
              Approved
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted border border-line px-2.5 py-0.5 text-xs font-bold text-ink-mute">
            <IconXCircle width={12} height={12} />
            Rejected
          </span>
        );
      },
    },
    {
      id: 'requestedAt',
      header: 'REQUESTED ON',
      className: 'text-xs text-ink-mute',
      render: (item) => formatDateFull(item.requestedAt),
    },
    {
      id: 'actions',
      header: 'ACTIONS',
      render: (item) => {
        if (item.status !== 'PENDING') {
          return (
            <span className="text-xs text-ink-faint font-medium">
              Decided {item.decidedAt ? formatDateFull(item.decidedAt) : ''}
            </span>
          );
        }

        const isBusy = actionInProgress === item.id;

        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isBusy}
              onClick={() => handleDecision(item.id, 'APPROVED', item.overCap)}
              className="rounded-lg bg-success-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-success-700 disabled:opacity-50 transition-colors"
            >
              {item.overCap ? 'Approve anyway' : 'Approve'}
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => handleDecision(item.id, 'REJECTED', item.overCap)}
              className="rounded-lg bg-danger-600 px-3 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-danger-700 disabled:opacity-50 transition-colors"
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
          <div className="mb-2">
            <Link
              href={`${base}/staff`}
              className="inline-flex items-center gap-1 text-xs font-bold text-navy-600 hover:text-navy-800 transition-colors"
            >
              ← Back to staff
            </Link>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-navy-950">
            Pocket money requests
          </h1>
          <p className="text-xs text-ink-mute font-medium mt-0.5">
            Review and decide on advance pocket money requests from wash boys in your region.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchData()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-bold text-ink shadow-2xs hover:bg-surface-muted transition-colors"
        >
          <IconRefresh width={14} height={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* 4 Top KPI Summary Cards */}
      <StatGrid columns={4}>
        <StatCard
          label="PENDING REQUESTS"
          value={stats.pendingCount}
          tone={stats.pendingCount > 0 ? 'rose' : 'emerald'}
          subtext={
            stats.pendingCount > 0
              ? `${money(stats.pendingAmount)} awaiting approval`
              : 'All caught up'
          }
        />
        <StatCard
          label="APPROVED"
          value={stats.approvedCount}
          tone="emerald"
          subtext={`${money(stats.approvedAmount)} disbursed this month`}
        />
        <StatCard
          label="REJECTED"
          value={stats.rejectedCount}
          tone="slate"
          subtext="Breached weekly caps or declined"
        />
        <StatCard
          label="TOTAL REQUESTS"
          value={stats.totalCount}
          tone="purple"
          subtext="Recorded this billing cycle"
        />
      </StatGrid>

      {/* Main Table Card */}
      <div className="rounded-2xl border border-line bg-surface p-4 sm:p-6 shadow-xs">
        {/* Filter and Search Bar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-faint">
              <IconSearch width={14} height={14} />
            </div>
            <input
              type="text"
              placeholder="Search by staff name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-line bg-surface py-1.5 pl-9 pr-3 text-xs text-ink placeholder:text-ink-faint focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500 transition-colors shadow-2xs"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 rounded-xl border border-line bg-surface-sunken p-1">
            {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setStatusFilter(s);
                  setPage(1);
                }}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                  statusFilter === s
                    ? 'bg-surface text-navy-950 shadow-2xs'
                    : 'text-ink-mute hover:text-navy-950'
                }`}
              >
                {s === 'ALL'
                  ? 'All requests'
                  : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Data Table */}
        <DataTable<PocketRequestItem>
          data={data}
          columns={columns}
          keyExtractor={(item) => item.id}
          itemLabel="pocket requests"
          page={page}
          pageSize={pageSize}
          totalItems={total}
          onPageChange={(p) => setPage(p)}
          emptyMessage={
            loading
              ? 'Loading pocket requests...'
              : 'No pocket money requests match your current filters.'
          }
        />
      </div>
    </div>
  );
}
