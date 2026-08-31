'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

export interface FilterSpec {
  name: string;
  label: string;
  options: { value: string; label: string }[];
}

/**
 * Filters kept in the URL rather than component state, so a manager can
 * bookmark "Civil Lines, unpaid, Ajay" and share it with the owner.
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

  return (
    <div
      className={`mb-3 flex flex-wrap gap-2 ${pending ? 'opacity-60' : ''}`}
      aria-busy={pending}
    >
      {filters.map((filter) => (
        <label key={filter.name} className="sr-only-wrapper">
          <span className="sr-only">{filter.label}</span>
          <select
            className="rounded-lg border border-line-strong bg-white px-2.5 py-1.5 text-[13px] font-semibold text-ink"
            value={params.get(filter.name) ?? ''}
            onChange={(e) => update(filter.name, e.target.value)}
          >
            <option value="">{filter.label}</option>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}

      {search ? (
        <input
          className="min-w-[180px] flex-1 rounded-lg border border-line-strong bg-white px-2.5 py-1.5 text-[13px]"
          placeholder={search.placeholder}
          defaultValue={params.get(search.name) ?? ''}
          onChange={(e) => update(search.name, e.target.value)}
        />
      ) : null}
    </div>
  );
}
