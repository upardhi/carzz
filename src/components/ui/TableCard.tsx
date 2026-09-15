import clsx from 'clsx';
import type { ComponentProps, ReactNode } from 'react';

export interface TableCardProps extends Omit<ComponentProps<'div'>, 'title'> {
  title?: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  noPadding?: boolean;
}

/**
 * Modern card container for data tables with headers, actions, and consistent borders.
 */
export function TableCard({
  title,
  subtitle,
  badge,
  action,
  children,
  noPadding = false,
  className,
  ...rest
}: TableCardProps) {
  const hasHeader = Boolean(title || subtitle || badge || action);

  return (
    <div
      {...rest}
      className={clsx(
        'rounded-2xl border border-line-soft bg-white shadow-sm transition-all',
        !noPadding && 'p-5',
        className,
      )}
    >
      {hasHeader ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {title ? (
              <h2 className="text-base font-semibold text-navy-950">
                {title}
              </h2>
            ) : null}
            {badge ? <div>{badge}</div> : null}
            {subtitle ? (
              <p className="text-xs text-ink-mute">{subtitle}</p>
            ) : null}
          </div>
          {action ? <div className="flex items-center gap-2">{action}</div> : null}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        {children}
      </div>
    </div>
  );
}

export interface TablePaginationProps {
  page: number;
  totalItems: number;
  perPage: number;
  onPageChange: (page: number) => void;
  onPerPageChange?: (perPage: number) => void;
  perPageOptions?: number[];
  className?: string;
}

/**
 * Reusable pagination bar with responsive page numbers, rows-per-page dropdown, and item counter.
 */
export function TablePagination({
  page,
  totalItems,
  perPage,
  onPageChange,
  onPerPageChange,
  perPageOptions = [10, 20, 50],
  className,
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const startItem = totalItems === 0 ? 0 : (page - 1) * perPage + 1;
  const endItem = Math.min(totalItems, page * perPage);

  return (
    <div
      className={clsx(
        'flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-4 text-xs font-semibold text-ink-mute',
        className,
      )}
    >
      <div>
        Showing <span className="font-bold text-navy-950">{startItem}</span> to{' '}
        <span className="font-bold text-navy-950">{endItem}</span> of{' '}
        <span className="font-bold text-navy-950">{totalItems}</span> entries
      </div>

      <div className="flex items-center gap-2">
        {/* Pagination navigation */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-line-soft bg-white text-ink-mute transition-colors hover:bg-slate-50 disabled:opacity-40"
          >
            ‹
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
            .reduce<number[]>((acc, p, idx, arr) => {
              if (idx > 0 && p - arr[idx - 1] > 1) {
                acc.push(-1); // ellipsis placeholder
              }
              acc.push(p);
              return acc;
            }, [])
            .map((p, idx) =>
              p === -1 ? (
                <span key={`ellipsis-${idx}`} className="px-1 text-slate-400">
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  className={clsx(
                    'flex h-7 min-w-[28px] items-center justify-center rounded-lg px-1.5 text-xs font-bold transition-colors',
                    page === p
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'border border-line-soft bg-white text-navy-950 hover:bg-slate-50',
                  )}
                >
                  {p}
                </button>
              ),
            )}

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-line-soft bg-white text-ink-mute transition-colors hover:bg-slate-50 disabled:opacity-40"
          >
            ›
          </button>
        </div>

        {/* Per page selector */}
        {onPerPageChange ? (
          <div className="flex items-center gap-1.5 border-l border-line-soft pl-3">
            <select
              aria-label="Items per page"
              value={perPage}
              onChange={(e) => onPerPageChange(Number(e.target.value))}
              className="cursor-pointer rounded-lg border border-line-soft bg-white px-2 py-1 text-xs font-bold text-navy-950 focus:outline-none"
            >
              {perPageOptions.map((opt) => (
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

/**
 * Full-width empty state table row.
 */
export function EmptyTableRow({
  colSpan,
  message = 'No data found.',
  className,
}: {
  colSpan: number;
  message?: ReactNode;
  className?: string;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className={clsx('py-10 text-center text-xs font-medium text-ink-mute', className)}
      >
        {message}
      </td>
    </tr>
  );
}

/**
 * Full-width loading state table row for any table component.
 */
export function TableLoadingRow({
  colSpan,
  label = 'Loading records...',
}: {
  colSpan: number;
  label?: string;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-10 text-center">
        <div className="flex items-center justify-center p-4 text-center">
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
      </td>
    </tr>
  );
}
