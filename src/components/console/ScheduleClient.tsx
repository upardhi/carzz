'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconCalendar,
  IconCar,
  IconCheckCircle,
  IconClock,
  IconDownload,
  IconMapPin,
  IconSearch,
  IconSliders,
  IconUser,
  IconUserX,
} from '@/components/shell/icons';
import {
  EmptyTableRow,
  StatCard,
  StatGrid,
  TablePagination,
} from '@/components/ui/primitives';
import { formatClock, formatTime } from '@/lib/util/format';
import { MISS_REASON_LABEL } from '@/lib/util/labels';
import { AssignSelect } from './AssignSelect';

export interface ScheduleItem {
  id: string;
  scheduledTime: string;
  customerId: string;
  customerName: string;
  carId: string;
  carModel: string;
  carPlate: string;
  areaId: string;
  areaName: string;
  staffId: string | null;
  staffName: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'MISSED';
  completedAt: string | null;
  missReason: string | null;
}

interface ScheduleClientProps {
  visits: ScheduleItem[];
  staff: Array<{ id: string; name: string; areaId: string }>;
  areas: Array<{ id: string; name: string }>;
  absentStaffCount: number;
  totalStaffCount: number;
  date: string;
  dateFormatted: string;
  areaWithGaps: string | null;
  areaWithGapsName: string | null;
  initialSearchParams?: Record<string, string | undefined>;
}

