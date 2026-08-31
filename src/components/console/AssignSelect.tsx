'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Inline reassignment — the absence-cover action, one control per row. */
export function AssignSelect({
  visitId,
  current,
  staff,
}: {
  visitId: string;
  current: string | null;
  staff: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function assign(next: string) {
    const previous = value;
    setValue(next);
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/ops/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign',
          visitId,
          staffId: next || null,
        }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setValue(previous);
        setError(data.error ?? 'Could not assign.');
        return;
      }
      router.refresh();
    } catch {
      setValue(previous);
      setError('No connection.');
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-0.5">
      <select
        aria-label="Assign wash boy"
        disabled={pending}
        value={value}
        onChange={(e) => assign(e.target.value)}
        className={`rounded-md border px-2 py-1 text-[12.5px] font-semibold ${
          value
            ? 'border-line-strong bg-white text-ink'
            : 'border-danger-300 bg-danger-50 text-danger-600'
        }`}
      >
        <option value="">Unassigned</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {error ? (
        <span className="text-[10.5px] font-semibold text-danger-500">{error}</span>
      ) : null}
    </span>
  );
}
