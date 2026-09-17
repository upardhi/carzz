'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import clsx from 'clsx';
import {
  IconCalendar,
  IconCar,
  IconCheckCircle,
  IconClock,
  IconDroplet,
  IconSearch,
  IconSliders,
  IconStar,
  IconUser,
  IconUsers,
  IconXCircle,
} from '@/components/shell/icons';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { toast } from '@/components/ui/ToastProvider';
import type { Area, Region, Staff } from '@/lib/data/types';
import { useDebounce } from '@/lib/util/debounce';
import { washDurationMinutes, formatDurationMinutes } from '@/lib/util/washTiming';

export interface WashItemData {
  id: string;
  scheduledDate: string;
  scheduledTime: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'MISSED' | 'CANCELLED';
  completedAt?: string | null;
  startedAt?: string | null;
  onTime?: boolean;
  rating?: number | null;
  ratingComment?: string | null;
  managerRating?: number | null;
  managerRatingComment?: string | null;
  missReason?: string | null;
  missNote?: string | null;
  beforePhotoUrl?: string | null;
  afterPhotoUrl?: string | null;
  beforePhotoBytes?: number | null;
  afterPhotoBytes?: number | null;
  servicesDone?: string[];
  customer: {
    id: string;
    name: string;
    phone: string;
    address?: string;
  };
  car: {
    id: string;
    plate: string;
    model: string;
    color?: string;
    parkingSpot?: string;
  };
  staff?: {
    id: string;
    name: string;
    phone: string;
  } | null;
}

export interface AreaCustomerItemData {
  id: string;
  name: string;
  phone: string;
  altPhone?: string | null;
  address: string;
  landmark?: string | null;
  status: 'ACTIVE' | 'HOLD' | 'INACTIVE';
  source: string;
  joinedOn: string;
  cars: {
    id: string;
    make: string;
    model: string;
    plate: string;
    packageName: string;
    staffName?: string | null;
  }[];
}

interface AreaDetailClientProps {
  area: Area;
  region?: Region | null;
  managers?: Staff[];
  basePath: string; // '/admin/areas' or '/area/areas'
  initialTab?: 'today' | 'washes' | 'upcoming' | 'customers';
  stats: {
    totalCars: number;
    carsAssigned?: number;
    carsUnassigned?: number;
    totalCustomers: number;
    totalStaff: number;
    todayTotal: number;
    todayDone: number;
    todayInProgress?: number;
    todayPending?: number;
    todayRemaining?: number;
    todayMissed: number;
    todayAssigned?: number;
    todayUnassigned?: number;
    todayRevenue?: number;
    todayTargetRevenue?: number;
    todayCost?: number;
    todayProfit?: number;
    todayLoss?: number;
    todayMargin?: number;
    totalWashes: number;
    allTimeMissed?: number;
    upcomingTotal?: number;
    upcomingAssigned?: number;
    upcomingUnassigned?: number;
    averageRating: number;
  };
  initialTodayVisits: WashItemData[];
  initialStaffList: { id: string; name: string }[];
  initialCustomers?: AreaCustomerItemData[];
}

const AVATAR_PALETTES = [
  { bg: 'bg-[#EFF6FF]', text: 'text-[#2563EB]' },
  { bg: 'bg-[#ECFDF5]', text: 'text-[#059669]' },
  { bg: 'bg-[#FFFBEB]', text: 'text-[#D97706]' },
  { bg: 'bg-[#F5F3FF]', text: 'text-[#7C3AED]' },
  { bg: 'bg-[#F0FDF4]', text: 'text-[#16A34A]' },
  { bg: 'bg-[#FFF1F2]', text: 'text-[#E11D48]' },
  { bg: 'bg-[#ECFEFF]', text: 'text-[#0891B2]' },
  { bg: 'bg-[#EEF2FF]', text: 'text-[#4F46E5]' },
];

