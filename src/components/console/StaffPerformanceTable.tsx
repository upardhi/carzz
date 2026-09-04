'use client';

import { useMemo, useState } from 'react';
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable';
import { Kpi, KpiGrid } from '@/components/ui/primitives';
import type { Area } from '@/lib/data/types';
import type { StaffPerformanceRow } from '@/lib/services/reports';
import { percent } from '@/lib/util/format';

interface Props {
  rows: StaffPerformanceRow[];
  areas: Area[];
  totalStaff: number;
}

export function StaffPerformanceTable({ rows, areas, totalStaff }: Props) {
  const [search, setSearch] = useState('');
  const [selectedArea, setSelectedArea] = useState('ALL');
  const [sortColumn, setSortColumn] = useState<string>('washes');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const areaMap = useMemo(() => new Map(areas.map((a) => [a.id, a.name])), [areas]);

  // Overall KPIs
  const totalWashes = useMemo(() => rows.reduce((s, r) => s + r.washes, 0), [rows]);
  const avgOnTime = useMemo(() => {
    if (!rows.length) return 0;
    return rows.reduce((s, r) => s + r.onTimeRate, 0) / rows.length;
  }, [rows]);
  const ratedRows = useMemo(() => rows.filter((r) => r.averageRating > 0), [rows]);
  const avgRating = useMemo(() => {
    if (!ratedRows.length) return 0;
    return ratedRows.reduce((s, r) => s + r.averageRating, 0) / ratedRows.length;
  }, [ratedRows]);
  const totalComplaints = useMemo(() => rows.reduce((s, r) => s + r.complaints, 0), [rows]);

  // Filter & Search
  const filtered = useMemo(() => {
    return rows.filter((row) => {
      const areaName = areaMap.get(row.areaId) ?? '';
      const matchesSearch =
        !search.trim() ||
        row.name.toLowerCase().includes(search.toLowerCase()) ||
        areaName.toLowerCase().includes(search.toLowerCase());
      const matchesArea = selectedArea === 'ALL' || row.areaId === selectedArea;
      return matchesSearch && matchesArea;
    });
  }, [rows, search, selectedArea, areaMap]);

  // Sorting
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';

      switch (sortColumn) {
        case 'name':
          valA = a.name.toLowerCase();
          valB = b.name.toLowerCase();
          break;
        case 'area':
          valA = (areaMap.get(a.areaId) ?? '').toLowerCase();
          valB = (areaMap.get(b.areaId) ?? '').toLowerCase();
          break;
        case 'washes':
          valA = a.washes;
          valB = b.washes;
          break;
        case 'onTime':
          valA = a.onTimeRate;
          valB = b.onTimeRate;
          break;
        case 'rating':
          valA = a.averageRating;
          valB = b.averageRating;
          break;
        case 'missed':
          valA = a.missed;
          valB = b.missed;
          break;
        case 'complaints':
          valA = a.complaints;
          valB = b.complaints;
          break;
        default:
          valA = a.washes;
          valB = b.washes;
      }

      if (typeof valA === 'string') {
        return sortDirection === 'asc'
          ? (valA as string).localeCompare(valB as string)
          : (valB as string).localeCompare(valA as string);
      }
      return sortDirection === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
  }, [filtered, sortColumn, sortDirection, areaMap]);

  function handleSort(columnId: string) {
    if (sortColumn === columnId) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(columnId);
      setSortDirection('desc');
    }
    setPage(1);
  }

  // Paginated slice
  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  const columns: DataTableColumn<StaffPerformanceRow>[] = [
    {
      id: 'name',
      header: 'WASH BOY',
      sortable: true,
      className: 'font-bold text-navy-950',
      render: (row) => row.name,
    },
    {
      id: 'area',
      header: 'AREA',
      sortable: true,
      render: (row) => areaMap.get(row.areaId) ?? '—',
    },
    {
      id: 'washes',
      header: 'WASHES',
      align: 'center',
      sortable: true,
      render: (row) => <span className="font-bold text-navy-950">{row.washes}</span>,
    },
    {
      id: 'onTime',
      header: 'ON-TIME',
      align: 'center',
      sortable: true,
      render: (row) => (
        <span
          className={
            row.onTimeRate < 0.7 ? 'font-bold text-rose-600' : 'font-semibold text-slate-700'
          }
        >
          {percent(row.onTimeRate)}
        </span>
      ),
    },
    {
      id: 'rating',
      header: 'RATING',
      align: 'center',
      sortable: true,
      render: (row) => (row.averageRating ? `${row.averageRating.toFixed(1)} ★` : '—'),
    },
    {
      id: 'missed',
      header: 'MISSED',
      align: 'center',
      sortable: true,
      render: (row) => row.missed,
    },
    {
      id: 'complaints',
      header: 'COMPLAINTS',
      align: 'right',
      sortable: true,
      render: (row) => (
        <span className={row.complaints > 5 ? 'font-bold text-rose-600' : 'text-slate-700'}>
          {row.complaints}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Top summary KPIs */}
      <KpiGrid columns={5}>
        <Kpi
          label="TOTAL WASH BOYS"
          value={totalStaff}
          tone="purple"
          subtext="Active workforce"
        />
        <Kpi
          label="TOTAL WASHES"
          value={totalWashes}
          tone="blue"
          subtext="Completed this cycle"
        />
        <Kpi
          label="AVG ON-TIME RATE"
          value={percent(avgOnTime)}
          tone={avgOnTime >= 0.8 ? 'emerald' : 'amber'}
          subtext={avgOnTime >= 0.8 ? 'Good punctuality' : 'Needs attention'}
        />
        <Kpi
          label="AVG RATING"
          value={avgRating ? `${avgRating.toFixed(1)} ★` : '—'}
          tone="gold"
          subtext="Customer reviews"
        />
        <Kpi
          label="COMPLAINTS"
          value={totalComplaints}
          tone={totalComplaints > 10 ? 'rose' : 'slate'}
          subtext="Total logged"
        />
      </KpiGrid>

      {/* Main White Card Container with padding containing Search, Table, and Pagination */}
      <div className="rounded-2xl border border-line-soft bg-white p-5 shadow-sm space-y-4">
        {/* Search and Area Filter Bar */}
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
                placeholder="Search by wash boy or area..."
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
          </div>
        </div>

        {/* Main Data Table */}
        <DataTable<StaffPerformanceRow>
          columns={columns}
          data={paginatedData}
          keyExtractor={(row) => row.staffId}
          itemLabel="wash boys"
          emptyMessage="No staff performance records found."
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
    </div>
  );
}
