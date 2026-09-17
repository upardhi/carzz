'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardHeading,
  Kpi,
  KpiGrid,
  Note,
  Tag,
  Button,
} from '@/components/ui/primitives';
import { useToast } from '@/components/ui/ToastProvider';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import type { User, Area, Region, Role } from '@/lib/data/types';
import { ROLES } from '@/lib/data/types';
import { formatDateFull } from '@/lib/util/format';
import { ROLE_BLURB, ROLE_LABEL } from '@/lib/util/labels';
import { getSafeDocumentUrl } from '@/lib/util/doc-url';
import { useDebounce } from '@/lib/util/debounce';

interface UsersClientProps {
  initialUsers: User[];
  initialAreas: Area[];
  initialRegions: Region[];
  initialKpiCounts: Record<Role, number>;
  initialStatusCounts: { all: number; active: number; disabled: number };
  initialTotalItems: number;
  initialRoleFilter?: 'ALL' | Role;
  currentUserId: string;
}

export function UsersClient({
  initialUsers,
  initialAreas,
  initialRegions,
  initialKpiCounts,
  initialStatusCounts,
  initialTotalItems,
  initialRoleFilter = 'ALL',
  currentUserId,
}: UsersClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const showConfirm = useConfirm();

  // Filter & Search State
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DISABLED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [sortBy, setSortBy] = useState<'name' | 'createdAt' | 'role' | 'email'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset to page 1 when debounced search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  // Data State
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [areas, setAreas] = useState<Area[]>(initialAreas);
  const [regions, setRegions] = useState<Region[]>(initialRegions);
  const [kpiCounts, setKpiCounts] = useState(initialKpiCounts);
  const [statusCounts, setStatusCounts] = useState(initialStatusCounts);
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

  // Fetch Users from Backend API
  const fetchUsers = useCallback(
    async (targetPage = page, targetPageSize = pageSize) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          pageSize: String(targetPageSize),
          role: initialRoleFilter,
          status: statusFilter,
          search: debouncedSearch,
          sortBy,
          sortDir,
        });

        const res = await fetch(`/api/admin/users?${params.toString()}`);
        if (!res.ok) {
          throw new Error('Failed to load users');
        }

        const data = await res.json();
        if (data.ok) {
          setUsers(data.users || []);
          if (data.areas) setAreas(data.areas);
          if (data.regions) setRegions(data.regions);
          if (data.pagination) setPagination(data.pagination);
          if (data.kpiCounts) setKpiCounts(data.kpiCounts);
          if (data.statusCounts) setStatusCounts(data.statusCounts);
        }
      } catch (err) {
        console.error(err);
        toast.error('Could not connect to the backend server.', {
          title: 'Error loading staff users',
        });
      } finally {
        setIsLoading(false);
      }
    },
    [page, pageSize, initialRoleFilter, statusFilter, debouncedSearch, sortBy, sortDir, toast],
  );

  // Sync when filters change (skip initial mount since server rendered)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Only fetch if client-side filters/pagination change. 
    // We don't trigger fetch when initialRoleFilter changes because Next.js RSC already fetched the new data for us.
    fetchUsers(page, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, statusFilter, debouncedSearch, sortBy, sortDir]);

  // Keep track of previous initialRoleFilter to detect role changes
  const prevRoleFilterRef = useRef(initialRoleFilter);

  // Sync state with props when Next.js soft-navigates (e.g. from sidebar links or URL changes)
  useEffect(() => {
    const roleChanged = prevRoleFilterRef.current !== initialRoleFilter;
    prevRoleFilterRef.current = initialRoleFilter;

    if (roleChanged) {
      // Role changed from URL: Reset all client-side filters
      isFirstRender.current = true; // Skip the subsequent redundant fetch
      setPage(1);
      setSearchQuery('');
      setStatusFilter('ALL');
      setSortBy('name');
      setSortDir('asc');
      
      // Apply the server-rendered data immediately
      setUsers(initialUsers);
      setPagination(prev => ({
        ...prev,
        page: 1,
        totalItems: initialTotalItems,
        totalPages: Math.max(1, Math.ceil(initialTotalItems / prev.pageSize)),
        hasNext: initialTotalItems > prev.pageSize,
        hasPrev: false,
      }));
    } else if (!debouncedSearch && statusFilter === 'ALL' && sortBy === 'name' && sortDir === 'asc' && page === 1) {
      // Not a role change, but we are in default state (e.g. initial load or manual reset)
      setUsers(initialUsers);
      setPagination(prev => ({
        ...prev,
        page: 1,
        totalItems: initialTotalItems,
        totalPages: Math.max(1, Math.ceil(initialTotalItems / prev.pageSize)),
        hasNext: initialTotalItems > prev.pageSize,
        hasPrev: false,
      }));
    }

    setKpiCounts(initialKpiCounts);
    setStatusCounts(initialStatusCounts);
  }, [
    initialRoleFilter,
    initialUsers,
    initialTotalItems,
    initialKpiCounts,
    initialStatusCounts,
    debouncedSearch,
    statusFilter,
    sortBy,
    sortDir,
    page,
  ]);

  const areaById = new Map(areas.map((a) => [a.id, a]));
  const regionById = new Map(regions.map((r) => [r.id, r]));

  // Toggle user active status
  const handleToggleActive = async (user: User) => {
    const actionName = user.active ? 'Deactivate' : 'Reactivate';
    const confirmMessage = user.active
      ? `Are you sure you want to deactivate ${user.name}? Their login will stop working immediately.`
      : `Reactivate ${user.name}? They will be able to log in again.`;

    const confirmed = await showConfirm({
      title: `${actionName} ${user.name}`,
      message: confirmMessage,
      confirmText: actionName,
      tone: user.active ? 'danger' : 'primary',
    });

    if (!confirmed) return;

    setActionPendingId(user.id);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setActive',
          userId: user.id,
          active: !user.active,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update user status');
      }

      toast.success(data.message || `${user.name}'s status has been updated.`, {
        title: user.active ? 'User deactivated' : 'User reactivated',
      });

      // Refetch page data
      await fetchUsers(page, pageSize);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not change user status', {
        title: 'Action failed',
      });
    } finally {
      setActionPendingId(null);
    }
  };

  const startRecord = pagination.totalItems === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const endRecord = Math.min(pagination.page * pagination.pageSize, pagination.totalItems);

  return (
    <>
      {/* KPI Overview */}
      <KpiGrid columns={5}>
        {ROLES.map((role) => (
          <Kpi
            key={role}
            label={ROLE_LABEL[role].toUpperCase()}
            value={kpiCounts[role] ?? 0}
            tone={
              role === 'SUPER_ADMIN'
                ? 'purple'
                : role === 'AREA_ADMIN'
                  ? 'blue'
                  : role === 'MANAGER'
                    ? 'sky'
                    : role === 'EMPLOYEE'
                      ? 'emerald'
                      : 'slate'
            }
            subtext={role === 'CUSTOMER' ? 'Mobile app logins' : `${ROLE_LABEL[role]} accounts`}
          />
        ))}
      </KpiGrid>

      {/* Main Staff Users Table Card */}
      <div className="mt-4">
        <Card className="p-0 overflow-hidden border border-line shadow-sm">
          {/* Controls Bar: Search & Status Filters */}
          <div className="p-4 border-b border-line bg-surface flex flex-wrap items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative min-w-[260px] flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search staff by name, email or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface-elevated py-2 pl-9 pr-8 text-sm placeholder:text-ink-mute focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
              <svg
                className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-ink-mute"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-xs text-ink-mute hover:text-ink"
                >
                  ✕
                </button>
              ) : null}
            </div>

            {/* Status Tabs */}
            <div className="flex items-center gap-1 rounded-lg border border-line bg-surface-elevated p-1">
              {(
                [
                  { id: 'ALL', label: 'All', count: statusCounts.all },
                  { id: 'ACTIVE', label: 'Active', count: statusCounts.active },
                  { id: 'DISABLED', label: 'Disabled', count: statusCounts.disabled },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setStatusFilter(tab.id);
                    setPage(1);
                  }}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    statusFilter === tab.id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-ink-mute hover:text-ink hover:bg-surface'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                      statusFilter === tab.id
                        ? 'bg-white/25 text-white'
                        : 'bg-surface-elevated text-ink-mute'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Role Filter Chips & Sorting */}
          <div className="p-3 px-4 border-b border-line bg-surface-elevated/40 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-ink-mute font-medium mr-1">Role:</span>
              <Link
                href="/admin/users"
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-all ${
                  initialRoleFilter === 'ALL'
                    ? 'bg-navy-900 text-white dark:bg-navy-100 dark:text-navy-950'
                    : 'bg-surface border border-line text-ink-mute hover:text-ink'
                }`}
              >
                All Staff ({statusCounts.all})
              </Link>
              {ROLES.filter((r) => r !== 'CUSTOMER').map((r) => (
                <Link
                  key={r}
                  href={`/admin/users?role=${r}`}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-all ${
                    initialRoleFilter === r
                      ? 'bg-navy-900 text-white dark:bg-navy-100 dark:text-navy-950'
                      : 'bg-surface border border-line text-ink-mute hover:text-ink'
                  }`}
                >
                  {ROLE_LABEL[r]} ({kpiCounts[r] ?? 0})
                </Link>
              ))}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-ink-mute font-medium">Sort:</span>
              <select
                value={`${sortBy}:${sortDir}`}
                onChange={(e) => {
                  const [newSortBy, newSortDir] = e.target.value.split(':') as [
                    typeof sortBy,
                    typeof sortDir,
                  ];
                  setSortBy(newSortBy);
                  setSortDir(newSortDir);
                  setPage(1);
                }}
                className="rounded-md border border-line bg-surface px-2 py-1 text-xs font-medium text-ink focus:border-blue-600 focus:outline-none"
              >
                <option value="name:asc">Name (A → Z)</option>
                <option value="name:desc">Name (Z → A)</option>
                <option value="createdAt:desc">Newest First</option>
                <option value="createdAt:asc">Oldest First</option>
                <option value="role:asc">Role</option>
              </select>
            </div>
          </div>

          {/* Table Area */}
          <div className="relative overflow-x-auto">
            {isLoading && (
              <div className="absolute inset-0 bg-surface/60 backdrop-blur-[1px] flex items-center justify-center z-10">
                <div className="flex items-center gap-2 rounded-lg bg-surface border border-line p-3 shadow-md text-xs font-semibold text-ink">
                  <svg
                    className="h-4 w-4 animate-spin text-blue-600"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Updating users...</span>
                </div>
              </div>
            )}

            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-elevated text-xs uppercase font-semibold text-ink-mute">
                <tr>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Reaches</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Mobile</th>
                  <th className="py-3 px-4">KYC & Docs</th>
                  <th className="py-3 px-4">Added</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-ink-mute">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <svg
                          className="h-8 w-8 text-ink-mute opacity-50"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                          />
                        </svg>
                        <p className="font-semibold text-sm text-ink">No staff users found</p>
                        <p className="text-xs">
                          {searchQuery || initialRoleFilter !== 'ALL' || statusFilter !== 'ALL'
                            ? 'Try clearing your search or filter options.'
                            : 'Add a new manager, area admin, or wash boy using the form.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  users.map((user) => {
                    const hasAadhar = Boolean(user.aadharCardUrl || user.aadharNumber);
                    const hasPan = Boolean(user.panCardUrl || user.panNumber);

                    return (
                      <tr
                        key={user.id}
                        className="hover:bg-surface-elevated/50 transition-colors"
                      >
                        <td className="py-3 px-4 font-bold text-ink">
                          <Link
                            href={`/admin/users/${user.id}`}
                            className="hover:text-blue-600 hover:underline transition-colors inline-flex items-center gap-1.5 group"
                          >
                            <span>{user.name}</span>
                            <span className="text-[10px] text-slate-400 group-hover:text-blue-600 transition-colors">↗</span>
                          </Link>
                          {user.id === currentUserId && (
                            <span className="ml-2 rounded-sm bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">
                              You
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Tag tone={user.role === 'SUPER_ADMIN' ? 'info' : 'neutral'}>
                            {ROLE_LABEL[user.role]}
                          </Tag>
                        </td>
                        <td className="py-3 px-4 text-xs text-ink-mute">
                          {user.role === 'SUPER_ADMIN'
                            ? 'Every area'
                            : user.regionId
                              ? `${regionById.get(user.regionId)?.name ?? '—'} region`
                              : user.areaId
                                ? (areaById.get(user.areaId)?.name ?? '—')
                                : '—'}
                        </td>
                        <td className="py-3 px-4 text-xs text-ink-mute font-mono">{user.email}</td>
                        <td className="py-3 px-4 text-xs text-ink-mute">{user.phone}</td>
                        <td className="py-3 px-4">
                          {!hasAadhar && !hasPan ? (
                            <span className="text-[11px] text-ink-faint">—</span>
                          ) : (
                            <div className="flex flex-wrap items-center gap-1">
                              {user.aadharCardUrl ? (
                                <a
                                  href={getSafeDocumentUrl(user.aadharCardUrl)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                                  title={user.aadharNumber ? `Aadhaar: ${user.aadharNumber}` : 'Aadhaar Card'}
                                >
                                  <span>🆔</span>
                                  <span>Aadhaar</span>
                                </a>
                              ) : user.aadharNumber ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-700 border border-slate-200" title="Aadhaar ID recorded">
                                  <span>🆔</span>
                                  <span>UID</span>
                                </span>
                              ) : null}

                              {user.panCardUrl ? (
                                <a
                                  href={getSafeDocumentUrl(user.panCardUrl)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                                  title={user.panNumber ? `PAN: ${user.panNumber}` : 'PAN Card'}
                                >
                                  <span>💳</span>
                                  <span>PAN</span>
                                </a>
                              ) : user.panNumber ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-700 border border-slate-200" title="PAN ID recorded">
                                  <span>💳</span>
                                  <span>PAN</span>
                                </span>
                              ) : null}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-xs text-ink-mute whitespace-nowrap">
                          {formatDateFull(user.createdAt)}
                        </td>
                        <td className="py-3 px-4">
                          <Tag tone={user.active ? 'ok' : 'bad'}>
                            {user.active ? 'Active' : 'Disabled'}
                          </Tag>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={`/admin/users/${user.id}`}
                              className="rounded-lg border border-line bg-surface-elevated px-2.5 py-1 text-xs font-semibold text-ink hover:bg-slate-100 hover:text-blue-600 transition-colors"
                              title="View Details"
                            >
                              View
                            </Link>
                            <Link
                              href={`/admin/users/${user.id}/edit`}
                              className="rounded-lg border border-line bg-surface-elevated px-2.5 py-1 text-xs font-semibold text-ink hover:bg-slate-100 hover:text-blue-600 transition-colors"
                              title="Edit Details"
                            >
                              Edit
                            </Link>
                            {user.id === currentUserId ? (
                              <span className="text-[11px] text-ink-mute px-1.5">Current</span>
                            ) : (
                              <Button
                                size="sm"
                                variant={user.active ? 'secondary' : 'primary'}
                                disabled={actionPendingId === user.id}
                                onClick={() => handleToggleActive(user)}
                              >
                                {actionPendingId === user.id
                                  ? 'Saving…'
                                  : user.active
                                    ? 'Deactivate'
                                    : 'Reactivate'}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Backend Pagination Bar */}
          <div className="p-4 border-t border-line bg-surface flex flex-wrap items-center justify-between gap-4 text-xs">
            {/* Range & Page Size Info */}
            <div className="flex items-center gap-3">
              <span className="text-ink-mute">
                Showing <strong className="text-ink font-semibold">{startRecord}</strong> to{' '}
                <strong className="text-ink font-semibold">{endRecord}</strong> of{' '}
                <strong className="text-ink font-semibold">{pagination.totalItems}</strong> staff users
              </span>

              <div className="flex items-center gap-1.5 pl-3 border-l border-line">
                <span className="text-ink-mute">Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const newSize = Number(e.target.value);
                    setPageSize(newSize);
                    setPage(1);
                  }}
                  className="rounded border border-line bg-surface-elevated px-2 py-1 text-xs font-medium text-ink focus:border-blue-600 focus:outline-none"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>

            {/* Page Navigation */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={!pagination.hasPrev || isLoading}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="flex items-center gap-1 rounded-md border border-line px-3 py-1.5 font-medium transition-colors hover:bg-surface-elevated disabled:opacity-40 disabled:pointer-events-none"
              >
                <span>←</span>
                <span>Previous</span>
              </button>

              {/* Page Number Chips */}
              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    return (
                      p === 1 ||
                      p === pagination.totalPages ||
                      Math.abs(p - pagination.page) <= 1
                    );
                  })
                  .map((p, idx, arr) => {
                    const prevP = arr[idx - 1];
                    const showEllipsis = prevP && p - prevP > 1;
                    return (
                      <div key={p} className="flex items-center gap-1">
                        {showEllipsis && <span className="text-ink-mute px-1">…</span>}
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => setPage(p)}
                          className={`h-7 min-w-[28px] rounded px-2 text-xs font-bold transition-colors ${
                            pagination.page === p
                              ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-700 font-semibold'
                              : 'border border-line bg-white text-ink hover:bg-surface-elevated'
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
                onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                className="flex items-center gap-1 rounded-md border border-line px-3 py-1.5 font-medium transition-colors hover:bg-surface-elevated disabled:opacity-40 disabled:pointer-events-none"
              >
                <span>Next</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </Card>

        {/* Role Permissions Card */}
        <Card className="mt-3 p-4">
          <CardHeading>What each role can reach</CardHeading>
          {ROLES.map((role) => (
            <div
              key={role}
              className="flex items-baseline justify-between gap-3 border-b border-dashed border-line-soft py-1.5 text-sm last:border-0"
            >
              <span className="font-bold">{ROLE_LABEL[role]}</span>
              <span className="text-right text-ink-mute">{ROLE_BLURB[role]}</span>
            </div>
          ))}
          <div className="mt-3">
            <Note>
              Scope is enforced on every read and write, not just hidden in
              the menu — a manager cannot reach another area&rsquo;s records
              even by editing the address bar.
            </Note>
          </div>
        </Card>

        {/* Sleek Floating Bottom Loader */}
        {isLoading && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300">
            <div className="flex items-center gap-3 rounded-full border border-navy-800 bg-navy-950/95 px-5 py-2.5 text-xs font-semibold text-white shadow-2xl backdrop-blur-md ring-1 ring-white/10">
              <div className="relative flex h-4 w-4 items-center justify-center">
                <span className="absolute h-full w-full animate-ping rounded-full bg-sky-400 opacity-40" />
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              </div>
              <span className="tracking-wide">Updating users from database…</span>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          </div>
        )}

        </div>
    </>
  );
}
