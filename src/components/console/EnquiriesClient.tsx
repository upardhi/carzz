'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { useToast } from '@/components/ui/ToastProvider';
import type { Enquiry, EnquiryStatus, Area, ServicePackage } from '@/lib/data/types';
import { formatDateFull } from '@/lib/util/format';
import { useDebounce } from '@/lib/util/debounce';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import {
  IconBack,
  IconChevron,
  IconEye,
  IconMapPin,
  IconSearch,
  IconUser,
} from '@/components/shell/icons';

interface EnquiriesClientProps {
  initialEnquiries: Enquiry[];
  initialAreas: Area[];
  initialPackages: ServicePackage[];
  initialKpis: {
    all: number;
    new: number;
    contacted: number;
    converted: number;
    lost: number;
  };
  initialTotalItems: number;
  existingCustomerPhoneMap: Record<string, { id: string; name: string; areaId: string }>;
  basePath: string; // e.g. '/admin', '/manager', '/area'
}

const AVATAR_PALETTES = [
  { bg: 'bg-[#EBF5FF]', text: 'text-[#2563EB]' }, // soft blue (BA)
  { bg: 'bg-[#F5F3FF]', text: 'text-[#8B5CF6]' }, // soft purple (SE)
  { bg: 'bg-[#ECFDF5]', text: 'text-[#10B981]' }, // soft green (VR)
  { bg: 'bg-[#FFF1F2]', text: 'text-[#F43F5E]' }, // soft red/pink (VR)
  { bg: 'bg-[#FFFBEB]', text: 'text-[#D97706]' }, // soft amber
  { bg: 'bg-[#ECFEFF]', text: 'text-[#0891B2]' }, // soft cyan
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

export function EnquiriesClient({
  initialEnquiries,
  initialAreas,
  initialPackages,
  initialKpis,
  initialTotalItems,
  existingCustomerPhoneMap: initialPhoneMap,
  basePath,
}: EnquiriesClientProps) {
  const { toast } = useToast();

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<'ALL' | EnquiryStatus>('ALL');
  const [areaFilter, setAreaFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [sortBy, setSortBy] = useState<'createdAt' | 'name' | 'status'>('createdAt');
  const [sortDir] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Data
  const [enquiries, setEnquiries] = useState<Enquiry[]>(initialEnquiries);
  const [areas] = useState<Area[]>(initialAreas);
  const [packages] = useState<ServicePackage[]>(initialPackages);
  const [kpis, setKpis] = useState(initialKpis);
  const [phoneMap, setPhoneMap] = useState(initialPhoneMap);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    totalItems: initialTotalItems,
    totalPages: Math.max(1, Math.ceil(initialTotalItems / 10)),
    hasNext: initialTotalItems > 10,
    hasPrev: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [actionPendingId, setActionPendingId] = useState<string | null>(null);
  const isFirstRender = useRef(true);

  // Reset to page 1 on debounced search update
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const fetchEnquiries = useCallback(
    async (targetPage: number, targetPageSize: number, silent = false) => {
      if (!silent) setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: targetPage.toString(),
          pageSize: targetPageSize.toString(),
          status: statusFilter,
          areaId: areaFilter,
          search: debouncedSearch,
          sortBy,
          sortDir,
        });

        const res = await fetch(`/api/ops/enquiries?${params.toString()}`);
        if (!res.ok) throw new Error('Failed to load enquiries');
        const data = await res.json();

        setEnquiries(data.items);
        setKpis(data.kpis);
        setPhoneMap(data.existingCustomerPhoneMap || {});
        setPagination(data.pagination);
      } catch {
        toast.error('Could not load enquiries.');
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [statusFilter, areaFilter, debouncedSearch, sortBy, sortDir, toast],
  );

  // When filters or search change, reset to page 1 and fetch
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setPage(1);
    fetchEnquiries(1, pageSize);
  }, [statusFilter, areaFilter, debouncedSearch, sortBy, sortDir, pageSize, fetchEnquiries]);

  // When page number changes (and not first render), fetch that target page
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchEnquiries(newPage, pageSize);
  };

  const handleStatusChange = async (enquiryId: string, newStatus: EnquiryStatus) => {
    // 1. Optimistically update local item so button changes instantly without loading flicker
    setEnquiries((prev) =>
      prev.map((item) => (item.id === enquiryId ? { ...item, status: newStatus } : item)),
    );
    setActionPendingId(enquiryId);
    try {
      const res = await fetch('/api/ops/enquiries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enquiryId, status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update');

      toast.success(data.message || `Status changed to ${newStatus}`);
      // 2. Silently sync latest stats from server without showing double loading
      await fetchEnquiries(page, pageSize, true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not update status');
      await fetchEnquiries(page, pageSize, true);
    } finally {
      setActionPendingId(null);
    }
  };

  const areaMap = new Map(areas.map((a) => [a.id, a]));
  const packageMap = new Map(packages.map((p) => [p.id, p]));

  return (
    <div className="space-y-4">
      {/* 4 Top Reusable StatCards */}
      <StatGrid columns={4}>
        <StatCard
          label="TOTAL ENQUIRIES"
          value={kpis.all}
          tone="blue"
          className={clsx(
            'cursor-pointer',
            statusFilter === 'ALL' && 'border-blue-600 ring-2 ring-blue-600/20',
          )}
          onClick={() => setStatusFilter('ALL')}
        />
        <StatCard
          label="NEW LEADS"
          value={kpis.new}
          tone="emerald"
          className={clsx(
            'cursor-pointer',
            statusFilter === 'NEW' && 'border-emerald-600 ring-2 ring-emerald-600/20',
          )}
          onClick={() => setStatusFilter('NEW')}
        />
        <StatCard
          label="CONTACTED"
          value={kpis.contacted}
          tone="purple"
          className={clsx(
            'cursor-pointer',
            statusFilter === 'CONTACTED' && 'border-purple-600 ring-2 ring-purple-600/20',
          )}
          onClick={() => setStatusFilter('CONTACTED')}
        />
        <StatCard
          label="CONVERTED"
          value={kpis.converted}
          tone="gold"
          className={clsx(
            'cursor-pointer',
            statusFilter === 'CONVERTED' && 'border-amber-600 ring-2 ring-amber-600/20',
          )}
          onClick={() => setStatusFilter('CONVERTED')}
        />
      </StatGrid>

      {/* Filter and Search Bar Matching Screenshot */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        {/* Search Input */}
        <div className="relative flex-1">
          <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" width={16} height={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, WhatsApp number, or locality..."
            className="w-full rounded-xl border border-transparent bg-transparent py-2 pl-9 pr-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#CBD5E1] focus:bg-white focus:outline-none"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {/* All Areas Dropdown */}
          <div className="relative">
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="appearance-none rounded-xl border border-[#E2E8F0] bg-white py-2 pl-8 pr-7 text-xs font-semibold text-[#334155] shadow-2xs hover:border-[#CBD5E1] focus:border-[#3B82F6] focus:outline-none"
            >
              <option value="ALL">All Areas ({areas.length})</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <IconMapPin className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748B]" width={14} height={14} />
            <IconChevron className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 text-[#94A3B8]" width={12} height={12} />
          </div>

          {/* All Statuses Dropdown */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | EnquiryStatus)}
              className="appearance-none rounded-xl border border-[#E2E8F0] bg-white py-2 pl-8 pr-7 text-xs font-semibold text-[#334155] shadow-2xs hover:border-[#CBD5E1] focus:border-[#3B82F6] focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="NEW">New Leads</option>
              <option value="CONTACTED">Contacted</option>
              <option value="CONVERTED">Converted</option>
              <option value="LOST">Lost / Query Only</option>
            </select>
            {/* Filter funnel icon */}
            <svg className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748B]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <IconChevron className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 text-[#94A3B8]" width={12} height={12} />
          </div>

          {/* Sort By Dropdown */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'createdAt' | 'name' | 'status')}
              className="appearance-none rounded-xl border border-[#E2E8F0] bg-white py-2 pl-8 pr-7 text-xs font-semibold text-[#334155] shadow-2xs hover:border-[#CBD5E1] focus:border-[#3B82F6] focus:outline-none"
            >
              <option value="createdAt">Newest first</option>
              <option value="name">Customer Name</option>
              <option value="status">Status</option>
            </select>
            {/* Sort up/down icon */}
            <svg className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#64748B]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 15l5 5 5-5M7 9l5-5 5 5" />
            </svg>
            <IconChevron className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 text-[#94A3B8]" width={12} height={12} />
          </div>

          {/* Page Size Dropdown */}
          <div className="relative">
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="appearance-none rounded-xl border border-[#E2E8F0] bg-white py-2 pl-3 pr-7 text-xs font-semibold text-[#334155] shadow-2xs hover:border-[#CBD5E1] focus:border-[#3B82F6] focus:outline-none"
            >
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
            </select>
            <IconChevron className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 text-[#94A3B8]" width={12} height={12} />
          </div>
        </div>
      </div>

      {/* Enquiry Cards Stack */}
      <div className="relative space-y-3">
        {/* Top Loading Progress Bar */}
        {isLoading && (
          <div className="absolute -top-2 left-0 right-0 z-10 h-0.5 overflow-hidden rounded-full bg-blue-100">
            <div className="h-full w-full bg-blue-600 animate-pulse" />
          </div>
        )}

        {enquiries.length === 0 && isLoading ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white py-16 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#3B82F6] border-t-transparent" />
            <p className="mt-3 text-sm text-[#64748B]">Loading enquiries...</p>
          </div>
        ) : enquiries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#CBD5E1] bg-white py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F1F5F9] text-[#94A3B8]">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-bold text-[#0F172A]">No enquiries found</p>
            <p className="mt-1 text-xs text-[#64748B]">
              {searchQuery || statusFilter !== 'ALL' || areaFilter !== 'ALL'
                ? 'Try adjusting your search or filter parameters'
                : 'Customer booking submissions from the website will appear here.'}
            </p>
          </div>
        ) : (
          <div className={`space-y-3 transition-opacity duration-150 ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
            {enquiries.map((enq) => {
              const area = enq.areaId ? areaMap.get(enq.areaId) : null;
              const pkg = enq.packageId ? packageMap.get(enq.packageId) : null;
              const existingCustomer = phoneMap[enq.phone];
              const isPending = actionPendingId === enq.id;
              const avatar = getAvatarPalette(enq.name);
              const initials = getInitials(enq.name);
              const shortRef = `#${enq.id.slice(-6).toUpperCase()}`;

              return (
                <div
                  key={enq.id}
                  className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs transition-all hover:border-[#CBD5E1] hover:shadow-sm"
                >
                  {/* Top Row: Avatar & Details on Left, ID & Action Buttons on Right */}
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    {/* Left Section: Avatar + Details */}
                    <div className="flex items-start gap-4 flex-1">
                    {/* Circle Initials Avatar */}
                    <div
                      className={clsx(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                        avatar.bg,
                        avatar.text,
                      )}
                    >
                      {initials}
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      {/* Name & Status Pill */}
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="text-[15px] font-bold text-[#0F172A] leading-none">{enq.name}</h3>

                        {/* Green Pill Badge */}
                        <span className="inline-flex items-center rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-bold text-[#10B981]">
                          {enq.status === 'NEW'
                            ? 'New Lead'
                            : enq.status === 'CONTACTED'
                              ? 'Contacted'
                              : enq.status === 'CONVERTED'
                                ? 'Converted'
                                : 'Closed'}
                        </span>

                        {/* Existing Customer Warning */}
                        {existingCustomer && (
                          <Link
                            href={`${basePath === '/admin' ? '/manager' : basePath}/customers/${existingCustomer.id}`}
                            className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                          >
                            <IconUser width={12} height={12} />
                            <span>Existing: {existingCustomer.name}</span>
                          </Link>
                        )}
                      </div>

                      {/* Phone & WhatsApp Chat Pill */}
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <a
                          href={`tel:${enq.phone}`}
                          className="inline-flex items-center gap-1.5 font-bold text-[#2563EB] hover:underline"
                        >
                          {/* Call Icon */}
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                          </svg>
                          {enq.phone}
                        </a>

                        <a
                          href={`https://wa.me/91${enq.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-bold text-[#10B981] hover:bg-[#D1FAE5]"
                        >
                          {/* WhatsApp Icon */}
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2z" />
                          </svg>
                          WhatsApp Chat
                        </a>

                        {enq.email && (
                          <span className="flex items-center gap-1 text-[#64748B] font-medium">
                            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                              <polyline points="22,6 12,13 2,6" />
                            </svg>
                            {enq.email}
                          </span>
                        )}
                      </div>

                      {/* Location, Cars, Package, Date Metadata Row */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#64748B] pt-0.5">
                        <span className="flex items-center gap-1">
                          <IconMapPin className="text-[#94A3B8]" width={13} height={13} />
                          <span>{area ? `${area.name}${enq.locality ? ` (${enq.locality})` : ''}` : 'No area chosen'}</span>
                        </span>

                        <span className="flex items-center gap-1">
                          <span className="text-sm leading-none">🚗</span>
                          <span className="font-semibold text-[#334155]">{enq.carCount} {enq.carCount === 1 ? 'car' : 'cars'}</span>
                        </span>

                        {pkg && (
                          <span className="flex items-center gap-1">
                            <svg className="h-3.5 w-3.5 text-[#64748B]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="m12 3 9 4.5v9L12 21l-9-4.5v-9z" />
                              <path d="M3 7.5 12 12l9-4.5M12 12v9" />
                            </svg>
                            <span className="font-medium text-[#334155]">{pkg.name} (₹{pkg.price}/mo)</span>
                          </span>
                        )}

                        <span className="flex items-center gap-1 text-[#64748B]">
                          <svg className="h-3.5 w-3.5 text-[#94A3B8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                          Received {formatDateFull(enq.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Section: ID + 3 Buttons */}
                  <div className="flex flex-col items-end gap-2.5 shrink-0 pt-2 lg:pt-0">
                    {/* Reference ID Pill */}
                    <span className="rounded-lg bg-[#F1F5F9] px-2.5 py-1 text-[11px] font-bold tracking-wider text-[#64748B]">
                      {shortRef}
                    </span>

                    {/* Action Buttons Group */}
                    <div className="flex items-center gap-2">
                      {enq.status !== 'CONVERTED' ? (
                        <Link
                          href={`${basePath}/customers/new?enquiryId=${enq.id}`}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1D4ED8] active:scale-95 transition-all"
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <line x1="19" y1="8" x2="19" y2="14" />
                            <line x1="22" y1="11" x2="16" y2="11" />
                          </svg>
                          Convert to Customer
                        </Link>
                      ) : (
                        enq.convertedCustomerId && (
                          <Link
                            href={`${basePath}/customers/${enq.convertedCustomerId}`}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-purple-50 border border-purple-200 px-3.5 py-2 text-xs font-bold text-purple-700 hover:bg-purple-100"
                          >
                            <IconEye width={14} height={14} />
                            View Account
                          </Link>
                        )
                      )}

                      {/* Mark Contacted Button */}
                      <button
                        type="button"
                        disabled={isPending || enq.status === 'CONTACTED'}
                        onClick={() => handleStatusChange(enq.id, 'CONTACTED')}
                        className={clsx(
                          'rounded-xl border px-3 py-2 text-xs font-bold transition-all disabled:opacity-50',
                          enq.status === 'CONTACTED'
                            ? 'border-[#93C5FD] bg-[#EFF6FF] text-[#2563EB]'
                            : 'border-[#3B82F6] bg-white text-[#2563EB] hover:bg-[#EFF6FF]',
                        )}
                      >
                        {enq.status === 'CONTACTED' ? 'Contacted ✓' : 'Mark Contacted'}
                      </button>

                      {/* Close / Lost Button */}
                      {enq.status !== 'LOST' ? (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleStatusChange(enq.id, 'LOST')}
                          className="rounded-xl border border-[#FCA5A5] bg-white px-3 py-2 text-xs font-bold text-[#EF4444] hover:bg-[#FEF2F2] disabled:opacity-50"
                        >
                          Close / Lost
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleStatusChange(enq.id, 'NEW')}
                          className="rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-bold text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-50"
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bottom Full-Width Customer Note Bar (Exactly matching 1st screenshot) */}
                {enq.message && (
                  <div className="mt-4 rounded-xl bg-[#F8FAFC] p-3 text-xs text-[#334155] border border-[#F1F5F9]">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-0.5">CUSTOMER NOTE</p>
                    <p className="italic text-[#475569]">&ldquo;{enq.message}&rdquo;</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>

      {/* Pagination Footer */}
      {!isLoading && pagination.totalPages > 1 && (
        <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-xs sm:flex-row">
          <p className="text-xs font-medium text-[#64748B]">
            Showing{' '}
            <span className="font-bold text-[#0F172A]">
              {(pagination.page - 1) * pagination.pageSize + 1}
            </span>{' '}
            to{' '}
            <span className="font-bold text-[#0F172A]">
              {Math.min(pagination.page * pagination.pageSize, pagination.totalItems)}
            </span>{' '}
            of <span className="font-bold text-[#0F172A]">{pagination.totalItems}</span> enquiries
          </p>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={!pagination.hasPrev}
              onClick={() => handlePageChange(page - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC] disabled:opacity-40"
            >
              <IconBack width={16} height={16} />
            </button>

            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === pagination.totalPages || Math.abs(p - page) <= 1)
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev && p - prev > 1;
                return (
                  <div key={p} className="flex items-center">
                    {showEllipsis && <span className="px-1 text-xs text-[#94A3B8]">...</span>}
                    <button
                      type="button"
                      onClick={() => handlePageChange(p)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold transition-all ${
                        p === page
                          ? 'bg-[#2563EB] text-white shadow-xs'
                          : 'border border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFC]'
                      }`}
                    >
                      {p}
                    </button>
                  </div>
                );
              })}

            <button
              type="button"
              disabled={!pagination.hasNext}
              onClick={() => handlePageChange(page + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC] disabled:opacity-40"
            >
              <IconChevron width={16} height={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
