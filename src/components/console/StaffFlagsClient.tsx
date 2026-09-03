'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  IconInfo,
  IconMapPin,
  IconRefresh,
  IconSearch,
} from '@/components/shell/icons';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { toast } from '@/components/ui/ToastProvider';
import { money } from '@/lib/util/format';

export interface DisciplineFlagItem {
  id: string;
  staffId: string;
  staffName: string;
  staffPhone: string;
  areaId: string;
  areaName: string;
  offs: number;
  allowedOffs: number;
  uninformed: number;
  isExtraOff: boolean;
  isUninformed: boolean;
  isWarningOnly: boolean;
  extraOffPenalty: number;
  uninformedPenalty: number;
  totalPenalty: number;
}

interface FlagStats {
  totalFlagged: number;
  totalUninformed: number;
  totalExtraOffs: number;
  totalPenalties: number;
}

const AVATAR_COLORS = [
  'bg-danger-50 text-danger-700',
  'bg-warning-50 text-warning-700',
  'bg-gold-50 text-gold-700',
  'bg-navy-50 text-navy-700',
];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface StaffFlagsClientProps {
  base: string;
}

export function StaffFlagsClient({ base }: StaffFlagsClientProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DisciplineFlagItem[]>([]);
  const [stats, setStats] = useState<FlagStats>({
    totalFlagged: 0,
    totalUninformed: 0,
    totalExtraOffs: 0,
    totalPenalties: 0,
  });

  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [total, setTotal] = useState(0);

  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

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
        type: typeFilter,
        q: debouncedSearch,
      });

      const res = await fetch(`/api/ops/staff/flags?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to load discipline flags');
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
      toast.error('Could not load discipline flags.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, typeFilter, debouncedSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const columns: Column<DisciplineFlagItem>[] = [
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
      id: 'offs',
      header: 'MONTHLY OFFS',
      render: (item) => (
        <div className="text-xs">
          <span className={`font-bold ${item.offs > item.allowedOffs ? 'text-danger-600' : 'text-ink'}`}>
            {item.offs}
          </span>
          <span className="text-ink-mute"> / {item.allowedOffs} allowed</span>
        </div>
      ),
    },
    {
      id: 'uninformed',
      header: 'UNINFORMED',
      render: (item) => (
        <div className="text-xs">
          {item.uninformed > 0 ? (
            <span className="font-bold text-danger-600">
              {item.uninformed} {item.uninformed === 1 ? 'day' : 'days'}
            </span>
          ) : (
            <span className="text-ink-faint">—</span>
          )}
        </div>
      ),
    },
    {
      id: 'reason',
      header: 'DISCIPLINE REASON',
      render: (item) => {
        const reasons: string[] = [];
        if (item.uninformed > 0) {
          reasons.push(`Absent without informing × ${item.uninformed}`);
        }
        if (item.isExtraOff) {
          reasons.push(`${item.offs} offs taken`);
        }
        return (
          <div className="text-xs font-medium text-ink">
            {reasons.join(' · ')}
          </div>
        );
      },
    },
    {
      id: 'status',
      header: 'FLAG STATUS',
      render: (item) => {
        if (item.isWarningOnly && item.uninformed === 0) {
          return (
            <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold text-warning-700 bg-warning-50 border border-warning-200">
              Warning
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold text-danger-600 bg-danger-50 border border-danger-100">
            Deduction Pending
          </span>
        );
      },
    },
    {
      id: 'deduction',
      header: 'PROJECTED DEDUCTION',
      className: 'text-right font-black text-sm',
      align: 'right',
      render: (item) => {
        if (item.totalPenalty === 0) {
          return <span className="text-xs font-bold text-warning-700">₹0 (Warning)</span>;
        }
        return <span className="text-danger-600 font-black text-sm">−{money(item.totalPenalty)}</span>;
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
            Discipline flags this month
          </h1>
          <p className="text-xs text-ink-mute font-medium mt-0.5">
            Staff members who have exceeded off allowances or registered uninformed absences this cycle.
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

      {/* 4 KPI Summary Cards */}
      <StatGrid columns={4}>
        <StatCard
          label="FLAGGED STAFF"
          value={stats.totalFlagged}
          tone={stats.totalFlagged > 0 ? 'rose' : 'emerald'}
          subtext={
            stats.totalFlagged > 0
              ? `${stats.totalFlagged} staff members need review`
              : 'Zero attendance flags'
          }
        />
        <StatCard
          label="UNINFORMED LEAVES"
          value={stats.totalUninformed}
          tone="rose"
          subtext="No prior notification"
        />
        <StatCard
          label="EXTRA OFFS"
          value={stats.totalExtraOffs}
          tone="amber"
          subtext="Above monthly limit"
        />
        <StatCard
          label="PROJECTED DEDUCTIONS"
          value={money(stats.totalPenalties)}
          tone="slate"
          subtext="Subject to owner approval"
        />
      </StatGrid>

      {/* Information Banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-warning-200 bg-warning-50 p-4 shadow-2xs">
        <div className="text-warning-600 shrink-0 mt-0.5">
          <IconInfo width={18} height={18} />
        </div>
        <div className="text-xs text-warning-900 leading-relaxed">
          <span className="font-bold">Automated Attendance Tracking: </span>
          Deductions are calculated automatically from staff login attendance records, but nothing is deducted until the owner approves the final month’s payout run.
        </div>
      </div>

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

          {/* Type Tabs */}
          <div className="flex items-center gap-1.5 rounded-xl border border-line bg-surface-sunken p-1">
            {(['ALL', 'UNINFORMED', 'EXTRA_OFFS'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTypeFilter(t);
                  setPage(1);
                }}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition-all ${
                  typeFilter === t
                    ? 'bg-surface text-navy-950 shadow-2xs'
                    : 'text-ink-mute hover:text-navy-950'
                }`}
              >
                {t === 'ALL'
                  ? 'All flags'
                  : t === 'UNINFORMED'
                    ? 'Uninformed absences'
                    : 'Extra offs'}
              </button>
            ))}
          </div>
        </div>

        {/* Data Table */}
        <DataTable<DisciplineFlagItem>
          data={data}
          columns={columns}
          keyExtractor={(item) => item.id}
          itemLabel="discipline flags"
          page={page}
          pageSize={pageSize}
          totalItems={total}
          onPageChange={(p) => setPage(p)}
          emptyMessage={
            loading
              ? 'Loading discipline flags...'
              : 'No staff members have attendance discipline flags this month.'
          }
        />
      </div>
    </div>
  );
}
