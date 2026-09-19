import clsx from 'clsx';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { EmptyTableRow } from './TableCard';

export interface DataTableColumn<T> {
  id: string;
  header: ReactNode;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  sortKey?: string;
  className?: string;
  headerClassName?: string;
  render: (item: T, index: number) => ReactNode;
}

export type Column<T> = DataTableColumn<T>;

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor?: (item: T, index: number) => string;
  emptyMessage?: string;
  itemLabel?: string; // e.g. "customers", "entries", "staff", "schedules"
  loading?: boolean;

  // Sorting
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (columnId: string) => void;

  // Pagination
  page?: number;
  pageSize?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  pageSizeElement?: ReactNode;
  buildPageUrl?: (page: number) => string;

  className?: string;
}

/**
 * Full-featured reusable DataTable matching Image 2.
 * Used for full-page listings (Customers, Staff, Invoices, Schedule, Inventory, Managers, etc.)
 */
export function DataTable<T>({
  columns,
  data,
  keyExtractor = (_, idx) => String(idx),
  emptyMessage = 'No records found.',
  itemLabel = 'entries',
  loading = false,

  sortColumn,
  sortDirection,
  onSort,

  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  pageSizeElement,
  buildPageUrl,

  className,
}: DataTableProps<T>) {
  const isLoading = loading;

  const hasPagination = page !== undefined && totalItems !== undefined && pageSize !== undefined;
  const currentPage = page ?? 1;
  const currentPageSize = pageSize ?? (data.length || 1);
  const totalPages = hasPagination && pageSize ? Math.max(1, Math.ceil(totalItems / pageSize)) : 1;
  const startItem = hasPagination && pageSize ? (totalItems === 0 ? 0 : (currentPage - 1) * currentPageSize + 1) : 1;
  const endItem = hasPagination && pageSize ? Math.min(totalItems, currentPage * currentPageSize) : data.length;

  const alignClass = (align?: 'left' | 'center' | 'right') => {
    if (align === 'center') return 'text-center';
    if (align === 'right') return 'text-right';
    return 'text-left';
  };

  // Build smart pagination page array with ellipsis
  const paginationPages = hasPagination
    ? Array.from({ length: totalPages }, (_, i) => i + 1)
        .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
        .reduce<(number | '...')[]>((acc, p, idx, arr) => {
          if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
            acc.push('...');
          }
          acc.push(p);
          return acc;
        }, [])
    : [];

  return (
    <div className={clsx('relative space-y-4 min-w-0', className)}>
      <div className="relative overflow-hidden min-w-0 rounded-2xl border border-line-soft bg-white shadow-sm">
        {/* Top Loading Progress Bar */}
        {isLoading && (
          <div className="absolute top-0 left-0 right-0 z-30 h-1 overflow-hidden rounded-t-2xl bg-blue-50">
            <div className="h-full w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600 animate-[shimmer_1.5s_infinite]" />
          </div>
        )}

        {/* Floating loading overlay for refetching */}
        {isLoading && data.length > 0 && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-[0.5px] transition-all">
            <div className="inline-flex items-center gap-2.5 rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-bold text-blue-600 shadow-md animate-in fade-in zoom-in-95 duration-150">
              <svg
                className="h-4 w-4 animate-spin text-blue-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
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
              <span>Loading data...</span>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line-soft bg-slate-50/50 text-[11px] font-semibold uppercase tracking-wider text-ink-mute whitespace-nowrap">
                {columns.map((col) => {
                  const isCurrentSort = (col.sortKey ?? col.id) === sortColumn;
                  const canSort = col.sortable && onSort;

                  return (
                    <th
                      key={col.id}
                      className={clsx(
                        'px-4 py-3 font-semibold',
                        alignClass(col.align),
                        col.headerClassName,
                      )}
                    >
                      {canSort ? (
                        <button
                          type="button"
                          onClick={() => onSort(col.sortKey ?? col.id)}
                          className="inline-flex items-center gap-1 font-semibold uppercase hover:text-navy-950 transition-colors"
                        >
                          <span>{col.header}</span>
                          <span className="text-slate-400">
                            {isCurrentSort ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
                          </span>
                        </button>
                      ) : (
                        col.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody
              className={clsx(
                'divide-y divide-slate-100 transition-opacity duration-150',
                isLoading && data.length > 0 ? 'opacity-60 pointer-events-none' : '',
              )}
            >
              {isLoading && data.length === 0 ? (
                <TableSkeletonRows columnsCount={columns.length} rowsCount={Math.min(pageSize || 5, 6)} />
              ) : data.length > 0 ? (
                data.map((item, rowIdx) => {
                  const globalIdx = (currentPage - 1) * currentPageSize + rowIdx;
                  return (
                    <tr
                      key={keyExtractor(item, globalIdx)}
                      className="transition-colors hover:bg-slate-50/70"
                    >
                      {columns.map((col) => (
                        <td
                          key={col.id}
                          className={clsx(
                            'px-4 py-3 text-slate-700 whitespace-nowrap',
                            alignClass(col.align),
                            col.className,
                          )}
                        >
                          {col.render(item, globalIdx)}
                        </td>
                      ))}
                    </tr>
                  );
                })
              ) : (
                <EmptyTableRow colSpan={columns.length} message={emptyMessage} />
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comprehensive Pagination Footer */}
      {hasPagination || pageSizeElement || onPageSizeChange ? (
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1 text-xs text-slate-500">
          {/* Left: Showing entries info */}
          {hasPagination ? (
            <div>
              Showing <span className="font-semibold text-slate-800">{startItem}</span> to{' '}
              <span className="font-semibold text-slate-800">{endItem}</span> of{' '}
              <span className="font-semibold text-slate-800">{totalItems}</span> {itemLabel}
            </div>
          ) : <div />}

          {/* Center: Pagination numbers */}
          {hasPagination && totalPages > 1 ? (
            <nav className="flex items-center gap-1" aria-label="Pagination">
              {/* Prev button */}
              {buildPageUrl ? (
                <Link
                  href={buildPageUrl((page ?? 1) - 1)}
                  aria-disabled={(page ?? 1) <= 1 || isLoading}
                  className={clsx(
                    'flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors',
                    (page ?? 1) <= 1 || isLoading ? 'pointer-events-none opacity-40' : 'hover:bg-slate-50',
                  )}
                  aria-label="Previous page"
                >
                  ‹
                </Link>
              ) : (
                <button
                  type="button"
                  disabled={(page ?? 1) <= 1 || isLoading}
                  onClick={() => onPageChange?.((page ?? 1) - 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
                  aria-label="Previous page"
                >
                  ‹
                </button>
              )}

              {/* Page numbers with ellipsis */}
              {paginationPages.map((p, idx) => {
                if (p === '...') {
                  return (
                    <span
                      key={`ellipsis-${idx}`}
                      className="flex h-8 w-8 items-center justify-center text-slate-400"
                    >
                      …
                    </span>
                  );
                }

                const isCurrent = p === page;

                return buildPageUrl ? (
                  <Link
                    key={p}
                    href={buildPageUrl(p)}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={clsx(
                      'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition-colors',
                      isCurrent
                        ? 'bg-[#2563EB] text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100',
                      isLoading && !isCurrent ? 'pointer-events-none opacity-60' : '',
                    )}
                  >
                    {p}
                  </Link>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onPageChange?.(p)}
                    disabled={isLoading}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={clsx(
                      'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition-colors',
                      isCurrent
                        ? 'bg-[#2563EB] text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100',
                      isLoading && !isCurrent ? 'opacity-60' : '',
                    )}
                  >
                    {p}
                  </button>
                );
              })}

              {/* Next button */}
              {buildPageUrl ? (
                <Link
                  href={buildPageUrl((page ?? 1) + 1)}
                  aria-disabled={(page ?? 1) >= totalPages || isLoading}
                  className={clsx(
                    'flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors',
                    (page ?? 1) >= totalPages || isLoading ? 'pointer-events-none opacity-40' : 'hover:bg-slate-50',
                  )}
                  aria-label="Next page"
                >
                  ›
                </Link>
              ) : (
                <button
                  type="button"
                  disabled={(page ?? 1) >= totalPages || isLoading}
                  onClick={() => onPageChange?.((page ?? 1) + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
                  aria-label="Next page"
                >
                  ›
                </button>
              )}
            </nav>
          ) : null}

          {/* Right: Rows per page selector */}
          {pageSizeElement ? (
            <div className="ml-auto sm:ml-0 flex items-center gap-1.5">
              {pageSizeElement}
            </div>
          ) : onPageSizeChange ? (
            <div className="ml-auto sm:ml-0 flex items-center gap-1.5">
              <select
                aria-label="Items per page"
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="cursor-pointer rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {pageSizeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt} per page
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Reusable animated skeleton table rows for DataTable and custom table views.
 */
export function TableSkeletonRows({
  columnsCount = 5,
  rowsCount = 5,
}: {
  columnsCount?: number;
  rowsCount?: number;
}) {
  return (
    <>
      {Array.from({ length: rowsCount }).map((_, rIdx) => (
        <tr key={`skel-row-${rIdx}`} className="animate-pulse">
          {Array.from({ length: columnsCount }).map((_, cIdx) => (
            <td key={`skel-col-${cIdx}`} className="px-4 py-3.5">
              <div
                className={clsx(
                  'h-3.5 rounded-md bg-slate-200/80',
                  cIdx === 0
                    ? 'w-20'
                    : cIdx === 1
                    ? 'w-32'
                    : cIdx === columnsCount - 1
                    ? 'w-16 ml-auto'
                    : 'w-24',
                )}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/**
 * Reusable standalone Table Loading Overlay / Spinner for tables across the app.
 */
export function TableLoader({
  label = 'Loading records...',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        'flex items-center justify-center p-8 text-center',
        className,
      )}
    >
      <div className="inline-flex items-center gap-2.5 rounded-full border border-blue-200 bg-white px-4 py-2 text-xs font-bold text-blue-600 shadow-xs">
        <svg
          className="h-4 w-4 animate-spin text-blue-600"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
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
        <span>{label}</span>
      </div>
    </div>
  );
}

