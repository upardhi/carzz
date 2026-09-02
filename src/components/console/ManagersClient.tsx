'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  IconAlert,
  IconRupee,
  IconTrendingUp,
  IconUser,
  IconUsers,
  IconWallet,
} from '@/components/shell/icons';
import {
  StatCard,
  StatGrid,
} from '@/components/ui/primitives';
import { DataTable } from '@/components/ui/DataTable';
import { formatDateFull, money, percent } from '@/lib/util/format';
import type { Staff, User } from '@/lib/data/types';
import type { AreaPerformance } from '@/lib/services/reports';

interface ManagersClientProps {
  managers: Staff[];
  performance: AreaPerformance[];
  users: User[];
  cycleLabel: string;
  canAddManager?: boolean;
}

export function ManagersClient({
  managers,
  performance,
  users,
  cycleLabel: _cycleLabel,
  canAddManager = false,
}: ManagersClientProps) {
  const performanceByArea = new Map(performance.map((p) => [p.area.id, p]));
  const userByStaff = new Map(
    users.filter((u) => u.staffId).map((u) => [u.staffId!, u]),
  );

  const totalManagers = managers.length;
  const totalCustomers = performance.reduce((s, p) => s + p.customers, 0);
  const totalCollected = performance.reduce((s, p) => s + p.collected, 0);
  const totalOutstanding = performance.reduce((s, p) => s + p.outstanding, 0);
  const totalMissed = performance.reduce((s, p) => s + p.washesMissed, 0);
  const totalStaff = performance.reduce((s, p) => s + p.staff, 0);

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const pagedManagers = managers.slice((page - 1) * perPage, page * perPage);

  // Initials generator
  function getInitials(name: string) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  const avatarColors = [
    'bg-rose-100 text-rose-700',
    'bg-emerald-100 text-emerald-700',
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-amber-100 text-amber-700',
  ];

  const areaPillColors: Record<string, string> = {
    'Bajaj Nagar': 'bg-rose-50 text-rose-700 border border-rose-100',
    'Civil Lines': 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    Wadi: 'bg-blue-50 text-blue-700 border border-blue-100',
  };

  const areaBoxThemes: Record<
    string,
    { iconColor: string; iconBg: string; pillColor: string }
  > = {
    'Bajaj Nagar': {
      iconColor: 'text-rose-600',
      iconBg: 'bg-rose-50',
      pillColor: 'bg-rose-50 text-rose-700 border border-rose-100',
    },
    'Civil Lines': {
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
      pillColor: 'bg-amber-50 text-amber-700 border border-amber-100',
    },
    Wadi: {
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50',
      pillColor: 'bg-amber-50 text-amber-700 border border-amber-100',
    },
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 shadow-sm">
            <IconUser width={22} height={22} strokeWidth={2.2} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-navy-950">
              Managers
            </h1>
            <p className="mt-0.5 text-xs font-semibold text-ink-mute">
              {totalManagers} area managers reporting to you
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Add Manager Button (shown only if user has access) */}
          {canAddManager ? (
            <Link
              href="/admin/users"
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-extrabold text-white shadow-sm transition-colors hover:bg-blue-700"
            >
              + Add Manager
            </Link>
          ) : null}
        </div>
      </div>

      {/* 6 Top KPI Summary Metric Cards */}
      <StatGrid columns={6}>
        <StatCard
          label="TOTAL MANAGERS"
          value={totalManagers}
          icon={<IconUsers width={20} height={20} strokeWidth={2} />}
          tone="blue"
          subtext="Active in this region"
          subtextTone="muted"
        />
        <StatCard
          label="TOTAL CUSTOMERS"
          value={totalCustomers}
          icon={<IconUsers width={20} height={20} strokeWidth={2} />}
          tone="emerald"
          subtext="Across all areas"
          subtextTone="muted"
        />
        <StatCard
          label="TOTAL COLLECTED"
          value={money(totalCollected)}
          icon={<IconWallet width={20} height={20} strokeWidth={2} />}
          tone="emerald"
          subtext={`${totalCollected + totalOutstanding > 0 ? Math.round((totalCollected / (totalCollected + totalOutstanding)) * 100) : 100}% efficiency`}
          subtextTone="success"
        />
        <StatCard
          label="TOTAL OUTSTANDING"
          value={money(totalOutstanding)}
          icon={<IconRupee width={20} height={20} strokeWidth={2.2} />}
          tone="amber"
          subtext="Pending collection"
          subtextTone="warning"
        />
        <StatCard
          label="TOTAL MISSED WASHES"
          value={totalMissed}
          icon={<IconAlert width={20} height={20} strokeWidth={2} />}
          tone="rose"
          subtext={totalMissed > 0 ? `${totalMissed} missed washes` : 'Zero missed washes'}
          subtextTone="danger"
        />
        <StatCard
          label="TOTAL STAFF"
          value={totalStaff}
          icon={<IconUser width={20} height={20} strokeWidth={2} />}
          tone="purple"
          subtext="Assigned staff"
          subtextTone="neutral"
        />
      </StatGrid>

      {/* Main Table Card: Area Managers Overview using DataTable */}
      <div className="space-y-3">
        <h2 className="text-base font-extrabold text-navy-950">
          Area managers overview
        </h2>
        <DataTable<Staff>
          data={pagedManagers}
          keyExtractor={(m) => m.id}
          itemLabel="managers"
          page={page}
          pageSize={perPage}
          totalItems={managers.length}
          onPageChange={setPage}
          onPageSizeChange={(newPerPage) => {
            setPerPage(newPerPage);
            setPage(1);
          }}
          pageSizeOptions={[10, 20, 50]}
          emptyMessage="No managers found in this region."
          columns={[
            {
              id: 'manager',
              header: 'MANAGER',
              render: (manager, idx) => {
                const avatarColor = avatarColors[idx % avatarColors.length];
                return (
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${avatarColor}`}
                    >
                      {getInitials(manager.name)}
                    </div>
                    <span className="font-bold text-navy-950">{manager.name}</span>
                  </div>
                );
              },
            },
            {
              id: 'area',
              header: 'AREA',
              render: (manager) => {
                const stats = performanceByArea.get(manager.areaId);
                const areaName = stats?.area.name ?? '—';
                const pillClass =
                  areaPillColors[areaName] ||
                  'bg-slate-100 text-slate-700 border border-slate-200';
                return (
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${pillClass}`}>
                    {areaName}
                  </span>
                );
              },
            },
            {
              id: 'login',
              header: 'LOGIN',
              className: 'text-slate-600',
              render: (manager) => userByStaff.get(manager.id)?.email ?? '—',
            },
            {
              id: 'customers',
              header: 'CUSTOMERS',
              align: 'center',
              className: 'font-semibold text-navy-950',
              render: (manager) => performanceByArea.get(manager.areaId)?.customers ?? 0,
            },
            {
              id: 'collected',
              header: 'COLLECTED',
              className: 'font-bold text-emerald-600',
              render: (manager) => money(performanceByArea.get(manager.areaId)?.collected ?? 0),
            },
            {
              id: 'outstanding',
              header: 'OUTSTANDING',
              className: 'font-bold text-amber-600',
              render: (manager) => money(performanceByArea.get(manager.areaId)?.outstanding ?? 0),
            },
            {
              id: 'missed',
              header: 'MISSED',
              align: 'center',
              className: 'font-bold text-rose-600',
              render: (manager) => performanceByArea.get(manager.areaId)?.washesMissed ?? 0,
            },
            {
              id: 'complaints',
              header: 'COMPLAINTS',
              align: 'center',
              className: 'font-semibold text-slate-700',
              render: (manager) => performanceByArea.get(manager.areaId)?.openComplaints ?? 0,
            },
            {
              id: 'margin',
              header: 'MARGIN',
              align: 'center',
              className: 'font-bold text-emerald-600',
              render: (manager) => {
                const stats = performanceByArea.get(manager.areaId);
                return stats ? percent(stats.margin) : '—';
              },
            },
            {
              id: 'since',
              header: 'SINCE',
              className: 'whitespace-nowrap text-slate-600',
              render: (manager) => formatDateFull(manager.joinedOn),
            },
          ]}
        />
      </div>

      {/* Bottom 2 Cards Grid */}
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Where to Push Card */}
        <div className="flex flex-col justify-between rounded-2xl border border-line-soft bg-white p-5 shadow-sm">
          <div>
            <div className="mb-4 flex items-center gap-2 text-base font-extrabold text-navy-950">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-50 text-purple-600">
                🎯
              </span>
              Where to push
            </div>

            <div className="space-y-3">
              {performance.map((area) => {
                const areaName = area.area.name;
                const theme = areaBoxThemes[areaName] || {
                  iconColor: 'text-blue-600',
                  iconBg: 'bg-blue-50',
                  pillColor: 'bg-amber-50 text-amber-700 border border-amber-100',
                };

                return (
                  <div
                    key={area.area.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-line-soft p-3.5 transition-colors hover:bg-slate-50/60"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${theme.iconBg} ${theme.iconColor}`}
                      >
                        <IconTrendingUp width={18} height={18} strokeWidth={2.2} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-navy-950">
                          {area.area.name}
                        </h4>
                        <p className="text-xs text-ink-mute">
                          {area.washesMissed} missed wash{area.washesMissed === 1 ? '' : 'es'} ·{' '}
                          {area.openComplaints} open complaint{area.openComplaints === 1 ? '' : 's'} · margin{' '}
                          {percent(area.margin)}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold ${theme.pillColor}`}
                    >
                      {money(area.outstanding)} outstanding
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 border-t border-line-soft pt-3">
            <Link
              href="/area/areas"
              className="inline-flex items-center gap-1 text-xs font-extrabold text-blue-600 hover:text-blue-800"
            >
              ⊕ View all areas →
            </Link>
          </div>
        </div>

        {/* Adding a Manager Card */}
        <div className="flex flex-col justify-between rounded-2xl border border-line-soft bg-white p-5 shadow-sm">
          <div>
            <div className="mb-4 flex items-center gap-2 text-base font-extrabold text-navy-950">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <IconUser width={16} height={16} strokeWidth={2.2} />
              </div>
              Adding a manager
            </div>

            {/* Notice Callout */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs leading-relaxed text-amber-900">
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200/80 text-[11px] font-bold text-amber-800">
                  ⓘ
                </span>
                <div>
                  Creating a manager account and assigning them to an area is a
                  Super Admin action, so one person owns the org chart. Ask the
                  owner from the People &amp; roles screen, and the new manager
                  appears here straight away.
                </div>
              </div>
            </div>
          </div>

          {canAddManager ? (
            <div className="mt-4 pt-3">
              <Link
                href="/admin/users"
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
              >
                + Add new manager
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}