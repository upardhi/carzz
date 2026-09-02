import clsx from 'clsx';
import type { ReactNode } from 'react';
import { TablePagination, EmptyTableRow } from './TableCard';

export interface WidgetTableColumn<T> {
  id: string;
  header: ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
  headerClassName?: string;
  render: (item: T, index: number) => ReactNode;
}

export interface WidgetTableProps<T> {
  title?: ReactNode;
  action?: ReactNode;
  columns: WidgetTableColumn<T>[];
  data: T[];
  keyExtractor?: (item: T, index: number) => string;
  emptyMessage?: string;
  pageSize?: number;
  page?: number;
  onPageChange?: (page: number) => void;
  className?: string;
}

/**
 * Reusable Widget Table (Card Table) matching Image 1.
 * Used for dashboard widgets, summary tables, and compact card listings.
 */
export function WidgetTable<T>({
  title,
  action,
  columns,
  data,
  keyExtractor = (_, idx) => String(idx),
  emptyMessage = 'No entries found.',
  pageSize,
  page,
  onPageChange,
  className,
}: WidgetTableProps<T>) {
  const isControlled = page !== undefined && onPageChange !== undefined;
  const currentPage = page ?? 1;
  const totalItems = data.length;
  const startIndex = isControlled && pageSize ? (currentPage - 1) * pageSize : 0;
  const displayedData = pageSize
    ? data.slice(startIndex, startIndex + pageSize)
    : data;

  const alignClass = (align?: 'left' | 'center' | 'right') => {
    if (align === 'center') return 'text-center';
    if (align === 'right') return 'text-right';
    return 'text-left';
  };

  return (
    <div
      className={clsx(
        'flex flex-col justify-between rounded-2xl border border-line-soft bg-white p-5 shadow-sm',
        className,
      )}
    >
      <div>
        {/* Header with Title and Action Link */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-extrabold text-navy-950">{title}</h2>
          {action ? <div>{action}</div> : null}
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line-soft text-[11px] font-bold uppercase tracking-wider text-ink-mute">
                {columns.map((col) => (
                  <th
                    key={col.id}
                    className={clsx(
                      'pb-2.5 font-extrabold',
                      alignClass(col.align),
                      col.headerClassName,
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {displayedData.map((item, rowIdx) => (
                <tr
                  key={keyExtractor(item, startIndex + rowIdx)}
                  className="transition-colors hover:bg-slate-50/60"
                >
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className={clsx(
                        'py-2.5 pr-3 text-slate-600',
                        alignClass(col.align),
                        col.className,
                      )}
                    >
                      {col.render(item, startIndex + rowIdx)}
                    </td>
                  ))}
                </tr>
              ))}
              {totalItems === 0 ? (
                <EmptyTableRow colSpan={columns.length} message={emptyMessage} />
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer */}
      {isControlled && pageSize && totalItems > pageSize ? (
        <TablePagination
          page={currentPage}
          totalItems={totalItems}
          perPage={pageSize}
          onPageChange={onPageChange}
        />
      ) : null}
    </div>
  );
}
