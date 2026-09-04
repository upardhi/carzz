'use client';

import { useMemo, useState } from 'react';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Tag } from '@/components/ui/primitives';
import { ActionButton } from './ActionButton';
import type { Area, Staff, StaffPayout } from '@/lib/data/types';
import { money } from '@/lib/util/format';

interface Props {
  payouts: StaffPayout[];
  staff: Staff[];
  areas: Area[];
  cycle: string;
}

export function StaffPayoutTable({ payouts, staff, areas, cycle }: Props) {
  const [search, setSearch] = useState('');
  const [selectedArea, setSelectedArea] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [sortColumn, setSortColumn] = useState<string>('net');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
  const areaById = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);

  // Filtering
  const filtered = useMemo(() => {
    return payouts.filter((payout) => {
      const staffName = staffById.get(payout.staffId)?.name ?? '';
      const areaName = areaById.get(payout.areaId)?.name ?? '';

      const matchesSearch =
        !search.trim() ||
        staffName.toLowerCase().includes(search.toLowerCase()) ||
        areaName.toLowerCase().includes(search.toLowerCase());

      const matchesArea = selectedArea === 'ALL' || payout.areaId === selectedArea;
      const matchesStatus =
        selectedStatus === 'ALL' || payout.status === selectedStatus;

      return matchesSearch && matchesArea && matchesStatus;
    });
  }, [payouts, search, selectedArea, selectedStatus, staffById, areaById]);

  // Sorting
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';

      switch (sortColumn) {
        case 'staff':
          valA = (staffById.get(a.staffId)?.name ?? '').toLowerCase();
          valB = (staffById.get(b.staffId)?.name ?? '').toLowerCase();
          break;
        case 'area':
          valA = (areaById.get(a.areaId)?.name ?? '').toLowerCase();
          valB = (areaById.get(b.areaId)?.name ?? '').toLowerCase();
          break;
        case 'washes':
          valA = a.washes;
          valB = b.washes;
          break;
        case 'base':
          valA = a.base;
          valB = b.base;
          break;
        case 'bonuses':
          valA = a.bonuses;
          valB = b.bonuses;
          break;
        case 'referrals':
          valA = a.referrals;
          valB = b.referrals;
          break;
        case 'deductions':
          valA = a.deductions;
          valB = b.deductions;
          break;
        case 'pocket':
          valA = a.pocketTaken;
          valB = b.pocketTaken;
          break;
        case 'net':
          valA = a.net;
          valB = b.net;
          break;
        case 'status':
          valA = a.status;
          valB = b.status;
          break;
        default:
          valA = a.net;
          valB = b.net;
      }

      if (typeof valA === 'string') {
        return sortDirection === 'asc'
          ? (valA as string).localeCompare(valB as string)
          : (valB as string).localeCompare(valA as string);
      }
      return sortDirection === 'asc'
        ? (valA as number) - (valB as number)
        : (valB as number) - (valA as number);
    });
  }, [filtered, sortColumn, sortDirection, staffById, areaById]);

  function handleSort(columnId: string) {
    if (sortColumn === columnId) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(columnId);
      setSortDirection('desc');
    }
    setPage(1);
  }

  // Paginated slice (20 per page default)
  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  const columns: DataTableColumn<StaffPayout>[] = [
    {
      id: 'staff',
      header: 'STAFF',
      sortable: true,
      className: 'font-bold text-navy-950',
      render: (payout) => staffById.get(payout.staffId)?.name ?? '—',
    },
    {
      id: 'area',
      header: 'AREA',
      sortable: true,
      render: (payout) => areaById.get(payout.areaId)?.name ?? '—',
    },
    {
      id: 'washes',
      header: 'WASHES',
      align: 'center',
      sortable: true,
      render: (payout) => payout.washes,
    },
    {
      id: 'base',
      header: 'BASE',
      sortable: true,
      render: (payout) => money(payout.base),
    },
    {
      id: 'bonuses',
      header: 'BONUSES',
      sortable: true,
      render: (payout) =>
        payout.bonuses ? (
          <span className="font-semibold text-emerald-600">+{money(payout.bonuses)}</span>
        ) : (
          '—'
        ),
    },
    {
      id: 'referrals',
      header: 'REFERRALS',
      sortable: true,
      render: (payout) =>
        payout.referrals ? (
          <span className="font-semibold text-emerald-600">+{money(payout.referrals)}</span>
        ) : (
          '—'
        ),
    },
    {
      id: 'deductions',
      header: 'DEDUCTIONS',
      sortable: true,
      render: (payout) =>
        payout.deductions ? (
          <span className="font-semibold text-rose-600">−{money(payout.deductions)}</span>
        ) : (
          '—'
        ),
    },
    {
      id: 'pocket',
      header: 'POCKET TAKEN',
      sortable: true,
      render: (payout) =>
        payout.pocketTaken ? `−${money(payout.pocketTaken)}` : '—',
    },
    {
      id: 'net',
      header: 'NET PAYABLE',
      sortable: true,
      className: 'font-extrabold text-slate-900',
      render: (payout) => money(payout.net),
    },
    {
      id: 'status',
      header: 'STATUS',
      sortable: true,
      render: (payout) => (
        <Tag
          tone={
            payout.status === 'APPROVED'
              ? 'ok'
              : payout.status === 'HELD'
                ? 'bad'
                : 'warn'
          }
        >
          {payout.status === 'DRAFT' ? 'Awaiting' : payout.status}
        </Tag>
      ),
    },
    {
      id: 'action',
      header: 'ACTION',
      render: (payout) =>
        payout.status === 'DRAFT' ? (
          <div className="flex gap-1.5">
            <ActionButton
              endpoint="/api/admin/payout"
              payload={{
                action: 'approveOne',
                staffId: payout.staffId,
                cycle,
              }}
            >
              Approve
            </ActionButton>
            <ActionButton
              endpoint="/api/admin/payout"
              variant="secondary"
              payload={{ action: 'hold', staffId: payout.staffId, cycle }}
            >
              Hold
            </ActionButton>
          </div>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
  ];

  return (
    <div className="rounded-2xl border border-line-soft bg-white p-5 shadow-sm space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3 min-w-[240px]">
          <div className="relative flex-1">
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by staff name or area..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-ink placeholder:text-ink-mute shadow-2xs focus:border-navy-800 focus:outline-none focus:ring-1 focus:ring-navy-800"
            />
          </div>

          {areas.length > 1 ? (
            <select
              value={selectedArea}
              onChange={(e) => {
                setSelectedArea(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by area"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs focus:border-navy-800 focus:outline-none"
            >
              <option value="ALL">All areas ({areas.length})</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          ) : null}

          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            aria-label="Filter by status"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs focus:border-navy-800 focus:outline-none"
          >
            <option value="ALL">All statuses</option>
            <option value="DRAFT">Awaiting approval</option>
            <option value="APPROVED">Approved</option>
            <option value="HELD">Held</option>
          </select>
        </div>
      </div>

      {/* Main Data Table with 20 per page default */}
      <DataTable<StaffPayout>
        columns={columns}
        data={paginatedData}
        keyExtractor={(payout) => payout.id}
        itemLabel="staff payouts"
        emptyMessage="No staff payouts match your filter."
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        page={page}
        pageSize={pageSize}
        totalItems={sorted.length}
        onPageChange={setPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPage(1);
        }}
        pageSizeOptions={[10, 20, 50, 100]}
      />
    </div>
  );
}
