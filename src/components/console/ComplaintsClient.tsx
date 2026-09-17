'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconArrowUp,
  IconCalendar,
  IconChat,
  IconCheck,
  IconClock,
  IconFolder,
  IconGrid,
  IconList,
  IconMapPin,
  IconTrendingUp,
  IconUser,
} from '@/components/shell/icons';
import { useToast } from '@/components/ui/ToastProvider';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { Button } from '@/components/ui/primitives';
import type { Complaint, Area, Staff, Customer, Region, Visit } from '@/lib/data/types';
import { COMPLAINT_TYPE_LABEL } from '@/lib/util/labels';
import { formatDateFull, relativeDays } from '@/lib/util/format';
import Image from 'next/image';

const QUICK_SUGGESTIONS = [
  'Free re-wash scheduled',
  'Rescheduled',
  'Receipt re-sent',
  'Slot changed',
  'Spoken to the wash boy',
];

interface ComplaintsClientProps {
  complaints: Complaint[];
  areas: Area[];
  regions?: Region[];
  staff: Staff[];
  customers: Customer[];
  visits: Visit[];
  canEscalate: boolean;
}

export function ComplaintsClient({
  complaints: initialComplaints,
  areas: initialAreas,
  regions: initialRegions,
  staff: initialStaff,
  customers: initialCustomers,
  visits: initialVisits,
  canEscalate,
}: ComplaintsClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const showConfirm = useConfirm();

  // Filters & Pagination State
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'ESCALATED' | 'RESOLVED'>('ALL');
  const [timeFilter, setTimeFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');
  const [selectedRegionId, setSelectedRegionId] = useState<string>('');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  const [sortBy, setSortBy] = useState<'LATEST' | 'OLDEST'>('LATEST');
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');

  // Preview Visit state
  const [previewVisit, setPreviewVisit] = useState<Visit | null>(null);

  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(6);

  // Data State
  const [complaints, setComplaints] = useState<Complaint[]>(initialComplaints.slice(0, 6));
  const [areas, setAreas] = useState<Area[]>(initialAreas);
  const [regions, setRegions] = useState<Region[]>(initialRegions || []);
  const [staff, setStaff] = useState<Staff[]>(initialStaff);
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [visits, setVisits] = useState<Visit[]>(initialVisits);

  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 6,
    totalItems: initialComplaints.length,
    totalPages: Math.max(1, Math.ceil(initialComplaints.length / 6)),
    hasNext: initialComplaints.length > 6,
    hasPrev: false,
  });

  const [counts, setCounts] = useState({
    all: initialComplaints.length,
    open: initialComplaints.filter((c) => c.status === 'OPEN').length,
    escalated: initialComplaints.filter((c) => c.status === 'ESCALATED').length,
    resolved: initialComplaints.filter((c) => c.status === 'RESOLVED').length,
    allTimeTotal: initialComplaints.length,
  });

  const [kpis, setKpis] = useState({
    avgResolutionTime: '2.4d',
    oldestOpen: null as { createdAt: string; id: string } | null,
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const isFirstRender = useRef(true);

  // Filtered areas based on selected region
  const filteredAreas = useMemo(() => {
    if (!selectedRegionId) return areas;
    return areas.filter((a) => a.regionId === selectedRegionId);
  }, [areas, selectedRegionId]);

  // Expanded reply state for each card
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<{ [id: string]: string }>({});
  const [grantFreeWash, setGrantFreeWash] = useState<{ [id: string]: boolean }>({});
  const [pendingAction, setPendingAction] = useState<{ [id: string]: 'resolve' | 'escalate' | null }>({});

  // Fetch Complaints from Backend API
  const fetchComplaints = useCallback(
    async (targetPage = page, targetPageSize = pageSize) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          pageSize: String(targetPageSize),
          status: statusFilter,
          time: timeFilter,
          sortBy,
          ...(selectedRegionId ? { regionId: selectedRegionId } : {}),
          ...(selectedAreaId ? { areaId: selectedAreaId } : {}),
        });

        const res = await fetch(`/api/ops/complaints?${params.toString()}`);
        if (!res.ok) {
          throw new Error('Failed to load complaints');
        }

        const data = await res.json();
        if (data.ok) {
          setComplaints(data.complaints || []);
          if (data.customers) setCustomers(data.customers);
          if (data.staff) setStaff(data.staff);
          if (data.areas) setAreas(data.areas);
          if (data.regions) setRegions(data.regions);
          if (data.visits) setVisits(data.visits);
          if (data.pagination) setPagination(data.pagination);
          if (data.counts) setCounts(data.counts);
          if (data.kpis) setKpis(data.kpis);
        }
      } catch (err) {
        console.error('Error fetching complaints:', err);
        toast.error('Could not refresh complaints data.');
      } finally {
        setIsLoading(false);
      }
    },
    [page, pageSize, statusFilter, timeFilter, sortBy, selectedRegionId, selectedAreaId, toast],
  );

  // Trigger query on filter or pagination changes
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      fetchComplaints(1, pageSize);
      return;
    }
    fetchComplaints(page, pageSize);
  }, [page, pageSize, statusFilter, timeFilter, sortBy, selectedRegionId, selectedAreaId, fetchComplaints]);

  // Handle filter changes (resets page to 1)
  const handleStatusChange = (newStatus: 'ALL' | 'OPEN' | 'ESCALATED' | 'RESOLVED') => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  const handleTimeChange = (newTime: 'ALL' | 'TODAY' | 'WEEK' | 'MONTH') => {
    setTimeFilter(newTime);
    setPage(1);
  };

  const handleSortChange = (newSort: 'LATEST' | 'OLDEST') => {
    setSortBy(newSort);
    setPage(1);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1);
  };

  const areaById = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);
  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  const timeFilterLabels: Record<'ALL' | 'TODAY' | 'WEEK' | 'MONTH', string> = {
    ALL: 'All Time',
    TODAY: 'Today',
    WEEK: 'This Week',
    MONTH: 'This Month',
  };

  async function handleSend(complaintId: string, action: 'resolve' | 'escalate') {
    const resolution = replyText[complaintId] || '';
    if (action === 'resolve' && resolution.trim().length < 3) {
      toast.error('Please enter a resolution note before closing.');
      return;
    }

    if (action === 'escalate') {
      const ok = await showConfirm({
        title: 'Escalate to Owner',
        message: 'Are you sure you want to escalate this complaint to the owner?',
        tone: 'danger',
        confirmText: 'Escalate',
      });
      if (!ok) return;
    }

    setPendingAction((prev) => ({ ...prev, [complaintId]: action }));
    try {
      const res = await fetch('/api/ops/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          complaintId,
          action,
          resolution,
          ...(action === 'resolve' && grantFreeWash[complaintId]
            ? { grantFreeWash: true }
            : {}),
        }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? 'Could not complete request.');
        return;
      }
      toast.success(
        data.message ??
          (action === 'resolve'
            ? 'Closed and the customer has been told.'
            : 'Escalated to owner.'),
      );
      setReplyingId(null);
      setReplyText((prev) => ({ ...prev, [complaintId]: '' }));
      setGrantFreeWash((prev) => ({ ...prev, [complaintId]: false }));
      fetchComplaints(page, pageSize);
      router.refresh();
    } catch {
      toast.error('No connection. Try again.');
    } finally {
      setPendingAction((prev) => ({ ...prev, [complaintId]: null }));
    }
  }

  // Calculate pagination ranges
  const startItem = pagination.totalItems === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const endItem = Math.min(pagination.page * pagination.pageSize, pagination.totalItems);

  return (
    <div className="space-y-5">
      {/* 5 KPI Metric Cards Header */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* Open */}
        <div
          onClick={() => handleStatusChange(statusFilter === 'OPEN' ? 'ALL' : 'OPEN')}
          className={`flex cursor-pointer items-center gap-3.5 rounded-xl border bg-white p-4 shadow-sm transition-all hover:shadow-md ${
            statusFilter === 'OPEN' ? 'border-navy-900 ring-2 ring-navy-900/10' : 'border-line-soft'
          }`}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <IconFolder width={22} height={22} strokeWidth={2} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-mute">
              OPEN
            </div>
            <div className="text-2xl font-bold text-navy-950">
              {counts.open}
            </div>
            <div className="text-[11px] font-medium text-ink-faint">
              Active complaints
            </div>
          </div>
        </div>

        {/* Escalated */}
        <div
          onClick={() => handleStatusChange(statusFilter === 'ESCALATED' ? 'ALL' : 'ESCALATED')}
          className={`flex cursor-pointer items-center gap-3.5 rounded-xl border bg-white p-4 shadow-sm transition-all hover:shadow-md ${
            statusFilter === 'ESCALATED' ? 'border-navy-900 ring-2 ring-navy-900/10' : 'border-line-soft'
          }`}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <IconTrendingUp width={22} height={22} strokeWidth={2} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-mute">
              ESCALATED
            </div>
            <div className="text-2xl font-bold text-amber-600">
              {counts.escalated}
            </div>
            <div className="text-[11px] font-medium text-ink-faint">
              Needs attention
            </div>
          </div>
        </div>

        {/* Resolved */}
        <div
          onClick={() => handleStatusChange(statusFilter === 'RESOLVED' ? 'ALL' : 'RESOLVED')}
          className={`flex cursor-pointer items-center gap-3.5 rounded-xl border bg-white p-4 shadow-sm transition-all hover:shadow-md ${
            statusFilter === 'RESOLVED' ? 'border-navy-900 ring-2 ring-navy-900/10' : 'border-line-soft'
          }`}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <IconCheck width={22} height={22} strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-mute">
              RESOLVED
            </div>
            <div className="text-2xl font-bold text-emerald-600">
              {counts.resolved}
            </div>
            <div className="text-[11px] font-medium text-ink-faint">
              Completed
            </div>
          </div>
        </div>

        {/* Avg Resolution */}
        <div className="flex items-center gap-3.5 rounded-xl border border-line-soft bg-white p-4 shadow-sm">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
            <IconClock width={22} height={22} strokeWidth={2} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-mute">
              AVG RESOLUTION
            </div>
            <div className="text-2xl font-bold text-navy-950">
              {kpis.avgResolutionTime}
            </div>
            <div className="text-[11px] font-medium text-ink-faint">
              Average time
            </div>
          </div>
        </div>

        {/* Oldest Open */}
        <div className="col-span-2 flex items-center gap-3.5 rounded-xl border border-line-soft bg-white p-4 shadow-sm sm:col-span-1">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <IconCalendar width={22} height={22} strokeWidth={2} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-mute">
              OLDEST OPEN
            </div>
            <div className="text-xl font-bold text-rose-600 sm:text-2xl">
              {kpis.oldestOpen ? relativeDays(kpis.oldestOpen.createdAt) : '—'}
            </div>
            <div className="text-[11px] font-medium text-ink-faint">
              {kpis.oldestOpen ? formatDateFull(kpis.oldestOpen.createdAt) : 'No open complaints'}
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Toolbar Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-soft bg-white p-3 shadow-sm">
        {/* Left: Status & Time Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="flex items-center rounded-lg bg-surface-muted p-1">
            <button
              type="button"
              onClick={() => handleStatusChange('ALL')}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-navy-900 text-white shadow-sm'
                  : 'text-ink-mute hover:text-navy-900'
              }`}
            >
              All ({counts.all})
            </button>
            <button
              type="button"
              onClick={() => handleStatusChange('OPEN')}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                statusFilter === 'OPEN'
                  ? 'bg-navy-900 text-white shadow-sm'
                  : 'text-ink-mute hover:text-navy-900'
              }`}
            >
              Open ({counts.open})
            </button>
            <button
              type="button"
              onClick={() => handleStatusChange('ESCALATED')}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                statusFilter === 'ESCALATED'
                  ? 'bg-navy-900 text-white shadow-sm'
                  : 'text-ink-mute hover:text-navy-900'
              }`}
            >
              Escalated ({counts.escalated})
            </button>
            <button
              type="button"
              onClick={() => handleStatusChange('RESOLVED')}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                statusFilter === 'RESOLVED'
                  ? 'bg-navy-900 text-white shadow-sm'
                  : 'text-ink-mute hover:text-navy-900'
              }`}
            >
              Resolved ({counts.resolved})
            </button>
          </div>

          {/* Time Filter Group */}
          <div className="flex items-center rounded-lg bg-surface-muted p-1">
            {(
              [
                ['ALL', 'All Time'],
                ['TODAY', 'Today'],
                ['WEEK', 'This Week'],
                ['MONTH', 'This Month'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleTimeChange(key)}
                className={`rounded-md px-3 py-1.5 text-xs font-bold transition-all ${
                  timeFilter === key
                    ? 'bg-navy-900 text-white shadow-sm'
                    : 'text-ink-mute hover:text-navy-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Region Filter */}
          {regions.length > 0 ? (
            <select
              value={selectedRegionId}
              onChange={(e) => {
                setSelectedRegionId(e.target.value);
                setSelectedAreaId('');
                setPage(1);
              }}
              aria-label="Filter by region"
              className="rounded-lg border border-line-strong bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-sm hover:border-navy-400 focus:border-navy-600 focus:outline-none"
            >
              <option value="">All Regions ({regions.length})</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          ) : null}

          {/* Area Filter */}
          <select
            value={selectedAreaId}
            onChange={(e) => {
              setSelectedAreaId(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by area"
            className="rounded-lg border border-line-strong bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-sm hover:border-navy-400 focus:border-navy-600 focus:outline-none"
          >
            <option value="">All Areas ({filteredAreas.length})</option>
            {filteredAreas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* Right: Sort & View Toggle */}
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value as 'LATEST' | 'OLDEST')}
            aria-label="Sort complaints"
            className="rounded-lg border border-line-strong bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-sm hover:border-navy-400 focus:border-navy-600 focus:outline-none"
          >
            <option value="LATEST">Latest raised</option>
            <option value="OLDEST">Oldest raised</option>
          </select>

          <div className="flex items-center rounded-lg border border-line-soft bg-surface-muted p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('GRID')}
              title="Grid view"
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-all ${
                viewMode === 'GRID'
                  ? 'bg-white font-bold text-navy-900 shadow-sm'
                  : 'text-ink-mute hover:text-navy-900'
              }`}
            >
              <IconGrid width={15} height={15} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('LIST')}
              title="List view"
              className={`flex h-7 w-7 items-center justify-center rounded-md transition-all ${
                viewMode === 'LIST'
                  ? 'bg-white font-bold text-navy-900 shadow-sm'
                  : 'text-ink-mute hover:text-navy-900'
              }`}
            >
              <IconList width={15} height={15} strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </div>

      {/* Complaints Cards Display */}
      {complaints.length === 0 && !isLoading ? (
        <div className="rounded-2xl border border-line-soft bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-navy-50 text-navy-600">
            <IconCheck width={28} height={28} strokeWidth={2.5} />
          </div>
          <h3 className="mt-4 text-base font-bold text-navy-950">
            No {statusFilter !== 'ALL' ? statusFilter.toLowerCase() : ''} complaints found in {timeFilterLabels[timeFilter]}
          </h3>
          <p className="mt-1 text-sm text-ink-mute">
            {timeFilter !== 'ALL' && (
              statusFilter === 'ESCALATED' && counts.escalated > 0
                ? `There is ${counts.escalated} escalated complaint recorded in this period.`
                : statusFilter === 'OPEN' && counts.open > 0
                  ? `There are ${counts.open} open complaints recorded in this period.`
                  : statusFilter === 'RESOLVED' && counts.resolved > 0
                    ? `There are ${counts.resolved} resolved complaints recorded in this period.`
                    : counts.allTimeTotal > 0
                      ? `There are ${counts.allTimeTotal} total complaints in All Time.`
                      : 'No complaints match your selection.'
            )}
          </p>
          {timeFilter !== 'ALL' || statusFilter !== 'ALL' ? (
            <div className="mt-4 flex justify-center gap-2">
              {timeFilter !== 'ALL' ? (
                <button
                  type="button"
                  onClick={() => handleTimeChange('ALL')}
                  className="rounded-lg bg-navy-900 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-navy-800"
                >
                  View in All Time
                </button>
              ) : null}
              {statusFilter !== 'ALL' ? (
                <button
                  type="button"
                  onClick={() => handleStatusChange('ALL')}
                  className="rounded-lg border border-line-strong bg-white px-4 py-2 text-xs font-bold text-navy-900 shadow-sm transition-colors hover:bg-surface-muted"
                >
                  Show all statuses
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div
          className={`transition-opacity duration-200 ${
            isLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'
          } ${
            viewMode === 'GRID'
              ? 'grid gap-4 lg:grid-cols-2'
              : 'space-y-4'
          }`}
        >
          {complaints.map((complaint) => {
            const customer = customerById.get(complaint.customerId);
            const area = areaById.get(complaint.areaId);
            const washBoy = complaint.staffId ? staffById.get(complaint.staffId) : null;
            const isReplying = replyingId === complaint.id;
            const isEscalated = complaint.status === 'ESCALATED';
            const isResolved = complaint.status === 'RESOLVED';

            // Managers (canEscalate=true) cannot resolve escalated complaints, only owner (canEscalate=false) can.
            const isManagerLocked = isEscalated && canEscalate;

            const borderAccent =
              isEscalated
                ? 'border-l-4 border-l-rose-500'
                : isResolved
                  ? 'border-l-4 border-l-emerald-500'
                  : 'border-l-4 border-l-amber-400';

            return (
              <div
                key={complaint.id}
                className={`flex flex-col justify-between rounded-xl border border-line-soft bg-white p-5 shadow-sm transition-all hover:shadow-md ${borderAccent}`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-[15px] font-bold text-navy-950">
                      {COMPLAINT_TYPE_LABEL[complaint.type] || complaint.type}
                    </h3>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        isEscalated
                          ? 'bg-rose-100 text-rose-800'
                          : isResolved
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {isEscalated
                        ? 'Escalated'
                        : isResolved
                          ? 'Resolved'
                          : 'Open'}
                    </span>
                  </div>

                  {/* Metadata Grid */}
                  <div className="mt-3.5 space-y-2 text-sm">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-2 text-ink-mute">
                        <IconUser width={15} height={15} className="text-slate-400" />
                        Customer
                      </span>
                      <span className="font-bold text-navy-950">
                        {customer?.name ?? '—'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-2 text-ink-mute">
                        <IconMapPin width={15} height={15} className="text-slate-400" />
                        Area
                      </span>
                      <span className="font-semibold text-slate-800">
                        {area?.name ?? '—'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-2 text-ink-mute">
                        <IconUser width={15} height={15} className="text-slate-400" />
                        Wash boy
                      </span>
                      <span className="font-semibold text-slate-800">
                        {washBoy?.name ?? '—'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-2 text-ink-mute">
                        <IconCalendar width={15} height={15} className="text-slate-400" />
                        Raised
                      </span>
                      <span className="text-xs font-semibold text-slate-700">
                        {formatDateFull(complaint.createdAt)} ·{' '}
                        <span className="font-normal text-ink-mute">
                          {relativeDays(complaint.createdAt)}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Customer Quote Bubble */}
                  <div className="my-3.5 rounded-xl bg-surface-muted p-3.5 text-sm italic text-slate-700">
                    &ldquo;{complaint.body}&rdquo;
                  </div>

                  {complaint.visitId && visits.find(v => v.id === complaint.visitId) && (
                    <button
                      type="button"
                      onClick={() => setPreviewVisit(visits.find(v => v.id === complaint.visitId)!)}
                      className="mb-3 inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-colors shadow-2xs cursor-pointer w-full justify-center"
                    >
                      <span>View Wash Details & Photos</span>
                    </button>
                  )}

                  {/* Manager Escalation Info Banner */}
                  {isManagerLocked ? (
                    <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
                      <IconTrendingUp width={17} height={17} className="mt-0.5 shrink-0 text-amber-600" />
                      <div>
                        <p className="font-bold text-amber-950">Escalated to Owner</p>
                        <p className="mt-0.5 text-amber-800">
                          This complaint was escalated to the business owner for decision and resolution.
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {/* Owner Escalation Info Banner */}
                  {isEscalated && !canEscalate ? (
                    <div className="mb-3 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-900">
                      <IconTrendingUp width={17} height={17} className="mt-0.5 shrink-0 text-rose-600" />
                      <div>
                        <p className="font-bold text-rose-950">Escalated by Manager</p>
                        <p className="mt-0.5 text-rose-800">
                          Requires your owner decision and customer resolution.
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {/* Quick Resolution Suggestion Chips */}
                  {!isResolved && !isManagerLocked ? (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {QUICK_SUGGESTIONS.map((text) => (
                        <button
                          key={text}
                          type="button"
                          onClick={() => {
                            setReplyingId(complaint.id);
                            setReplyText((prev) => ({
                              ...prev,
                              [complaint.id]: text,
                            }));
                            if (text === 'Free re-wash scheduled') {
                              setGrantFreeWash((prev) => ({ ...prev, [complaint.id]: true }));
                            }
                          }}
                          className="rounded-full border border-line-strong bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:border-navy-400 hover:bg-navy-50 hover:text-navy-900"
                        >
                          {text}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {/* Resolution Notes for Resolved complaints */}
                  {isResolved && complaint.resolution ? (
                    <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5 text-xs text-emerald-900">
                      <span className="font-bold uppercase tracking-wider text-emerald-800">
                        Resolution:
                      </span>{' '}
                      {complaint.resolution}
                    </div>
                  ) : null}

                  {/* Inline Reply Box */}
                  {isReplying && !isResolved && !isManagerLocked ? (
                    <div className="mb-3 space-y-2 rounded-xl border border-navy-200 bg-navy-50/40 p-3">
                      <label className="block text-xs font-bold text-navy-950">
                        Resolution note for customer:
                      </label>
                      <textarea
                        rows={2}
                        value={replyText[complaint.id] || ''}
                        onChange={(e) =>
                          setReplyText((prev) => ({
                            ...prev,
                            [complaint.id]: e.target.value,
                          }))
                        }
                        placeholder="What action did you take? This will be communicated to the customer."
                        className="w-full rounded-lg border border-line-strong bg-white p-2.5 text-sm text-slate-800 focus:border-navy-600 focus:outline-none"
                      />
                      <label className="flex items-center gap-2 text-xs font-semibold text-navy-900">
                        <input
                          type="checkbox"
                          checked={Boolean(grantFreeWash[complaint.id])}
                          onChange={(e) =>
                            setGrantFreeWash((prev) => ({
                              ...prev,
                              [complaint.id]: e.target.checked,
                            }))
                          }
                        />
                        Also schedule a free compensatory wash for the customer
                      </label>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setReplyingId(null)}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          disabled={
                            Boolean(pendingAction[complaint.id]) ||
                            (replyText[complaint.id] || '').trim().length < 3
                          }
                          onClick={() => handleSend(complaint.id, 'resolve')}
                        >
                          {pendingAction[complaint.id] === 'resolve' ? 'Closing…' : 'Submit & Close'}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Bottom Card Actions */}
                {!isResolved ? (
                  <div className="mt-2 flex items-center gap-2 pt-2">
                    {!isReplying && !isManagerLocked ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex items-center gap-1.5"
                        onClick={() => setReplyingId(complaint.id)}
                      >
                        <IconChat width={14} height={14} />
                        Reply & close
                      </Button>
                    ) : null}

                    {canEscalate && !isEscalated ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={Boolean(pendingAction[complaint.id])}
                        className="flex items-center gap-1.5"
                        onClick={() => handleSend(complaint.id, 'escalate')}
                      >
                        <IconArrowUp width={14} height={14} />
                        {pendingAction[complaint.id] === 'escalate' ? 'Sending…' : 'Escalate to owner'}
                      </Button>
                    ) : isEscalated && canEscalate ? (
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">
                        ⏳ Awaiting Owner Action
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-2 text-xs font-semibold text-emerald-700">
                    ✓ Closed on {formatDateFull(complaint.resolvedAt ?? complaint.createdAt)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Backend Pagination Bar */}
      {pagination.totalItems > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line-soft bg-white px-4 py-3 shadow-sm">
          {/* Left: Summary & Per Page */}
          <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
            <span>
              Showing <span className="font-bold text-navy-950">{startItem}</span> to{' '}
              <span className="font-bold text-navy-950">{endItem}</span> of{' '}
              <span className="font-bold text-navy-950">{pagination.totalItems}</span> complaints
            </span>

            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
              <label htmlFor="pageSizeSelect" className="text-slate-500 font-medium">Per page:</label>
              <select
                id="pageSizeSelect"
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="rounded-md border border-line-strong bg-white px-2 py-1 text-xs font-bold text-navy-950 shadow-sm focus:border-navy-600 focus:outline-none"
              >
                <option value={6}>6</option>
                <option value={12}>12</option>
                <option value={24}>24</option>
                <option value={48}>48</option>
              </select>
            </div>
          </div>

          {/* Right: Page Navigation Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={!pagination.hasPrev || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex items-center gap-1 rounded-lg border border-line-strong bg-white px-3 py-1.5 text-xs font-bold text-navy-950 shadow-sm transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Previous
            </button>

            {/* Page number buttons */}
            <div className="flex items-center gap-1">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                .filter((p) => {
                  return (
                    p === 1 ||
                    p === pagination.totalPages ||
                    Math.abs(p - pagination.page) <= 1
                  );
                })
                .map((p, idx, arr) => {
                  const prevPage = arr[idx - 1];
                  const showEllipsis = prevPage && p - prevPage > 1;

                  return (
                    <div key={p} className="flex items-center">
                      {showEllipsis && (
                        <span className="px-1 text-xs font-bold text-slate-400">…</span>
                      )}
                      <button
                        type="button"
                        onClick={() => setPage(p)}
                        disabled={isLoading}
                        className={`h-8 min-w-[32px] rounded-lg px-2 text-xs font-semibold transition-colors ${
                          pagination.page === p
                            ? 'bg-navy-900 text-white shadow-sm'
                            : 'border border-line-soft bg-white text-slate-700 hover:bg-surface-muted'
                        }`}
                      >
                        {p}
                      </button>
                    </div>
                  );
                })}
            </div>

            <button
              type="button"
              disabled={!pagination.hasNext || isLoading}
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              className="flex items-center gap-1 rounded-lg border border-line-strong bg-white px-3 py-1.5 text-xs font-bold text-navy-950 shadow-sm transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Sleek Floating Bottom Loader */}
      {isLoading && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300">
          <div className="flex items-center gap-3 rounded-full border border-navy-800 bg-navy-950/95 px-5 py-2.5 text-xs font-semibold text-white shadow-2xl backdrop-blur-md ring-1 ring-white/10">
            <div className="relative flex h-4 w-4 items-center justify-center">
                      <span className="absolute h-full w-full animate-ping rounded-full bg-sky-400 opacity-40" />
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            </div>
            <span className="tracking-wide">Updating complaints from database…</span>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
        </div>
      )}

      {/* REUSABLE PHOTO PREVIEW MODAL */}
      {previewVisit && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewVisit(null);
          }}
        >
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <IconMapPin width={18} height={18} className="text-blue-600" />
                  <span>Wash Inspection</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formatDateFull(previewVisit.scheduledDate)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewVisit(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 font-semibold transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Before Photo Card */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 flex flex-col items-center">
                <div className="flex items-center justify-between w-full mb-2.5">
                  <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                    📷 Before Wash
                  </span>
                  {previewVisit.beforePhotoBytes ? (
                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10.5px] font-semibold text-blue-700 border border-blue-200">
                      {(previewVisit.beforePhotoBytes / 1024).toFixed(1)} KB
                    </span>
                  ) : null}
                </div>
                {previewVisit.beforePhotoUrl ? (
                  <div className="relative aspect-4/3 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-900">
                    <Image
                      src={previewVisit.beforePhotoUrl}
                      alt="Before Wash"
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-4/3 w-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-xs font-medium text-slate-400">
                    No before photo recorded
                  </div>
                )}
              </div>

              {/* After Photo Card */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 flex flex-col items-center">
                <div className="flex items-center justify-between w-full mb-2.5">
                  <span className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                    ✨ After Wash
                  </span>
                  {previewVisit.afterPhotoBytes ? (
                    <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 border border-emerald-200">
                      {(previewVisit.afterPhotoBytes / 1024).toFixed(1)} KB
                    </span>
                  ) : null}
                </div>
                {previewVisit.afterPhotoUrl ? (
                  <div className="relative aspect-4/3 w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-900">
                    <Image
                      src={previewVisit.afterPhotoUrl}
                      alt="After Wash"
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-4/3 w-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-xs font-medium text-slate-400">
                    No after photo recorded
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              <span className="text-xs font-bold uppercase text-slate-500 mr-2 self-center">Services Done:</span>
              {Array.isArray(previewVisit.servicesDone) && previewVisit.servicesDone.length > 0 ? (
                previewVisit.servicesDone.map((s) => (
                  <span key={s} className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
                    ✓ {s}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-500 italic self-center">No checklist recorded</span>
              )}
            </div>

            {/* Modal Footer */}
            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
              <div>
                Status:{' '}
                <span className="font-bold text-slate-800">
                  {previewVisit.status.replace(/_/g, ' ')}
                </span>
                {previewVisit.rating ? ` · Customer rated: ${previewVisit.rating} ★` : ''}
              </div>
              <button
                type="button"
                onClick={() => setPreviewVisit(null)}
                className="rounded-lg bg-[#0F2347] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#163363] transition-colors cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
