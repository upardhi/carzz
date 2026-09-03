'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition, type ReactNode } from 'react';
import clsx from 'clsx';
import { IconSearch } from '@/components/shell/icons';

export interface FilterSpec {
  name: string;
  label: string;
  icon?: ReactNode;
  options: { value: string; label: string }[];
}

/**
 * Filters kept in the URL rather than component state.
 * Omit any filter with no options ("if there is not data then dont show that option").
 */
export function Filters({
  filters,
  search,
}: {
  filters: FilterSpec[];
  search?: { name: string; placeholder: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(name: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    // Any filter change invalidates the current page of results.
    next.delete('page');
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  }

  // Filter out any filter categories that have no options
  const activeFilters = filters.filter((f) => f.options && f.options.length > 0);

  return (
    <div
      className={clsx(
        'flex flex-wrap items-center justify-between gap-2.5 transition-opacity',
        pending ? 'opacity-60 pointer-events-none' : ''
      )}
      aria-busy={pending}
    >
      <div className="flex flex-wrap items-center gap-2">
        {activeFilters.map((filter) => {
          const val = params.get(filter.name) ?? '';
          const selectedOption = filter.options.find((o) => o.value === val);
          const hasSelection = Boolean(val);
          const displayLabel = selectedOption
            ? selectedOption.label
            : filter.label;

          return (
            <div
              key={filter.name}
              className={clsx(
                'relative flex items-center rounded-lg border bg-white px-2.5 py-1.5 text-xs font-semibold shadow-xs transition-colors hover:border-slate-300',
                hasSelection
                  ? 'border-blue-500 bg-blue-50/40 text-blue-700'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50/50'
              )}
            >
              {filter.icon ? (
                <span
                  className={clsx(
                    'mr-1.5 shrink-0',
                    hasSelection ? 'text-blue-600' : 'text-slate-400'
                  )}
                >
                  {filter.icon}
                </span>
              ) : null}

              <span className="truncate max-w-[130px]">{displayLabel}</span>

              <svg
                className={clsx(
                  'ml-1.5 h-3.5 w-3.5 shrink-0',
                  hasSelection ? 'text-blue-500' : 'text-slate-400'
                )}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>

              <select
                aria-label={filter.label}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                value={val}
                onChange={(e) => update(filter.name, e.target.value)}
              >
                <option value="">{filter.label}</option>
                {filter.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {search ? (
        <div className="relative min-w-[240px] flex-1 sm:max-w-xs ml-auto">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <IconSearch width={14} height={14} />
          </div>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-9 pr-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-xs"
            placeholder={search.placeholder}
            defaultValue={params.get(search.name) ?? ''}
            onChange={(e) => update(search.name, e.target.value)}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Page size selector component for bottom pagination.
 */
export function PageSizeSelect({
  value = 20,
}: {
  value?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function onChange(nextLimit: string) {
    const next = new URLSearchParams(params.toString());
    next.set('limit', nextLimit);
    next.delete('page');
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  }

  return (
    <div className="relative inline-flex items-center rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 shadow-xs">
      <span>{value} per page</span>
      <svg
        className="ml-1.5 h-3.5 w-3.5 text-slate-400"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
          clipRule="evenodd"
        />
      </svg>
      <select
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        aria-label="Items per page"
      >
        <option value="10">10 per page</option>
        <option value="20">20 per page</option>
        <option value="50">50 per page</option>
        <option value="100">100 per page</option>
      </select>
    </div>
  );
}

