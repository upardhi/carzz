'use client';

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

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor?: (item: T, index: number) => string;
  emptyMessage?: string;
  itemLabel?: string; // e.g. "customers", "entries", "staff", "schedules"

  // Sorting
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (columnId: string) => void;

  // Pagination
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
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

  sortColumn,
  sortDirection,
  onSort,

  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  buildPageUrl,

  className,
}: DataTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, page * pageSize);

  const alignClass = (align?: 'left' | 'center' | 'right') => {
    if (align === 'center') return 'text-center';
    if (align === 'right') return 'text-right';
    return 'text-left';
  };

  // Build smart pagination page array with ellipsis
  const paginationPages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
    .reduce<(number | '...')[]>((acc, p, idx, arr) => {
      if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
        acc.push('...');
      }
      acc.push(p);
      return acc;
    }, []);

  return (
    <div className={clsx('space-y-4', className)}>
      <div className="overflow-hidden rounded-2xl border border-line-soft bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line-soft bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-ink-mute">
                {columns.map((col) => {
                  const isCurrentSort = (col.sortKey ?? col.id) === sortColumn;
                  const canSort = col.sortable && onSort;

                  return (
                    <th
                      key={col.id}
                      className={clsx(
                        'px-4 py-3 font-extrabold',
                        alignClass(col.align),
                        col.headerClassName,
                      )}
                    >
                      {canSort ? (
                        <button
                          type="button"
                          onClick={() => onSort(col.sortKey ?? col.id)}
                          className="inline-flex items-center gap-1 font-extrabold uppercase hover:text-navy-950 transition-colors"
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
            <tbody className="divide-y divide-slate-100">
              {data.map((item, rowIdx) => (
                <tr
                  key={keyExtractor(item, (page - 1) * pageSize + rowIdx)}
                  className="transition-colors hover:bg-slate-50/70"
                >
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className={clsx(
                        'px-4 py-3 text-slate-700',
                        alignClass(col.align),
                        col.className,
                      )}
                    >
                      {col.render(item, (page - 1) * pageSize + rowIdx)}
                    </td>
                  ))}
                </tr>
              ))}
              {data.length === 0 ? (
                <EmptyTableRow colSpan={columns.length} message={emptyMessage} />
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comprehensive Pagination Footer matching Image 2 */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-1 text-xs text-slate-500">
        {/* Left: Showing entries info */}
        <div>
          Showing <span className="font-semibold text-slate-800">{startItem}</span> to{' '}
          <span className="font-semibold text-slate-800">{endItem}</span> of{' '}
          <span className="font-semibold text-slate-800">{totalItems}</span> {itemLabel}
        </div>

        {/* Center: Pagination numbers */}
        {totalPages > 1 ? (
          <nav className="flex items-center gap-1" aria-label="Pagination">
            {/* Prev button */}
            {buildPageUrl ? (
              <Link
                href={buildPageUrl(page - 1)}
                aria-disabled={page <= 1}
                className={clsx(
                  'flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors',
                  page <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-slate-50',
                )}
                aria-label="Previous page"
              >
                ‹
              </Link>
            ) : (
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => onPageChange?.(page - 1)}
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
                  )}
                >
                  {p}
                </Link>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange?.(p)}
                  aria-current={isCurrent ? 'page' : undefined}
                  className={clsx(
                    'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition-colors',
                    isCurrent
                      ? 'bg-[#2563EB] text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100',
                  )}
                >
                  {p}
                </button>
              );
            })}

            {/* Next button */}
            {buildPageUrl ? (
              <Link
                href={buildPageUrl(page + 1)}
                aria-disabled={page >= totalPages}
                className={clsx(
                  'flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors',
                  page >= totalPages ? 'pointer-events-none opacity-40' : 'hover:bg-slate-50',
                )}
                aria-label="Next page"
              >
                ›
              </Link>
            ) : (
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => onPageChange?.(page + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
                aria-label="Next page"
              >
                ›
              </button>
            )}
          </nav>
        ) : null}

        {/* Right: Rows per page selector */}
        {onPageSizeChange ? (
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
    </div>
  );
}
