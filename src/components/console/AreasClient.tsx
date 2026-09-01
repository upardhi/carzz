'use client';

import { useState } from 'react';
import {
  IconCalendar,
  IconCar,
  IconChart,
  IconClock,
  IconDownload,
  IconDroplet,
  IconInfo,
  IconRupee,
  IconStar,
  IconTrendingUp,
  IconUser,
  IconUsers,
  IconWallet,
  IconXCircle,
} from '@/components/shell/icons';
import { money, percent } from '@/lib/util/format';
import type { AreaPerformance } from '@/lib/services/reports';

interface AreasClientProps {
  performance: AreaPerformance[];
  managerNames: Record<string, string>;
  cycle: string;
  cycleLabel: string;
}

export function AreasClient({
  performance,
  managerNames,
  cycle: _cycle,
  cycleLabel,
}: AreasClientProps) {
  const [selectedCycle, setSelectedCycle] = useState('2026-09');

  const totalCustomers = performance.reduce((s, p) => s + p.customers, 0);
  const totalCollected = performance.reduce((s, p) => s + p.collected, 0);
  const totalOutstanding = performance.reduce((s, p) => s + p.outstanding, 0);
  const totalWashesDone = performance.reduce((s, p) => s + p.washesDone, 0);
  const totalWashesMissed = performance.reduce((s, p) => s + p.washesMissed, 0);
  const totalStaff = performance.reduce((s, p) => s + p.staff, 0);

  const best = [...performance].sort((a, b) => b.margin - a.margin)[0];
  const worst = [...performance].sort((a, b) => a.margin - b.margin)[0];

  function handleExport() {
    const headers = [
      'Area',
      'Manager',
      'Customers',
      'Cars',
      'Staff',
      'Collected',
      'Outstanding',
      'Profit',
      'Margin',
      'Missed Washes',
      'Rating',
      'Collection Efficiency',
    ];

    const rows = performance.map((p) => {
      const manager = p.area.managerId ? managerNames[p.area.managerId] || '—' : '—';
      const totalBilled = p.collected + p.outstanding;
      const efficiency =
        totalBilled > 0 ? `${Math.round((p.collected / totalBilled) * 100)}%` : '100%';

      return [
        `"${p.area.name}"`,
        `"${manager}"`,
        p.customers,
        p.activeCars,
        p.staff,
        p.collected,
        p.outstanding,
        p.profit,
        `"${percent(p.margin)}"`,
        p.washesMissed,
        p.averageRating ? p.averageRating.toFixed(1) : 'N/A',
        `"${efficiency}"`,
      ].join(',');
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `areas_report_${selectedCycle}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-6">
      {/* Header Section with Month Picker and Export Button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-navy-950">
            Areas in your region
          </h1>
          <p className="mt-0.5 text-xs font-semibold text-ink-mute">
            {cycleLabel} · {performance.length} areas
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Month Selector Dropdown */}
          <div className="relative">
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
          </div>

          {/* Export Report Button */}
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 rounded-xl border border-line-strong bg-white px-3.5 py-1.5 text-xs font-bold text-navy-950 shadow-sm transition-colors hover:border-navy-400 hover:bg-surface-muted"
          >
            <IconDownload width={15} height={15} className="text-slate-500" />
            Export report
          </button>
        </div>
      </div>

      {/* 6 Top KPI Summary Metric Cards */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
        {/* Customers */}
        <div className="flex flex-col justify-between rounded-xl border border-line-soft bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <IconUsers width={20} height={20} strokeWidth={2} />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-ink-mute">
                CUSTOMERS
              </div>
              <div className="text-2xl font-black text-navy-950">{totalCustomers}</div>
            </div>
          </div>
          <div className="mt-2 text-[11px] font-semibold text-emerald-600">
            ↗ 12% <span className="font-normal text-ink-faint">vs Aug 2026</span>
          </div>
        </div>

        {/* Collected */}
        <div className="flex flex-col justify-between rounded-xl border border-line-soft bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <IconWallet width={20} height={20} strokeWidth={2} />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-ink-mute">
                COLLECTED
              </div>
              <div className="text-xl font-black text-navy-950 sm:text-2xl">
                {money(totalCollected)}
              </div>
            </div>
          </div>
          <div className="mt-2 text-[11px] font-semibold text-emerald-600">
            ↗ 8% <span className="font-normal text-ink-faint">vs Aug 2026</span>
          </div>
        </div>

        {/* Outstanding */}
        <div className="flex flex-col justify-between rounded-xl border border-line-soft bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <IconRupee width={20} height={20} strokeWidth={2.2} />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-ink-mute">
                OUTSTANDING
              </div>
              <div className="text-xl font-black text-navy-950 sm:text-2xl">
                {money(totalOutstanding)}
              </div>
            </div>
          </div>
          <div className="mt-2 text-[11px] font-semibold text-amber-600">
            ↘ 5% <span className="font-normal text-ink-faint">vs Aug 2026</span>
          </div>
        </div>

        {/* Washes Done */}
        <div className="flex flex-col justify-between rounded-xl border border-line-soft bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <IconDroplet width={20} height={20} strokeWidth={2} />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-ink-mute">
                WASHES DONE
              </div>
              <div className="text-2xl font-black text-navy-950">{totalWashesDone}</div>
            </div>
          </div>
          <div className="mt-2 text-[11px] font-semibold text-emerald-600">
            ↗ 10% <span className="font-normal text-ink-faint">vs Aug 2026</span>
          </div>
        </div>

        {/* Washes Missed */}
        <div className="flex flex-col justify-between rounded-xl border border-line-soft bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <IconXCircle width={20} height={20} strokeWidth={2} />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-ink-mute">
                WASHES MISSED
              </div>
              <div className="text-2xl font-black text-navy-950">{totalWashesMissed}</div>
            </div>
          </div>
          <div className="mt-2 text-[11px] font-semibold text-rose-600">
            ↘ 13% <span className="font-normal text-ink-faint">vs Aug 2026</span>
          </div>
        </div>

        {/* Staff */}
        <div className="flex flex-col justify-between rounded-xl border border-line-soft bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <IconUser width={20} height={20} strokeWidth={2} />
            </div>
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-ink-mute">
                STAFF
              </div>
              <div className="text-2xl font-black text-navy-950">{totalStaff}</div>
            </div>
          </div>
          <div className="mt-2 text-[11px] font-semibold text-emerald-600">
            ↗ 11% <span className="font-normal text-ink-faint">vs Aug 2026</span>
          </div>
        </div>
      </div>

      {/* 3 Area Performance Cards Grid */}
      <div className="grid gap-5 lg:grid-cols-3">
        {performance.map((area) => {
          const isWorst = performance.length > 1 && area.area.id === worst?.area.id;
          const isBest = performance.length > 1 && area.area.id === best?.area.id;
          const managerName = area.area.managerId
            ? managerNames[area.area.managerId] || 'No manager'
            : 'No manager assigned';

          // Collection efficiency
          const totalBilled = area.collected + area.outstanding;
          const collectionEfficiency =
            totalBilled > 0 ? Math.round((area.collected / totalBilled) * 100) : 100;

          // Theme configuration based on performance
          const theme = isWorst
            ? {
                borderAccent: 'border-l-4 border-l-rose-500',
                badgeText: 'Weakest',
                badgeStyle: 'bg-rose-50 text-rose-600 border border-rose-100',
                analyticsBg: 'bg-rose-50/50 border border-rose-100',
                marginLabel: 'Low',
                marginColor: 'text-rose-600',
                efficiencyColor: 'text-rose-600',
                chartColor: 'text-rose-500',
              }
            : isBest
              ? {
                  borderAccent: 'border-l-4 border-l-emerald-500',
                  badgeText: 'Best margin',
                  badgeStyle: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
                  analyticsBg: 'bg-emerald-50/50 border border-emerald-100',
                  marginLabel: 'High',
                  marginColor: 'text-emerald-600',
                  efficiencyColor: 'text-emerald-600',
                  chartColor: 'text-emerald-500',
                }
              : {
                  borderAccent: 'border-l-4 border-l-blue-500',
                  badgeText: 'Good performance',
                  badgeStyle: 'bg-blue-50 text-blue-600 border border-blue-100',
                  analyticsBg: 'bg-blue-50/50 border border-blue-100',
                  marginLabel: 'Good',
                  marginColor: 'text-blue-600',
                  efficiencyColor: 'text-blue-600',
                  chartColor: 'text-blue-500',
                };

          return (
            <div
              key={area.area.id}
              className={`flex flex-col justify-between rounded-2xl border border-line-soft bg-white p-5 shadow-sm transition-all hover:shadow-md ${theme.borderAccent}`}
            >
              <div>
                {/* Area Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-black text-navy-950">
                      {area.area.name}
                    </h3>
                    <p className="text-xs font-semibold text-ink-mute">
                      {managerName}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-0.5 text-xs font-bold ${theme.badgeStyle}`}
                  >
                    {theme.badgeText}
                  </span>
                </div>

                {/* Metrics List with Icons */}
                <div className="mt-4 space-y-2.5 text-sm">
                  {/* Customers */}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-500">
                      <IconUsers width={16} height={16} className="text-slate-400" />
                      Customers
                    </span>
                    <span className="font-bold text-navy-950">{area.customers}</span>
                  </div>

                  {/* Cars */}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-500">
                      <IconCar width={16} height={16} className="text-slate-400" />
                      Cars
                    </span>
                    <span className="font-bold text-navy-950">{area.activeCars}</span>
                  </div>

                  {/* Staff */}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-500">
                      <IconUser width={16} height={16} className="text-slate-400" />
                      Staff
                    </span>
                    <span className="font-bold text-navy-950">{area.staff}</span>
                  </div>

                  <div className="my-1 border-t border-dashed border-line-soft" />

                  {/* Collected */}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-500">
                      <IconWallet width={16} height={16} className="text-slate-400" />
                      Collected
                    </span>
                    <span className="font-extrabold text-emerald-600">
                      {money(area.collected)}
                    </span>
                  </div>

                  {/* Outstanding */}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-500">
                      <IconClock width={16} height={16} className="text-slate-400" />
                      Outstanding
                    </span>
                    <span className="font-extrabold text-amber-600">
                      {money(area.outstanding)}
                    </span>
                  </div>

                  {/* Profit */}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-500">
                      <IconTrendingUp width={16} height={16} className="text-slate-400" />
                      Profit
                    </span>
                    <span className="font-extrabold text-emerald-600">
                      {money(area.profit)} ({percent(area.margin)})
                    </span>
                  </div>

                  <div className="my-1 border-t border-dashed border-line-soft" />

                  {/* Missed Washes */}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-500">
                      <IconDroplet width={16} height={16} className="text-slate-400" />
                      Missed washes
                    </span>
                    <span
                      className={`font-bold ${
                        area.washesMissed > 0 ? 'text-rose-600' : 'text-slate-800'
                      }`}
                    >
                      {area.washesMissed}
                    </span>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-slate-500">
                      <IconStar width={16} height={16} className="text-slate-400" />
                      Rating
                    </span>
                    <span className="flex items-center gap-1 font-bold text-navy-950">
                      {area.averageRating ? area.averageRating.toFixed(1) : '—'}{' '}
                      <span className="text-amber-500">★</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom Analytics Box (Margin & Collection Efficiency) */}
              <div className={`mt-5 rounded-xl p-3.5 ${theme.analyticsBg}`}>
                <div className="grid grid-cols-2 gap-2">
                  {/* Left: Margin */}
                  <div className="flex items-center gap-2.5">
                    <div className="shrink-0">
                      <IconChart width={22} height={22} className={theme.chartColor} />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-500">Margin</div>
                      <div className={`text-sm font-black ${theme.marginColor}`}>
                        {theme.marginLabel}
                      </div>
                    </div>
                  </div>

                  {/* Right: Collection Efficiency */}
                  <div className="border-l border-line-soft pl-3">
                    <div className="text-[10px] font-bold text-slate-500">
                      Collection efficiency
                    </div>
                    <div className={`text-sm font-black ${theme.efficiencyColor}`}>
                      {collectionEfficiency}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom "How to read this" Info Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50/70 via-blue-50/30 to-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
              <IconInfo width={18} height={18} strokeWidth={2.4} />
            </div>
            <div>
              <h4 className="text-sm font-black text-navy-950">How to read this</h4>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">
                Every missed wash returns to the customer&rsquo;s count, so it is
                delivered later at no extra charge. An area with many missed
                washes therefore carries the delivery cost twice — which is why
                a weak margin usually shows up here before it shows up in collection.
              </p>
            </div>
          </div>

          {/* Decorative Subtle Illustration Graphic on the right */}
          <div className="hidden shrink-0 items-center justify-center opacity-80 lg:flex">
            <svg
              width="140"
              height="70"
              viewBox="0 0 140 70"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-blue-500"
            >
              {/* Document / Chart Background */}
              <rect
                x="10"
                y="5"
                width="40"
                height="50"
                rx="4"
                fill="#E0E7FF"
                stroke="#93C5FD"
                strokeWidth="1.5"
              />
              <line x1="16" y1="15" x2="34" y2="15" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
              <line x1="16" y1="22" x2="42" y2="22" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="16" y1="28" x2="30" y2="28" stroke="#93C5FD" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M16 42 L24 35 L32 38 L42 29" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

              {/* Modern Car Silhouette */}
              <rect x="50" y="24" width="75" height="32" rx="8" fill="#3B82F6" />
              <path d="M60 24 L70 12 L105 12 L115 24 Z" fill="#60A5FA" />
              <rect x="72" y="15" width="16" height="8" rx="1.5" fill="#DBEAFE" />
              <rect x="91" y="15" width="16" height="8" rx="1.5" fill="#DBEAFE" />
              <circle cx="68" cy="56" r="7" fill="#1E293B" />
              <circle cx="68" cy="56" r="3.5" fill="#94A3B8" />
              <circle cx="108" cy="56" r="7" fill="#1E293B" />
              <circle cx="108" cy="56" r="3.5" fill="#94A3B8" />
              {/* Headlights */}
              <circle cx="122" cy="34" r="2.5" fill="#FEF08A" />
              <circle cx="53" cy="34" r="2.5" fill="#EF4444" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
