'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  IconAlert,
  IconCalendar,
  IconRupee,
  IconTrendingUp,
  IconUser,
  IconUsers,
  IconWallet,
} from '@/components/shell/icons';
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
  const [selectedCycle, setSelectedCycle] = useState('2026-09');

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
          {/* Month Selector Dropdown */}
          <div className="flex items-center gap-2 rounded-xl border border-line-strong bg-white px-3 py-1.5 shadow-sm hover:border-navy-400">
            <IconCalendar width={15} height={15} className="text-slate-400" />
            <select
              aria-label="Select billing cycle"
              value={selectedCycle}
              onChange={(e) => setSelectedCycle(e.target.value)}
              className="cursor-pointer bg-transparent text-xs font-bold text-navy-950 focus:outline-none"
            >
              <option value="2026-09">September 2026</option>
              <option value="2026-08">August 2026</option>
              <option value="2026-07">July 2026</option>
            </select>
          </div>

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
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
        {/* Total Managers */}
        <div className="flex flex-col justify-between rounded-xl border border-line-soft bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <IconUsers width={20} height={20} strokeWidth={2} />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-ink-mute">
                TOTAL MANAGERS
              </div>
              <div className="text-2xl font-black text-navy-950">{totalManagers}</div>
            </div>
          </div>
          <div className="mt-2 text-[11px] font-medium text-ink-faint">
            Active in this region
          </div>
        </div>

        {/* Total Customers */}
        <div className="flex flex-col justify-between rounded-xl border border-line-soft bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <IconUsers width={20} height={20} strokeWidth={2} />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-ink-mute">
                TOTAL CUSTOMERS
              </div>
              <div className="text-2xl font-black text-navy-950">{totalCustomers}</div>
            </div>
          </div>
          <div className="mt-2 text-[11px] font-medium text-ink-faint">
            Across all areas
          </div>
        </div>

        {/* Total Collected */}
        <div className="flex flex-col justify-between rounded-xl border border-line-soft bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <IconWallet width={20} height={20} strokeWidth={2} />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-ink-mute">
                TOTAL COLLECTED
              </div>
              <div className="text-xl font-black text-navy-950 sm:text-2xl">
                {money(totalCollected)}
              </div>
            </div>
          </div>
          <div className="mt-2 text-[11px] font-semibold text-emerald-600">
            ↑ 8% <span className="font-normal text-ink-faint">vs Aug 2026</span>
          </div>
        </div>

        {/* Total Outstanding */}
        <div className="flex flex-col justify-between rounded-xl border border-line-soft bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <IconRupee width={20} height={20} strokeWidth={2.2} />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-ink-mute">
                TOTAL OUTSTANDING
              </div>
              <div className="text-xl font-black text-navy-950 sm:text-2xl">
                {money(totalOutstanding)}
              </div>
            </div>
          </div>
          <div className="mt-2 text-[11px] font-semibold text-amber-600">
            ↓ 5% <span className="font-normal text-ink-faint">vs Aug 2026</span>
          </div>
        </div>

        {/* Total Missed Washes */}
        <div className="flex flex-col justify-between rounded-xl border border-line-soft bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <IconAlert width={20} height={20} strokeWidth={2} />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-ink-mute">
                TOTAL MISSED WASHES
              </div>
              <div className="text-2xl font-black text-navy-950">{totalMissed}</div>
            </div>
          </div>
          <div className="mt-2 text-[11px] font-semibold text-rose-600">
            ↑ 13% <span className="font-normal text-ink-faint">vs Aug 2026</span>
          </div>
        </div>

        {/* Total Staff */}
        <div className="flex flex-col justify-between rounded-xl border border-line-soft bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <IconUser width={20} height={20} strokeWidth={2} />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-ink-mute">
                TOTAL STAFF
              </div>
              <div className="text-2xl font-black text-navy-950">{totalStaff}</div>
            </div>
          </div>
          <div className="mt-2 text-[11px] font-semibold text-emerald-600">
            ↑ 11% <span className="font-normal text-ink-faint">vs Aug 2026</span>
          </div>
        </div>
      </div>

      {/* Main Table Card: Area Managers Overview */}
      <div className="rounded-2xl border border-line-soft bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-extrabold text-navy-950">
          Area managers overview
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line-soft text-[11px] font-bold uppercase tracking-wider text-ink-mute">
                <th className="pb-3 font-extrabold">MANAGER</th>
                <th className="pb-3 font-extrabold">AREA</th>
                <th className="pb-3 font-extrabold">LOGIN</th>
                <th className="pb-3 text-center font-extrabold">CUSTOMERS</th>
                <th className="pb-3 font-extrabold">COLLECTED</th>
                <th className="pb-3 font-extrabold">OUTSTANDING</th>
                <th className="pb-3 text-center font-extrabold">MISSED</th>
                <th className="pb-3 text-center font-extrabold">COMPLAINTS</th>
                <th className="pb-3 text-center font-extrabold">MARGIN</th>
                <th className="pb-3 font-extrabold">SINCE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {managers.map((manager, idx) => {
                const stats = performanceByArea.get(manager.areaId);
                const user = userByStaff.get(manager.id);
                const areaName = stats?.area.name ?? '—';
                const pillClass =
                  areaPillColors[areaName] ||
                  'bg-slate-100 text-slate-700 border border-slate-200';
                const avatarColor = avatarColors[idx % avatarColors.length];

                return (
                  <tr key={manager.id} className="transition-colors hover:bg-slate-50/60">
                    {/* Manager Name + Avatar */}
                    <td className="py-3.5 pr-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${avatarColor}`}
                        >
                          {getInitials(manager.name)}
                        </div>
                        <span className="font-bold text-navy-950">{manager.name}</span>
                      </div>
                    </td>

                    {/* Area Pill */}
                    <td className="py-3.5 pr-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${pillClass}`}>
                        {areaName}
                      </span>
                    </td>

                    {/* Login */}
                    <td className="py-3.5 pr-3 text-slate-600">
                      {user?.email ?? '—'}
                    </td>

                    {/* Customers */}
                    <td className="py-3.5 text-center font-semibold text-navy-950">
                      {stats?.customers ?? 0}
                    </td>

                    {/* Collected */}
                    <td className="py-3.5 font-bold text-emerald-600">
                      {money(stats?.collected ?? 0)}
                    </td>

                    {/* Outstanding */}
                    <td className="py-3.5 font-bold text-amber-600">
                      {money(stats?.outstanding ?? 0)}
                    </td>

                    {/* Missed */}
                    <td className="py-3.5 text-center font-bold text-rose-600">
                      {stats?.washesMissed ?? 0}
                    </td>

                    {/* Complaints */}
                    <td className="py-3.5 text-center font-semibold text-slate-700">
                      {stats?.openComplaints ?? 0}
                    </td>

                    {/* Margin */}
                    <td className="py-3.5 text-center font-bold text-emerald-600">
                      {stats ? percent(stats.margin) : '—'}
                    </td>

                    {/* Since */}
                    <td className="whitespace-nowrap py-3.5 text-slate-600">
                      {formatDateFull(manager.joinedOn)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination at bottom */}
        <div className="mt-4 flex items-center justify-center gap-2 border-t border-line-soft pt-3">
          <button
            type="button"
            disabled
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-line-soft text-xs text-slate-400 opacity-50"
          >
            ‹
          </button>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white shadow-sm"
          >
            1
          </button>
          <button
            type="button"
            disabled
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-line-soft text-xs text-slate-400 opacity-50"
          >
            ›
          </button>
        </div>
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
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
              >
                + Add new manager
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Add Manager Info Modal */}
      {showAddModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-line-soft bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 text-navy-950">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <IconUser width={20} height={20} />
              </div>
              <div>
                <h3 className="text-base font-extrabold">Add Area Manager</h3>
                <p className="text-xs text-ink-mute">Super Admin Authority Required</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              Manager accounts are provisioned by the <strong>Super Admin</strong> to ensure centralized role and area assignments. Please contact your administrator to create a new manager profile.
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-xl bg-navy-900 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-navy-800"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}