export function ScheduleClient({
  visits,
  staff,
  areas,
  absentStaffCount,
  totalStaffCount,
  date,
  dateFormatted,
  areaWithGaps,
  areaWithGapsName,
  initialSearchParams = {},
}: ScheduleClientProps) {
  const router = useRouter();

  // Local filter states
  const [statusFilter, setStatusFilter] = useState<string>(
    initialSearchParams.status || 'ALL',
  );
  const [staffFilter, setStaffFilter] = useState<string>(
    initialSearchParams.staff || 'ALL',
  );
  const [areaFilter, setAreaFilter] = useState<string>(
    initialSearchParams.area || 'ALL',
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);

  async function handleAutoAssign() {
    if (!areaWithGaps) return;
    setIsAutoAssigning(true);
    try {
      const res = await fetch('/api/ops/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'autoAssign', date, areaId: areaWithGaps }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setIsAutoAssigning(false);
    }
  }

  // Real dynamic statistics from the visits list
  const totalCars = visits.length;
  const completedCount = visits.filter((v) => v.status === 'DONE').length;
  const inProgressCount = visits.filter((v) => v.status === 'IN_PROGRESS').length;
  const missedCount = visits.filter((v) => v.status === 'MISSED').length;
  const unassignedCount = visits.filter(
    (v) => !v.staffId && v.status === 'PENDING',
  ).length;

  const completedPercent =
    totalCars > 0 ? ((completedCount / totalCars) * 100).toFixed(1) : '0';
  const missedPercent =
    totalCars > 0 ? ((missedCount / totalCars) * 100).toFixed(1) : '0';
  const unassignedPercent =
    totalCars > 0 ? ((unassignedCount / totalCars) * 100).toFixed(0) : '0';
  const absentPercent =
    totalStaffCount > 0
      ? ((absentStaffCount / totalStaffCount) * 100).toFixed(1)
      : '0';

  // Area badge color mapper
  const areaBadgeColors: Record<string, string> = {
    'Bajaj Nagar': 'bg-amber-50 text-amber-700 border-amber-200',
    'Civil Lines': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Wadi: 'bg-blue-50 text-blue-700 border-blue-200',
  };

  // Filtered schedules
  const filteredVisits = useMemo(() => {
    return visits.filter((v) => {
      if (statusFilter !== 'ALL' && v.status !== statusFilter) return false;
      if (staffFilter !== 'ALL' && v.staffId !== staffFilter) return false;
      if (areaFilter !== 'ALL' && v.areaId !== areaFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchCustomer = v.customerName.toLowerCase().includes(q);
        const matchCar = `${v.carModel} ${v.carPlate}`.toLowerCase().includes(q);
        const matchStaff = v.staffName?.toLowerCase().includes(q) ?? false;
        const matchArea = v.areaName.toLowerCase().includes(q);
        if (!matchCustomer && !matchCar && !matchStaff && !matchArea) return false;
      }
      return true;
    });
  }, [visits, statusFilter, staffFilter, areaFilter, searchQuery]);

  // Pagination calculation
  const currentPageVisits = useMemo(() => {
    const start = (page - 1) * perPage;
    return filteredVisits.slice(start, start + perPage);
  }, [filteredVisits, page, perPage]);

  // Export CSV
  function handleExport() {
    const headers = [
      'Time',
      'Customer',
      'Car Model',
      'Plate',
      'Area',
      'Wash Boy',
      'Status',
      'Completion Time',
      'Miss Reason',
    ];

    const rows = filteredVisits.map((v) => [
      `"${formatTime(v.scheduledTime)}"`,
      `"${v.customerName}"`,
      `"${v.carModel}"`,
      `"${v.carPlate}"`,
      `"${v.areaName}"`,
      `"${v.staffName || 'Unassigned'}"`,
      `"${v.status}"`,
      `"${v.completedAt ? formatClock(v.completedAt) : ''}"`,
      `"${v.missReason ? MISS_REASON_LABEL[v.missReason as keyof typeof MISS_REASON_LABEL] || v.missReason : ''}"`,
    ].join(','));

    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `schedule_${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Handle Date Change
  function handleDateChange(newDate: string) {
    if (!newDate) return;
    router.push(`?date=${newDate}`);
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm">
            <IconCalendar width={20} height={20} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-navy-950">
              Schedule
            </h1>
            <p className="mt-0.5 text-xs font-semibold text-ink-mute">
              {dateFormatted} · {totalCars} {totalCars === 1 ? 'car' : 'cars'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Date Selector */}
          <div className="relative flex items-center gap-2 rounded-xl border border-line-strong bg-white px-3 py-1.5 shadow-sm hover:border-navy-400">
            <IconCalendar width={15} height={15} className="text-slate-400" />
            <input
              type="date"
              aria-label="Select schedule date"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              className="cursor-pointer bg-transparent text-xs font-bold text-navy-950 focus:outline-none"
            />
          </div>

          {/* Export Button */}
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 rounded-xl border border-line-strong bg-white px-3.5 py-1.5 text-xs font-bold text-navy-950 shadow-sm transition-colors hover:border-navy-400 hover:bg-surface-muted"
          >
            <IconDownload width={15} height={15} className="text-slate-500" />
            Export
          </button>
        </div>
      </div>

      {/* 6 Top KPI Summary Metric Cards (100% Dynamic) */}
      <StatGrid columns={6}>
        <StatCard
          label="CARS"
          value={totalCars}
          icon={<IconCar width={20} height={20} strokeWidth={2} />}
          tone="blue"
          subtext="Total cars"
          subtextTone="info"
        />
        <StatCard
          label="COMPLETED"
          value={completedCount}
          icon={<IconCheckCircle width={20} height={20} strokeWidth={2} />}
          tone="emerald"
          subtext={`${completedPercent}% of total`}
          subtextTone="success"
        />
        <StatCard
          label="IN PROGRESS"
          value={inProgressCount}
          icon={<IconClock width={20} height={20} strokeWidth={2} />}
          tone="sky"
          subtext={inProgressCount > 0 ? `${inProgressCount} active` : 'No ongoing'}
          subtextTone="muted"
        />
        <StatCard
          label="NOT DONE"
          value={missedCount}
          icon={<IconClock width={20} height={20} strokeWidth={2} />}
          tone="amber"
          subtext={`${missedPercent}% of total`}
          subtextTone="warning"
        />
        <StatCard
          label="UNASSIGNED"
          value={unassignedCount}
          icon={<IconUser width={20} height={20} strokeWidth={2} />}
          tone="purple"
          subtext={`${unassignedPercent}% of total`}
          subtextTone="neutral"
        />
        <StatCard
          label="ABSENT STAFF"
          value={absentStaffCount}
          icon={<IconUserX width={20} height={20} strokeWidth={2} />}
          tone="rose"
          subtext={`${absentPercent}% of staff`}
          subtextTone="danger"
        />
      </StatGrid>

      {/* Auto-assign Gap Card if unassigned visits exist */}
      {unassignedCount > 0 && areaWithGaps ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 text-xs shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-rose-950">
                {unassignedCount} {unassignedCount === 1 ? 'car has' : 'cars have'} no wash boy
              </h3>
              <p className="mt-0.5 text-rose-700">
                Auto-assign distributes each unassigned car to the wash boy with the lightest round.
              </p>
            </div>
            <button
              type="button"
              disabled={isAutoAssigning}
              onClick={handleAutoAssign}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:opacity-50"
            >
              {isAutoAssigning ? 'Assigning...' : `Auto-assign in ${areaWithGapsName || 'this area'}`}
            </button>
          </div>
        </div>
      ) : null}

      {/* Filters and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 rounded-xl border border-line-strong bg-white px-3 py-1.5 text-xs font-bold text-navy-950 shadow-sm">
            <IconSliders width={14} height={14} className="text-blue-600" />
            <span className="text-ink-mute">Status —</span>
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="cursor-pointer bg-transparent font-bold text-navy-950 focus:outline-none"
            >
              <option value="ALL">all</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="DONE">Done</option>
              <option value="MISSED">Not done</option>
            </select>
          </div>

          {/* Staff Filter */}
          <div className="flex items-center gap-1.5 rounded-xl border border-line-strong bg-white px-3 py-1.5 text-xs font-bold text-navy-950 shadow-sm">
            <IconUser width={14} height={14} className="text-purple-600" />
            <span className="text-ink-mute">Staff —</span>
            <select
              aria-label="Filter by staff"
              value={staffFilter}
              onChange={(e) => {
                setStaffFilter(e.target.value);
                setPage(1);
              }}
              className="cursor-pointer bg-transparent font-bold text-navy-950 focus:outline-none"
            >
              <option value="ALL">all</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Area Filter */}
          {areas.length > 1 ? (
            <div className="flex items-center gap-1.5 rounded-xl border border-line-strong bg-white px-3 py-1.5 text-xs font-bold text-navy-950 shadow-sm">
              <IconMapPin width={14} height={14} className="text-emerald-600" />
              <span className="text-ink-mute">Area —</span>
              <select
                aria-label="Filter by area"
                value={areaFilter}
                onChange={(e) => {
                  setAreaFilter(e.target.value);
                  setPage(1);
                }}
                className="cursor-pointer bg-transparent font-bold text-navy-950 focus:outline-none"
              >
                <option value="ALL">all</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        {/* Right Search Input */}
        <div className="relative min-w-[260px] flex-1 sm:max-w-xs">
          <IconSearch
            width={15}
            height={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Search by customer, car or wash boy..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-xl border border-line-strong bg-white py-1.5 pl-9 pr-3 text-xs font-medium text-navy-950 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Schedules Table */}
      <div className="overflow-hidden rounded-2xl border border-line-soft bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line-soft bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-ink-mute">
                <th className="py-3 pl-4 pr-3 font-extrabold">TIME ⇅</th>
                <th className="py-3 px-3 font-extrabold">CUSTOMER</th>
                <th className="py-3 px-3 font-extrabold">CAR</th>
                <th className="py-3 px-3 font-extrabold">AREA</th>
                <th className="py-3 px-3 font-extrabold">WASH BOY</th>
                <th className="py-3 px-3 font-extrabold">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {currentPageVisits.map((visit) => {
                const areaBadge =
                  areaBadgeColors[visit.areaName] ||
                  'bg-slate-50 text-slate-700 border-slate-200';

                return (
                  <tr
                    key={visit.id}
                    className="transition-colors hover:bg-slate-50/70"
                  >
                    {/* Time */}
                    <td className="py-3 pl-4 pr-3 font-bold text-navy-950">
                      <div className="flex items-center gap-1.5">
                        <IconClock width={14} height={14} className="text-slate-400" />
                        <span>{formatTime(visit.scheduledTime)}</span>
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="py-3 px-3 font-bold text-navy-950">
                      {visit.customerName}
                    </td>

                    {/* Car Model & Plate */}
                    <td className="py-3 px-3">
                      <span className="font-semibold text-navy-950">
                        {visit.carModel}
                      </span>{' '}
                      <span className="text-slate-400">•</span>{' '}
                      <span className="font-mono text-[11px] text-slate-600">
                        {visit.carPlate}
                      </span>
                    </td>

                    {/* Area Badge */}
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${areaBadge}`}
                      >
                        <IconMapPin width={11} height={11} />
                        {visit.areaName}
                      </span>
                    </td>

                    {/* Wash Boy */}
                    <td className="py-3 px-3">
                      {visit.status === 'DONE' || visit.status === 'MISSED' ? (
                        <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                          <IconUser width={13} height={13} className="text-slate-400" />
                          <span>{visit.staffName || '—'}</span>
                        </div>
                      ) : (
                        <AssignSelect
                          visitId={visit.id}
                          current={visit.staffId}
                          staff={staff
                            .filter((s) => s.areaId === visit.areaId)
                            .map((s) => ({ id: s.id, name: s.name }))}
                        />
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3 px-3">
                      {visit.status === 'DONE' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                          <IconCheckCircle width={12} height={12} />
                          Done {visit.completedAt ? formatClock(visit.completedAt) : ''}
                        </span>
                      ) : visit.status === 'MISSED' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                          {visit.missReason
                            ? MISS_REASON_LABEL[visit.missReason as keyof typeof MISS_REASON_LABEL] || visit.missReason
                            : 'Not done'}
                        </span>
                      ) : visit.status === 'IN_PROGRESS' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-sky-100 bg-sky-50 px-2.5 py-0.5 text-[11px] font-bold text-sky-700">
                          In progress
                        </span>
                      ) : visit.staffId ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                          Pending
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-100 bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700">
                          No staff
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}

              {currentPageVisits.length === 0 ? (
                <EmptyTableRow
                  colSpan={6}
                  message={`No schedules match the selected filters for ${dateFormatted}.`}
                />
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Table Footer with Pagination */}
        <div className="border-t border-line-soft bg-slate-50/40 px-4 py-3">
          <TablePagination
            page={page}
            totalItems={filteredVisits.length}
            perPage={perPage}
            onPageChange={setPage}
            onPerPageChange={(newPerPage) => {
              setPerPage(newPerPage);
              setPage(1);
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default ScheduleClient;