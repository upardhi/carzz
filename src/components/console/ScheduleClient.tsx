'use client';

import { useMemo, useState, useEffect } from 'react';
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
  StatCard,
  StatGrid,
} from '@/components/ui/primitives';
import { DataTable } from '@/components/ui/DataTable';
import { toast } from '@/components/ui/ToastProvider';
import { formatClock, formatTime } from '@/lib/util/format';
import { MISS_REASON_LABEL } from '@/lib/util/labels';
import { useDebounce } from '@/lib/util/debounce';
import { washDurationMinutes, formatDurationMinutes } from '@/lib/util/washTiming';
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
  startedAt?: string | null;
  missReason: string | null;
  beforePhotoUrl?: string | null;
  afterPhotoUrl?: string | null;
  rating?: number | null;
  ratingComment?: string | null;
  managerRating?: number | null;
  managerRatingComment?: string | null;
}

interface ScheduleClientProps {
  visits: ScheduleItem[];
  staff: Array<{ id: string; name: string; areaId: string; isOnLeave?: boolean }>;
  areas: Array<{ id: string; name: string }>;
  absentStaffCount: number;
  totalStaffCount: number;
  date: string;
  dateFormatted: string;
  areaWithGaps: string | null;
  areaWithGapsName: string | null;
  onLeaveStaffNames?: string[];
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
  onLeaveStaffNames = [],
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
  const debouncedSearch = useDebounce(searchQuery, 250);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);

  // Wash inspection / rating modal
  const [visitList, setVisitList] = useState(visits);
  useEffect(() => setVisitList(visits), [visits]);
  const [ratingVisit, setRatingVisit] = useState<ScheduleItem | null>(null);
  const [ratingDraft, setRatingDraft] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [savingRating, setSavingRating] = useState(false);

  function openRatingModal(visit: ScheduleItem) {
    setRatingVisit(visit);
    setRatingDraft(visit.managerRating ?? 0);
    setRatingComment(visit.managerRatingComment ?? '');
  }

  async function saveWashRating() {
    if (!ratingVisit || ratingDraft < 1) return;
    setSavingRating(true);
    try {
      const res = await fetch('/api/ops/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rateWash',
          visitId: ratingVisit.id,
          rating: ratingDraft,
          comment: ratingComment.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save the rating.');
      toast.success('Rating saved.');
      setVisitList((prev) =>
        prev.map((v) =>
          v.id === ratingVisit.id
            ? { ...v, managerRating: ratingDraft, managerRatingComment: ratingComment.trim() || null }
            : v,
        ),
      );
      setRatingVisit(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the rating.');
    } finally {
      setSavingRating(false);
    }
  }

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

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
  const totalCars = visitList.length;
  const completedCount = visitList.filter((v) => v.status === 'DONE').length;
  const inProgressCount = visitList.filter((v) => v.status === 'IN_PROGRESS').length;
  const missedCount = visitList.filter((v) => v.status === 'MISSED').length;
  const unassignedCount = visitList.filter(
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
    return visitList.filter((v) => {
      if (statusFilter !== 'ALL' && v.status !== statusFilter) return false;
      if (staffFilter !== 'ALL' && v.staffId !== staffFilter) return false;
      if (areaFilter !== 'ALL' && v.areaId !== areaFilter) return false;
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase();
        const matchCustomer = v.customerName.toLowerCase().includes(q);
        const matchCar = `${v.carModel} ${v.carPlate}`.toLowerCase().includes(q);
        const matchStaff = v.staffName?.toLowerCase().includes(q) ?? false;
        const matchArea = v.areaName.toLowerCase().includes(q);
        if (!matchCustomer && !matchCar && !matchStaff && !matchArea) return false;
      }
      return true;
    });
  }, [visitList, statusFilter, staffFilter, areaFilter, debouncedSearch]);

  // Track daily workload per staff member
  const staffLoadMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of visitList) {
      if (v.staffId && v.status !== 'MISSED') {
        map.set(v.staffId, (map.get(v.staffId) ?? 0) + 1);
      }
    }
    return map;
  }, [visitList]);

  // Safeguard: Detect overloaded staff members (> 14 cars on this date)
  const overloadedStaff = useMemo(() => {
    const list: { id: string; name: string; count: number }[] = [];
    staffLoadMap.forEach((count, sId) => {
      if (count > 14) {
        const s = staff.find((m) => m.id === sId);
        if (s) list.push({ id: s.id, name: s.name, count });
      }
    });
    return list;
  }, [staffLoadMap, staff]);

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
            <h1 className="text-2xl font-bold tracking-tight text-navy-950">
              Schedule
            </h1>
            <p className="mt-0.5 text-xs font-medium text-ink-mute">
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
              className="cursor-pointer bg-transparent text-xs font-semibold text-navy-950 focus:outline-none"
            />
          </div>

          {/* Export Button */}
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 rounded-xl border border-line-strong bg-white px-3.5 py-1.5 text-xs font-semibold text-navy-950 shadow-sm transition-colors hover:border-navy-400 hover:bg-surface-muted"
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
              <h3 className="text-sm font-semibold text-rose-950">
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
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-rose-700 disabled:opacity-50"
            >
              {isAutoAssigning ? 'Assigning...' : `Auto-assign in ${areaWithGapsName || 'this area'}`}
            </button>
          </div>
        </div>
      ) : null}

      {/* Staff On Leave Banner */}
      {onLeaveStaffNames.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-xs shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-lg">🏖️</span>
            <div>
              <h3 className="text-sm font-semibold text-amber-950">
                {onLeaveStaffNames.length} staff member{onLeaveStaffNames.length === 1 ? ' is' : 's are'} on leave on this date: {onLeaveStaffNames.join(', ')}
              </h3>
              <p className="text-amber-800">
                Their assigned services are freed for coverage. Check the table to assign available wash boys.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Overload Safeguard Alert if any staff member exceeds 14 washes */}
      {overloadedStaff.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-xs shadow-sm">
          <div className="flex items-start gap-3">
            <span className="text-lg leading-none">⚠️</span>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-amber-950">
                Staff Workload Safeguard Alert
              </h3>
              <p className="text-amber-900 leading-relaxed">
                {overloadedStaff.map((s) => (
                  <span key={s.id} className="mr-3 inline-block">
                    • <b>{s.name}</b> has <b>{s.count} cars</b> scheduled today (recommended max capacity: 14).
                  </span>
                ))}
              </p>
              <p className="text-[11px] font-semibold text-amber-800">
                Use the wash boy dropdown in the table below to reassign cars to staff with lighter rounds.
              </p>
            </div>
          </div>
        </div>
      )}


      {/* Filters and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 rounded-xl border border-line-strong bg-white px-3 py-1.5 text-xs font-semibold text-navy-950 shadow-sm">
            <IconSliders width={14} height={14} className="text-blue-600" />
            <span className="text-ink-mute">Status —</span>
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="cursor-pointer bg-transparent font-semibold text-navy-950 focus:outline-none"
            >
              <option value="ALL">all</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="DONE">Done</option>
              <option value="MISSED">Not done</option>
            </select>
          </div>

          {/* Staff Filter */}
          <div className="flex items-center gap-1.5 rounded-xl border border-line-strong bg-white px-3 py-1.5 text-xs font-semibold text-navy-950 shadow-sm">
            <IconUser width={14} height={14} className="text-purple-600" />
            <span className="text-ink-mute">Staff —</span>
            <select
              aria-label="Filter by staff"
              value={staffFilter}
              onChange={(e) => {
                setStaffFilter(e.target.value);
                setPage(1);
              }}
              className="cursor-pointer bg-transparent font-semibold text-navy-950 focus:outline-none"
            >
              <option value="ALL">all ({staff.length})</option>
              {staff.map((s) => {
                const count = staffLoadMap.get(s.id) ?? 0;
                return (
                  <option key={s.id} value={s.id}>
                    {s.name} ({count} cars{count > 14 ? ' ⚠️ Over capacity' : ''})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Area Filter */}
          {areas.length > 1 ? (
            <div className="flex items-center gap-1.5 rounded-xl border border-line-strong bg-white px-3 py-1.5 text-xs font-semibold text-navy-950 shadow-sm">
              <IconMapPin width={14} height={14} className="text-emerald-600" />
              <span className="text-ink-mute">Area —</span>
              <select
                aria-label="Filter by area"
                value={areaFilter}
                onChange={(e) => {
                  setAreaFilter(e.target.value);
                  setPage(1);
                }}
                className="cursor-pointer bg-transparent font-semibold text-navy-950 focus:outline-none"
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

      {/* Schedules Table using DataTable */}
      <DataTable<ScheduleItem>
        data={currentPageVisits}
        keyExtractor={(v) => v.id}
        itemLabel="schedules"
        page={page}
        pageSize={perPage}
        totalItems={filteredVisits.length}
        onPageChange={setPage}
        onPageSizeChange={(newPerPage) => {
          setPerPage(newPerPage);
          setPage(1);
        }}
        pageSizeOptions={[10, 20, 50]}
        emptyMessage={`No schedules match the selected filters for ${dateFormatted}.`}
        columns={[
          {
            id: 'time',
            header: 'TIME',
            sortable: true,
            render: (visit) => (
              <div className="flex items-center gap-1.5 font-semibold text-navy-950">
                <IconClock width={14} height={14} className="text-slate-400" />
                <span>{formatTime(visit.scheduledTime)}</span>
              </div>
            ),
          },
          {
            id: 'customer',
            header: 'CUSTOMER',
            className: 'font-semibold text-navy-950',
            render: (visit) => visit.customerName,
          },
          {
            id: 'car',
            header: 'CAR',
            render: (visit) => (
              <>
                <span className="font-semibold text-navy-950">{visit.carModel}</span>{' '}
                <span className="text-slate-400">•</span>{' '}
                <span className="font-mono text-[11px] text-slate-600">{visit.carPlate}</span>
              </>
            ),
          },
          {
            id: 'area',
            header: 'AREA',
            render: (visit) => {
              const areaBadge =
                areaBadgeColors[visit.areaName] ||
                'bg-slate-50 text-slate-700 border-slate-200';
              return (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${areaBadge}`}
                >
                  <IconMapPin width={11} height={11} />
                  {visit.areaName}
                </span>
              );
            },
          },
          {
            id: 'washBoy',
            header: 'WASH BOY',
            render: (visit) =>
              visit.status === 'DONE' || visit.status === 'MISSED' ? (
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
                    .map((s) => ({
                      id: s.id,
                      name: s.name,
                      count: staffLoadMap.get(s.id) ?? 0,
                      isOnLeave: s.isOnLeave,
                    }))}
                />

              ),
          },
          {
            id: 'status',
            header: 'STATUS',
            render: (visit) =>
              visit.status === 'DONE' ? (
                <div className="flex flex-col gap-0.5">
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 w-fit">
                    <IconCheckCircle width={12} height={12} />
                    Done {visit.completedAt ? formatClock(visit.completedAt) : ''}
                  </span>
                  {(() => {
                    const mins = washDurationMinutes({
                      startedAt: visit.startedAt ?? null,
                      completedAt: visit.completedAt ?? null,
                    });
                    return mins !== null ? (
                      <span className="text-[10.5px] font-semibold text-slate-500">
                        ⏱ {formatDurationMinutes(mins)}
                      </span>
                    ) : null;
                  })()}
                </div>
              ) : visit.status === 'MISSED' ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                  {visit.missReason
                    ? MISS_REASON_LABEL[visit.missReason as keyof typeof MISS_REASON_LABEL] || visit.missReason
                    : 'Not done'}
                </span>
              ) : visit.status === 'IN_PROGRESS' ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-sky-100 bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700">
                  In progress
                </span>
              ) : visit.staffId ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                  Pending
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-100 bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700">
                  No staff
                </span>
              ),
          },
          {
            id: 'rate',
            header: 'RATE THIS WASH',
            render: (visit) =>
              visit.status === 'DONE' ? (
                <button
                  type="button"
                  onClick={() => openRatingModal(visit)}
                  className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
                >
                  {visit.managerRating ? (
                    <span className="text-amber-500">{'★'.repeat(visit.managerRating)}</span>
                  ) : (
                    <span>Rate</span>
                  )}
                </button>
              ) : (
                <span className="text-slate-300">—</span>
              ),
          },
        ]}
      />

      {/* Wash inspection / rating modal */}
      {ratingVisit ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRatingVisit(null);
          }}
        >
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Wash Inspection · {ratingVisit.carPlate}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {ratingVisit.customerName} · {ratingVisit.carModel} ·{' '}
                  {ratingVisit.staffName || 'Unassigned'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRatingVisit(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 font-semibold transition-colors cursor-pointer"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-slate-500">
                  Before
                </p>
                {ratingVisit.beforePhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ratingVisit.beforePhotoUrl}
                    alt="Before wash"
                    className="aspect-4/3 w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex aspect-4/3 w-full items-center justify-center rounded-lg border border-dashed border-slate-300 text-[11px] text-slate-400">
                    No photo
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-slate-500">
                  After
                </p>
                {ratingVisit.afterPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ratingVisit.afterPhotoUrl}
                    alt="After wash"
                    className="aspect-4/3 w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex aspect-4/3 w-full items-center justify-center rounded-lg border border-dashed border-slate-300 text-[11px] text-slate-400">
                    No photo
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3 text-xs text-slate-500">
              {(() => {
                const mins = washDurationMinutes({
                  startedAt: ratingVisit.startedAt ?? null,
                  completedAt: ratingVisit.completedAt ?? null,
                });
                return mins !== null ? `Took ${formatDurationMinutes(mins)}` : null;
              })()}
              {ratingVisit.rating ? ` · Customer rated: ${ratingVisit.rating} ★` : ''}
            </div>

            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-blue-800">
                Your rating of this wash
              </p>
              <div className="mb-2.5 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRatingDraft(n)}
                    className={`text-2xl leading-none transition-colors cursor-pointer ${
                      n <= ratingDraft ? 'text-amber-500' : 'text-slate-300 hover:text-amber-300'
                    }`}
                    aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="Optional note — what was good or wrong about this wash"
                rows={2}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
              />
              <div className="mt-2.5 flex justify-end">
                <button
                  type="button"
                  disabled={ratingDraft < 1 || savingRating}
                  onClick={saveWashRating}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {savingRating ? 'Saving…' : 'Save Rating'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default ScheduleClient;