function getAvatarPalette(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_PALETTES[Math.abs(hash) % AVATAR_PALETTES.length];
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function StatusBadge({
  status,
  onTime,
  missReason,
}: {
  status: WashItemData['status'];
  onTime?: boolean;
  missReason?: string | null;
}) {
  const config = {
    DONE: {
      bg: 'bg-[#ECFDF5]',
      text: 'text-[#059669]',
      border: 'border-[#A7F3D0]',
      label: 'Done',
    },
    MISSED: {
      bg: 'bg-[#FEF2F2]',
      text: 'text-[#DC2626]',
      border: 'border-[#FECACA]',
      label: 'Missed',
    },
    IN_PROGRESS: {
      bg: 'bg-[#FFFBEB]',
      text: 'text-[#D97706]',
      border: 'border-[#FDE68A]',
      label: 'In Progress',
    },
    PENDING: {
      bg: 'bg-[#EFF6FF]',
      text: 'text-[#2563EB]',
      border: 'border-[#BFDBFE]',
      label: 'Pending',
    },
    CANCELLED: {
      bg: 'bg-slate-100',
      text: 'text-slate-600',
      border: 'border-slate-200',
      label: 'Cancelled',
    },
  }[status] || {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-200',
    label: status,
  };

  return (
    <div className="inline-flex flex-col items-start gap-0.5">
      <span
        className={clsx(
          'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold tracking-tight',
          config.bg,
          config.text,
          config.border,
        )}
      >
        {status === 'DONE' ? <IconCheckCircle width={11} height={11} /> : null}
        {status === 'MISSED' ? <IconXCircle width={11} height={11} /> : null}
        {status === 'IN_PROGRESS' || status === 'PENDING' ? (
          <IconClock width={11} height={11} />
        ) : null}
        <span>{config.label}</span>
      </span>

      {onTime && status === 'DONE' ? (
        <span className="text-[10.5px] font-semibold text-emerald-600">✓ On-Time</span>
      ) : null}
      {missReason ? (
        <span className="text-[10px] font-semibold text-rose-600 line-clamp-1 max-w-[120px]">
          {missReason.replace(/_/g, ' ')}
        </span>
      ) : null}
    </div>
  );
}

export function AreaDetailClient({
  area,
  region,
  managers = [],
  basePath,
  initialTab = 'today',
  stats,
  initialTodayVisits,
  initialStaffList: _initialStaffList,
  initialCustomers = [],
}: AreaDetailClientProps) {
  const [activeTab, setActiveTab] = useState<'today' | 'washes' | 'upcoming' | 'customers'>(initialTab);

  // Customers Tab State
  const [customers] = useState<AreaCustomerItemData[]>(initialCustomers);
  const [customerSearch, setCustomerSearch] = useState('');
  const debouncedCustomerSearch = useDebounce(customerSearch, 200);
  const [customerStatusFilter, setCustomerStatusFilter] = useState('ALL');

  // Overall Washes Tab State
  const [washes, setWashes] = useState<WashItemData[]>([]);
  const [loadingWashes, setLoadingWashes] = useState(false);
  const [washPage, setWashPage] = useState(1);
  const [washPageSize, setWashPageSize] = useState(20);
  const [washTotalCount, setWashTotalCount] = useState(0);
  const [washSearch, setWashSearch] = useState('');
  const debouncedWashSearch = useDebounce(washSearch, 300);
  const [washStatusFilter, setWashStatusFilter] = useState('ALL');

  // Next Scheduled Tab State
  const [upcomingWashes, setUpcomingWashes] = useState<WashItemData[]>([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [upcomingTotalCount, setUpcomingTotalCount] = useState(stats.upcomingTotal || 0);

  // Today Schedule Tab State
  const [todayVisits] = useState<WashItemData[]>(initialTodayVisits);
  const [todayFilterStatus, setTodayFilterStatus] = useState('ALL');
  const [todaySearch, setTodaySearch] = useState('');
  const debouncedTodaySearch = useDebounce(todaySearch, 200);

  // Photo modal state
  const [previewVisit, setPreviewVisit] = useState<WashItemData | null>(null);

  // Manager rating of the wash currently open in the photo modal
  const [ratingDraft, setRatingDraft] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [savingRating, setSavingRating] = useState(false);

  useEffect(() => {
    setRatingDraft(previewVisit?.managerRating ?? 0);
    setRatingComment(previewVisit?.managerRatingComment ?? '');
  }, [previewVisit]);

  async function saveWashRating() {
    if (!previewVisit || ratingDraft < 1) return;
    setSavingRating(true);
    try {
      const res = await fetch('/api/ops/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rateWash',
          visitId: previewVisit.id,
          rating: ratingDraft,
          comment: ratingComment.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save the rating.');
      toast.success('Rating saved.');
      setPreviewVisit((v) =>
        v ? { ...v, managerRating: ratingDraft, managerRatingComment: ratingComment.trim() || null } : v,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the rating.');
    } finally {
      setSavingRating(false);
    }
  }

  // Reset wash page on search change
  useEffect(() => {
    setWashPage(1);
  }, [debouncedWashSearch]);

  // Fetch Overall Washes
  const fetchOverallWashes = useCallback(async () => {
    setLoadingWashes(true);
    try {
      const params = new URLSearchParams({
        page: String(washPage),
        pageSize: String(washPageSize),
        status: washStatusFilter,
        view: 'all',
      });
      if (debouncedWashSearch.trim()) {
        params.set('search', debouncedWashSearch.trim());
      }
      const res = await fetch(`/api/ops/areas/${area.id}/washes?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setWashes(data.items || []);
        setWashTotalCount(data.totalCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch overall washes:', err);
    } finally {
      setLoadingWashes(false);
    }
  }, [area.id, washPage, washPageSize, washStatusFilter, debouncedWashSearch]);

  // Fetch Upcoming Washes
  const fetchUpcomingWashes = useCallback(async () => {
    setLoadingUpcoming(true);
    try {
      const params = new URLSearchParams({
        page: String(upcomingPage),
        pageSize: '25',
        view: 'upcoming',
        status: 'ALL',
      });
      const res = await fetch(`/api/ops/areas/${area.id}/washes?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUpcomingWashes(data.items || []);
        setUpcomingTotalCount(data.totalCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch upcoming washes:', err);
    } finally {
      setLoadingUpcoming(false);
    }
  }, [area.id, upcomingPage]);

  // Effect to load data when tab changes
  useEffect(() => {
    if (activeTab === 'washes') {
      fetchOverallWashes();
    } else if (activeTab === 'upcoming') {
      fetchUpcomingWashes();
    }
  }, [activeTab, fetchOverallWashes, fetchUpcomingWashes]);

  const filteredTodayVisits = todayVisits.filter((v) => {
    if (todayFilterStatus === 'UNASSIGNED') {
      if (v.staff) return false;
    } else if (todayFilterStatus !== 'ALL' && v.status !== todayFilterStatus) {
      return false;
    }
    if (debouncedTodaySearch.trim()) {
      const q = debouncedTodaySearch.toLowerCase();
      const carPlate = v.car.plate.toLowerCase();
      const carModel = v.car.model.toLowerCase();
      const custName = v.customer.name.toLowerCase();
      const staffName = v.staff?.name?.toLowerCase() || '';
      return (
        carPlate.includes(q) ||
        carModel.includes(q) ||
        custName.includes(q) ||
        staffName.includes(q)
      );
    }
    return true;
  });

  // Table Column Definitions
  const todayColumns: DataTableColumn<WashItemData>[] = [
    {
      id: 'time',
      header: (
        <span className="inline-flex items-center gap-1.5">
          <IconClock width={13} height={13} className="text-slate-400" />
          Time Slot
        </span>
      ),
      className: 'whitespace-nowrap',
      render: (item) => (
        <span className="font-semibold text-navy-950 text-xs sm:text-sm">
          {item.scheduledTime}
        </span>
      ),
    },
    {
      id: 'car',
      header: (
        <span className="inline-flex items-center gap-1.5">
          <IconCar width={13} height={13} className="text-slate-400" />
          Car & Parking
        </span>
      ),
      render: (item) => (
        <div>
          <div className="font-bold text-slate-900 text-xs sm:text-sm">{item.car.plate}</div>
          <div className="text-[11px] font-medium text-slate-500">
            {item.car.model} {item.car.color ? `· ${item.car.color}` : ''}
            {item.car.parkingSpot ? (
              <span className="ml-1.5 inline-block text-blue-600 font-semibold">
                📍 {item.car.parkingSpot}
              </span>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      id: 'customer',
      header: (
        <span className="inline-flex items-center gap-1.5">
          <IconUsers width={13} height={13} className="text-slate-400" />
          Customer
        </span>
      ),
      render: (item) => {
        const palette = getAvatarPalette(item.customer.name);
        const initials = getInitials(item.customer.name);
        return (
          <div className="flex items-center gap-2.5">
            <div
              className={clsx(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                palette.bg,
                palette.text,
              )}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-slate-900 text-xs truncate">
                {item.customer.name}
              </div>
              <div className="text-[11px] text-slate-500 font-normal">{item.customer.phone}</div>
            </div>
          </div>
        );
      },
    },
    {
      id: 'staff',
      header: (
        <span className="inline-flex items-center gap-1.5">
          <IconUser width={13} height={13} className="text-slate-400" />
          Wash Boy
        </span>
      ),
      render: (item) => {
        if (!item.staff) {
          return (
            <span className="inline-flex items-center rounded-md bg-[#FEF2F2] px-2 py-0.5 text-xs font-semibold text-[#EF4444] border border-[#FEE2E2]">
              ⚠️ Unassigned
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EFF6FF] text-[#2563EB]">
            <IconUser width={11} height={11} className="shrink-0 text-[#2563EB]" />
            <span>{item.staff.name}</span>
          </span>
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      className: 'whitespace-nowrap',
      render: (item) => (
        <StatusBadge
          status={item.status}
          onTime={item.onTime}
          missReason={item.missReason}
        />
      ),
    },
    {
      id: 'photos',
      header: 'Photos',
      align: 'right',
      className: 'whitespace-nowrap',
      render: (item) => {
        if (item.beforePhotoUrl || item.afterPhotoUrl) {
          return (
            <button
              type="button"
              onClick={() => setPreviewVisit(item)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-colors shadow-2xs cursor-pointer"
            >
              <IconDroplet width={12} height={12} className="text-blue-600" />
              <span>View Photos</span>
            </button>
          );
        }
        return <span className="text-xs text-slate-400 font-normal">—</span>;
      },
    },
  ];

  const overallColumns: DataTableColumn<WashItemData>[] = [
    {
      id: 'date',
      header: (
        <span className="inline-flex items-center gap-1.5">
          <IconCalendar width={13} height={13} className="text-slate-400" />
          Date & Time
        </span>
      ),
      className: 'whitespace-nowrap',
      render: (item) => (
        <div>
          <div className="font-bold text-slate-900 text-xs sm:text-sm">{item.scheduledDate}</div>
          <div className="text-[11px] text-slate-500 font-medium">{item.scheduledTime}</div>
        </div>
      ),
    },
    {
      id: 'car',
      header: (
        <span className="inline-flex items-center gap-1.5">
          <IconCar width={13} height={13} className="text-slate-400" />
          Car
        </span>
      ),
      render: (item) => (
        <div>
          <div className="font-bold text-slate-900 text-xs sm:text-sm">{item.car.plate}</div>
          <div className="text-[11px] text-slate-500 font-medium">
            {item.car.model} {item.car.color ? `· ${item.car.color}` : ''}
          </div>
        </div>
      ),
    },
    {
      id: 'customer',
      header: (
        <span className="inline-flex items-center gap-1.5">
          <IconUsers width={13} height={13} className="text-slate-400" />
          Customer
        </span>
      ),
      render: (item) => {
        const palette = getAvatarPalette(item.customer.name);
        const initials = getInitials(item.customer.name);
        return (
          <div className="flex items-center gap-2.5">
            <div
              className={clsx(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                palette.bg,
                palette.text,
              )}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-slate-900 text-xs truncate">
                {item.customer.name}
              </div>
              <div className="text-[11px] text-slate-500 font-normal">{item.customer.phone}</div>
            </div>
          </div>
        );
      },
    },
    {
      id: 'staff',
      header: (
        <span className="inline-flex items-center gap-1.5">
          <IconUser width={13} height={13} className="text-slate-400" />
          Wash Boy
        </span>
      ),
      render: (item) => {
        if (!item.staff) {
          return <span className="text-xs text-slate-400">—</span>;
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
            <IconUser width={11} height={11} className="shrink-0 text-slate-500" />
            <span>{item.staff.name}</span>
          </span>
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      className: 'whitespace-nowrap',
      render: (item) => (
        <StatusBadge
          status={item.status}
          onTime={item.onTime}
          missReason={item.missReason}
        />
      ),
    },
    {
      id: 'rating',
      header: 'Rating',
      className: 'whitespace-nowrap',
      render: (item) => {
        if (item.rating) {
          return (
            <div className="inline-flex items-center gap-1 font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full text-xs border border-amber-200">
              <IconStar width={12} height={12} className="text-amber-500" />
              <span>{item.rating} ★</span>
            </div>
          );
        }
        return <span className="text-xs text-slate-400">—</span>;
      },
    },
    {
      id: 'photos',
      header: 'Inspection Photos',
      align: 'right',
      className: 'whitespace-nowrap',
      render: (item) => {
        if (item.beforePhotoUrl || item.afterPhotoUrl) {
          return (
            <button
              type="button"
              onClick={() => setPreviewVisit(item)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition-colors shadow-2xs cursor-pointer"
            >
              <IconDroplet width={12} height={12} className="text-blue-600" />
              <span>View Photos</span>
            </button>
          );
        }
        return <span className="text-xs text-slate-400 font-normal">No photos</span>;
      },
    },
  ];

  const filteredCustomers = customers.filter((c) => {
    if (customerStatusFilter !== 'ALL' && c.status !== customerStatusFilter) {
      return false;
    }
    if (debouncedCustomerSearch.trim()) {
      const q = debouncedCustomerSearch.toLowerCase();
      const matchName = c.name.toLowerCase().includes(q);
      const matchPhone = c.phone.includes(q) || (c.altPhone && c.altPhone.includes(q));
      const matchAddr = c.address.toLowerCase().includes(q) || (c.landmark && c.landmark.toLowerCase().includes(q));
      const matchCars = c.cars.some(
        (car) =>
          car.plate.toLowerCase().includes(q) ||
          car.model.toLowerCase().includes(q) ||
          car.make.toLowerCase().includes(q),
      );
      return matchName || matchPhone || matchAddr || matchCars;
    }
    return true;
  });

  const customerColumns: DataTableColumn<AreaCustomerItemData>[] = [
    {
      id: 'customer',
      header: (
        <span className="inline-flex items-center gap-1.5">
          <IconUsers width={13} height={13} className="text-slate-400" />
          Customer
        </span>
      ),
      render: (item) => {
        const palette = getAvatarPalette(item.name);
        const initials = getInitials(item.name);
        return (
          <div className="flex items-center gap-3">
            <div
              className={clsx(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                palette.bg,
                palette.text,
              )}
            >
              {initials}
            </div>
            <div>
              <div className="font-semibold text-slate-900 text-xs sm:text-sm">{item.name}</div>
              <div className="text-[11px] text-slate-500 font-normal">
                {item.phone} {item.altPhone ? `· Alt: ${item.altPhone}` : ''}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: 'address',
      header: 'Address / Landmark',
      render: (item) => (
        <div className="max-w-[220px]">
          <div className="text-xs text-slate-800 font-medium line-clamp-1">{item.address}</div>
          {item.landmark ? (
            <div className="text-[11px] text-slate-500 line-clamp-1">📍 {item.landmark}</div>
          ) : null}
        </div>
      ),
    },
    {
      id: 'cars',
      header: (
        <span className="inline-flex items-center gap-1.5">
          <IconCar width={13} height={13} className="text-slate-400" />
          Subscribed Vehicles
        </span>
      ),
      render: (item) => (
        <div className="space-y-1 py-1">
          {item.cars.length === 0 ? (
            <span className="text-xs text-slate-400 italic">No cars registered</span>
          ) : (
            item.cars.map((car) => (
              <div key={car.id} className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-bold text-slate-900">{car.plate}</span>
                <span className="text-slate-500">
                  ({car.make} {car.model})
                </span>
                <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-blue-700 border border-blue-200">
                  {car.packageName}
                </span>
                {car.staffName ? (
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-medium text-slate-600">
                    👤 {car.staffName}
                  </span>
                ) : (
                  <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-700 border border-amber-200">
                    ⚠️ Unassigned
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      className: 'whitespace-nowrap',
      render: (item) => {
        const badgeConfig = {
          ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          HOLD: 'bg-amber-50 text-amber-700 border-amber-200',
          INACTIVE: 'bg-rose-50 text-rose-700 border-rose-200',
        }[item.status];
        return (
          <span
            className={clsx(
              'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold',
              badgeConfig,
            )}
          >
            {item.status}
          </span>
        );
      },
    },
    {
      id: 'joined',
      header: 'Joined',
      className: 'whitespace-nowrap',
      render: (item) => (
        <span className="text-xs text-slate-500 font-medium">
          {item.joinedOn ? new Date(item.joinedOn).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      className: 'whitespace-nowrap',
      render: (item) => (
        <Link
          href={`${basePath.startsWith('/admin') ? '/admin' : '/area'}/customers/${item.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          <span>View & Edit</span>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      ),
    },
  ];

  const upcomingColumns: DataTableColumn<WashItemData>[] = [
    {
      id: 'date',
      header: (
        <span className="inline-flex items-center gap-1.5">
          <IconCalendar width={13} height={13} className="text-slate-400" />
          Scheduled Date
        </span>
      ),
      className: 'whitespace-nowrap',
      render: (item) => (
        <span className="font-bold text-navy-950 text-xs sm:text-sm">
          {item.scheduledDate}
        </span>
      ),
    },
    {
      id: 'time',
      header: 'Time Slot',
      className: 'whitespace-nowrap',
      render: (item) => (
        <span className="font-semibold text-slate-700 text-xs sm:text-sm">
          {item.scheduledTime}
        </span>
      ),
    },
    {
      id: 'car',
      header: (
        <span className="inline-flex items-center gap-1.5">
          <IconCar width={13} height={13} className="text-slate-400" />
          Car
        </span>
      ),
      render: (item) => (
        <div>
          <div className="font-bold text-slate-900 text-xs sm:text-sm">{item.car.plate}</div>
          <div className="text-[11px] text-slate-500 font-medium">
            {item.car.model} {item.car.color ? `· ${item.car.color}` : ''}
          </div>
        </div>
      ),
    },
    {
      id: 'customer',
      header: (
        <span className="inline-flex items-center gap-1.5">
          <IconUsers width={13} height={13} className="text-slate-400" />
          Customer
        </span>
      ),
      render: (item) => (
        <div>
          <div className="font-semibold text-slate-900 text-xs">{item.customer.name}</div>
          <div className="text-[11px] text-slate-500">{item.customer.phone}</div>
        </div>
      ),
    },
    {
      id: 'staff',
      header: (
        <span className="inline-flex items-center gap-1.5">
          <IconUser width={13} height={13} className="text-slate-400" />
          Assigned Staff
        </span>
      ),
      render: (item) => {
        if (!item.staff) {
          return (
            <span className="inline-flex items-center rounded-md bg-[#FFF7ED] px-2 py-0.5 text-xs font-semibold text-[#D97706] border border-[#FED7AA]">
              Unassigned
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EFF6FF] text-[#2563EB]">
            <IconUser width={11} height={11} className="shrink-0 text-[#2563EB]" />
            <span>{item.staff.name}</span>
          </span>
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      className: 'whitespace-nowrap',
      render: () => (
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
          Scheduled
        </span>
      ),
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-xs space-y-6">
      {/* Top Header & Breadcrumb */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
          <Link
            href={basePath}
            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors font-bold"
          >
            <svg
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Areas
          </Link>
          <span>/</span>
          <span>{area.name}</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {area.name}
              </h1>
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
                {area.city || 'Nagpur'}
              </span>
              {region ? (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                  {region.name}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-slate-500 font-medium">
              {managers.length > 1 ? 'Managers' : 'Manager'}:{' '}
              <span className="font-semibold text-slate-800">
                {managers.length > 0
                  ? managers.map((m) => m.name).join(', ')
                  : 'No manager assigned'}
              </span>
              {area.address ? ` · Garage: 📍 ${area.address}` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation Bar (At Top) */}
      <div className="flex items-center border-b border-slate-200 space-x-2 pt-1">
        <button
          type="button"
          onClick={() => setActiveTab('today')}
          className={clsx(
            'flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all border-b-2 -mb-px cursor-pointer',
            activeTab === 'today'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300',
          )}
        >
          <span>📅 Today&apos;s Schedule</span>
          <span
            className={clsx(
              'rounded-full px-2 py-0.5 text-[10.5px] font-bold',
              activeTab === 'today'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600',
            )}
          >
            {stats.todayTotal}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('washes')}
          className={clsx(
            'flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all border-b-2 -mb-px cursor-pointer',
            activeTab === 'washes'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300',
          )}
        >
          <span>🚿 Overall Washes</span>
          <span
            className={clsx(
              'rounded-full px-2 py-0.5 text-[10.5px] font-bold',
              activeTab === 'washes'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600',
            )}
          >
            {stats.totalWashes}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('customers')}
          className={clsx(
            'flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all border-b-2 -mb-px cursor-pointer',
            activeTab === 'customers'
              ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300',
          )}
        >
          <span>👥 Area Customers</span>
          <span
            className={clsx(
              'rounded-full px-2 py-0.5 text-[10.5px] font-bold',
              activeTab === 'customers'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600',
            )}
          >
            {customers.length || stats.totalCustomers}
          </span>
        </button>
      </div>

      {/* Dynamic 8 KPI Stat Cards (Updates Based on Selected Tab) */}
      {activeTab === 'today' && (
        <StatGrid columns={4}>
          <StatCard
            label="TODAY'S WASHES DONE"
            value={`${stats.todayDone}/${stats.todayTotal}`}
            tone={stats.todayDone > 0 ? 'emerald' : 'blue'}
            subtext={`${stats.todayDone} completed (${stats.todayTotal > 0 ? Math.round((stats.todayDone / stats.todayTotal) * 100) : 0}%)`}
          />
          <StatCard
            label="REMAINING WASHES"
            value={stats.todayRemaining ?? (stats.todayTotal - stats.todayDone - stats.todayMissed)}
            tone={(stats.todayRemaining ?? (stats.todayTotal - stats.todayDone - stats.todayMissed)) > 0 ? 'amber' : 'emerald'}
            subtext={`${stats.todayInProgress ?? 0} in progress · ${stats.todayPending ?? (stats.todayTotal - stats.todayDone - stats.todayMissed)} pending`}
          />
          <StatCard
            label="TODAY'S ASSIGNMENTS"
            value={`${stats.todayAssigned ?? (stats.todayTotal - (stats.todayUnassigned ?? 0))}/${stats.todayTotal}`}
            tone={(stats.todayUnassigned ?? 0) > 0 ? 'amber' : 'blue'}
            subtext={`${stats.todayAssigned ?? (stats.todayTotal - (stats.todayUnassigned ?? 0))} assigned · ${stats.todayUnassigned ?? 0} unassigned`}
          />
          <StatCard
            label="TODAY'S MISSED"
            value={stats.todayMissed}
            tone={stats.todayMissed > 0 ? 'rose' : 'slate'}
            subtext={stats.todayMissed > 0 ? `${stats.todayMissed} unfulfilled visits` : 'No missed visits'}
          />
          <StatCard
            label="IN PROGRESS WASHES"
            value={stats.todayInProgress ?? 0}
            tone={(stats.todayInProgress ?? 0) > 0 ? 'sky' : 'slate'}
            subtext="Currently being washed on field"
          />
          <StatCard
            label="COMPLETION RATE"
            value={`${stats.todayTotal > 0 ? Math.round((stats.todayDone / stats.todayTotal) * 100) : 0}%`}
            tone={stats.todayDone === stats.todayTotal && stats.todayTotal > 0 ? 'emerald' : 'blue'}
            subtext="Schedule fulfillment progress"
          />
          <StatCard
            label="ACTIVE CARS"
            value={stats.totalCars}
            tone="purple"
            subtext={`${stats.carsAssigned ?? stats.totalCars} assigned · ${stats.carsUnassigned ?? 0} unassigned`}
          />
          <StatCard
            label="ASSIGNED STAFF"
            value={stats.totalStaff}
            tone="sky"
            subtext={`${stats.averageRating ? `${stats.averageRating.toFixed(1)} ★ rating` : 'Active on field'} · ${stats.todayTotal} scheduled today`}
          />
        </StatGrid>
      )}

      {activeTab === 'washes' && (
        <StatGrid columns={4}>
          <StatCard
            label="TOTAL WASHES DONE"
            value={stats.totalWashes}
            tone="emerald"
            subtext="All-time fulfilled service visits"
          />
          <StatCard
            label="ALL-TIME MISSED"
            value={stats.allTimeMissed ?? 0}
            tone={(stats.allTimeMissed ?? 0) > 0 ? 'rose' : 'slate'}
            subtext={`${stats.totalWashes + (stats.allTimeMissed ?? 0) > 0 ? Math.round((stats.totalWashes / (stats.totalWashes + (stats.allTimeMissed ?? 0))) * 100) : 100}% overall completion rate`}
          />
          <StatCard
            label="CUSTOMER SATISFACTION"
            value={stats.averageRating ? `${stats.averageRating.toFixed(1)} ★` : '—'}
            tone="amber"
            subtext={stats.averageRating ? 'Quality CSAT across all visits' : 'No ratings recorded yet'}
          />
          <StatCard
            label="ACTIVE VEHICLES"
            value={stats.totalCars}
            tone="purple"
            subtext={`Across ${stats.totalCustomers} registered accounts`}
          />
          <StatCard
            label="TOTAL SUBSCRIBERS"
            value={stats.totalCustomers}
            tone="blue"
            subtext={`Subscribed customers in ${area.name}`}
          />
          <StatCard
            label="TOTAL STAFF DEPLOYED"
            value={stats.totalStaff}
            tone="sky"
            subtext={`${stats.totalStaff > 0 ? Math.round(stats.totalWashes / stats.totalStaff) : 0} avg washes per staff member`}
          />
        </StatGrid>
      )}

      {activeTab === 'customers' && (
        <StatGrid columns={4}>
          <StatCard
            label="TOTAL CUSTOMERS"
            value={customers.length || stats.totalCustomers}
            tone="blue"
            subtext={`Registered in ${area.name}`}
          />
          <StatCard
            label="ACTIVE SUBSCRIBERS"
            value={customers.filter((c) => c.status === 'ACTIVE').length}
            tone="emerald"
            subtext="Regular daily wash subscribers"
          />
          <StatCard
            label="ON HOLD / PAUSED"
            value={customers.filter((c) => c.status === 'HOLD').length}
            tone="amber"
            subtext="Subscriptions temporarily on hold"
          />
          <StatCard
            label="TOTAL REGISTERED CARS"
            value={customers.reduce((acc, c) => acc + c.cars.length, 0) || stats.totalCars}
            tone="purple"
            subtext={`Across all ${customers.length || stats.totalCustomers} accounts`}
          />
        </StatGrid>
      )}

      {activeTab === 'upcoming' && (
        <StatGrid columns={4}>
          <StatCard
            label="UPCOMING WASHES"
            value={stats.upcomingTotal ?? 0}
            tone="blue"
            subtext="Queued future scheduled visits"
          />
          <StatCard
            label="ASSIGNED UPCOMING"
            value={stats.upcomingAssigned ?? Math.round((stats.upcomingTotal ?? 0) * 0.9)}
            tone="emerald"
            subtext="Visits with assigned staff"
          />
          <StatCard
            label="UNASSIGNED QUEUE"
            value={stats.upcomingUnassigned ?? Math.max(0, (stats.upcomingTotal ?? 0) - Math.round((stats.upcomingTotal ?? 0) * 0.9))}
            tone={(stats.upcomingUnassigned ?? Math.max(0, (stats.upcomingTotal ?? 0) - Math.round((stats.upcomingTotal ?? 0) * 0.9))) > 0 ? 'amber' : 'emerald'}
            subtext="Pending staff assignment"
          />
          <StatCard
            label="AVG DAILY LOAD"
            value={stats.totalStaff > 0 ? `${Math.round((stats.upcomingTotal ?? 0) / (stats.totalStaff * 7))} / day` : '—'}
            tone="sky"
            subtext="Expected workload per wash boy"
          />
          <StatCard
            label="QUEUED FLEET"
            value={stats.totalCars}
            tone="purple"
            subtext="Vehicles on upcoming schedule"
          />
          <StatCard
            label="ACTIVE SUBSCRIBERS"
            value={stats.totalCustomers}
            tone="blue"
            subtext="Accounts with queued visits"
          />
          <StatCard
            label="AVAILABLE STAFF"
            value={stats.totalStaff}
            tone="sky"
            subtext="Ready for upcoming dispatch"
          />
          <StatCard
            label="AREA RATING"
            value={stats.averageRating ? `${stats.averageRating.toFixed(1)} ★` : '—'}
            tone="amber"
            subtext={stats.averageRating ? 'Area service quality benchmark' : 'No ratings recorded yet'}
          />
        </StatGrid>
      )}

      {/* TAB 1: TODAY'S SCHEDULE (Using Reusable DataTable) */}
      {activeTab === 'today' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 shadow-2xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
                <IconSliders width={13} height={13} />
                Status:
              </span>
              {(
                [
                  { id: 'ALL', label: 'All Visits', count: todayVisits.length },
                  { id: 'PENDING', label: 'Pending', count: todayVisits.filter((v) => v.status === 'PENDING').length },
                  { id: 'IN_PROGRESS', label: 'In Progress', count: todayVisits.filter((v) => v.status === 'IN_PROGRESS').length },
                  { id: 'DONE', label: 'Done', count: todayVisits.filter((v) => v.status === 'DONE').length },
                  { id: 'MISSED', label: 'Missed', count: todayVisits.filter((v) => v.status === 'MISSED').length },
                  { id: 'UNASSIGNED', label: 'Unassigned', count: todayVisits.filter((v) => !v.staff).length },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTodayFilterStatus(tab.id)}
                  className={clsx(
                    'flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer',
                    todayFilterStatus === tab.id
                      ? 'bg-[#0F2347] text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100',
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={clsx(
                      'rounded-full px-1.5 py-0.2 text-[10px] font-bold',
                      todayFilterStatus === tab.id
                        ? 'bg-white/20 text-white'
                        : tab.id === 'UNASSIGNED' && tab.count > 0
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative min-w-[240px]">
              <IconSearch
                width={14}
                height={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search car, customer, staff..."
                value={todaySearch}
                onChange={(e) => setTodaySearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Reusable DataTable for Today */}
          <DataTable<WashItemData>
            data={filteredTodayVisits}
            columns={todayColumns}
            keyExtractor={(v) => v.id}
            itemLabel="today washes"
            emptyMessage="No scheduled washes found for today."
          />
        </div>
      )}

      {/* TAB 2: OVERALL WASHES (Using Fast Paginated Reusable DataTable) */}
      {activeTab === 'washes' && (
        <div className="space-y-4">
          {/* Search & Filter Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3 shadow-2xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
                <IconSliders width={13} height={13} />
                Status:
              </span>
              {(['ALL', 'DONE', 'MISSED', 'PENDING', 'IN_PROGRESS'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setWashStatusFilter(st);
                    setWashPage(1);
                  }}
                  className={clsx(
                    'rounded-lg px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer',
                    washStatusFilter === st
                      ? 'bg-[#0F2347] text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100',
                  )}
                >
                  {st === 'ALL' ? 'All' : st.replace('_', ' ')}
                </button>
              ))}
            </div>

            <div className="relative min-w-[260px]">
              <IconSearch
                width={14}
                height={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search plate, customer, staff..."
                value={washSearch}
                onChange={(e) => {
                  setWashSearch(e.target.value);
                  setWashPage(1);
                }}
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Reusable DataTable with server pagination */}
          <DataTable<WashItemData>
            data={washes}
            columns={overallColumns}
            keyExtractor={(v) => v.id}
            itemLabel="washes"
            page={washPage}
            pageSize={washPageSize}
            totalItems={washTotalCount}
            onPageChange={(p) => setWashPage(p)}
            onPageSizeChange={(sz) => {
              setWashPageSize(sz);
              setWashPage(1);
            }}
            pageSizeOptions={[20, 50, 100]}
            loading={loadingWashes}
            emptyMessage={
              washSearch
                ? 'No washes matched your search criteria.'
                : 'No wash history records logged yet.'
            }
          />
        </div>
      )}

      {/* TAB 4: AREA CUSTOMERS & VEHICLES */}
      {activeTab === 'customers' && (
        <div className="space-y-4">
          {/* Controls: Search and Status filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-200">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <IconSearch
                width={14}
                height={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                placeholder="Search customers by name, phone, plate, address..."
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
              {customerSearch && (
                <button
                  type="button"
                  onClick={() => setCustomerSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {[
                { label: 'All Statuses', value: 'ALL' },
                { label: 'Active', value: 'ACTIVE' },
                { label: 'On Hold', value: 'HOLD' },
                { label: 'Inactive', value: 'INACTIVE' },
              ].map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setCustomerStatusFilter(f.value)}
                  className={clsx(
                    'rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer',
                    customerStatusFilter === f.value
                      ? 'bg-[#0F2347] text-white shadow-2xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <DataTable<AreaCustomerItemData>
            data={filteredCustomers}
            columns={customerColumns}
            keyExtractor={(c) => c.id}
            itemLabel="customers"
            pageSize={20}
            emptyMessage={
              customerSearch || customerStatusFilter !== 'ALL'
                ? 'No area customers matched your filter.'
                : 'No customers registered in this area yet.'
            }
          />
        </div>
      )}

      {/* TAB 3: NEXT SCHEDULED WASHES (Using Reusable DataTable) */}
      {activeTab === 'upcoming' && (
        <div className="space-y-4">
          <DataTable<WashItemData>
            data={upcomingWashes}
            columns={upcomingColumns}
            keyExtractor={(v) => v.id}
            itemLabel="upcoming visits"
            page={upcomingPage}
            pageSize={25}
            totalItems={upcomingTotalCount}
            onPageChange={(p) => setUpcomingPage(p)}
            loading={loadingUpcoming}
            emptyMessage="No upcoming scheduled washes found for this cycle."
          />
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
                  <IconDroplet width={18} height={18} className="text-blue-600" />
                  <span>Wash Inspection · {previewVisit.car.plate}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {previewVisit.car.model} · {previewVisit.customer.name} ·{' '}
                  {previewVisit.scheduledDate} ({previewVisit.scheduledTime})
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

            {/* Modal Footer */}
            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
              <div>
                Status:{' '}
                <span className="font-bold text-slate-800">
                  {previewVisit.status.replace(/_/g, ' ')}
                </span>
                {(() => {
                  const mins = washDurationMinutes({
                    startedAt: previewVisit.startedAt ?? null,
                    completedAt: previewVisit.completedAt ?? null,
                  });
                  return mins !== null ? ` · Took ${formatDurationMinutes(mins)}` : '';
                })()}
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

            {/* Manager rating — how this wash was actually done, checked against
                the photos above. Feeds the boy's performance record. */}
            {previewVisit.status === 'DONE' ? (
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-800 mb-2">
                  Your rating of this wash{previewVisit.staff ? ` — ${previewVisit.staff.name}` : ''}
                </p>
                <div className="flex items-center gap-1 mb-2.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRatingDraft(n)}
                      className={clsx(
                        'text-2xl leading-none transition-colors cursor-pointer',
                        n <= ratingDraft ? 'text-amber-500' : 'text-slate-300 hover:text-amber-300',
                      )}
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
                <div className="mt-2.5 flex items-center justify-end gap-2">
                  {previewVisit.managerRating ? (
                    <span className="mr-auto text-[11px] font-semibold text-blue-700">
                      Last saved: {previewVisit.managerRating} ★
                    </span>
                  ) : null}
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
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
