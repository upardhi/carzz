'use client';

import { useMemo, useState } from 'react';
import { IconCalendar } from '@/components/shell/icons';
import { formatDateFull, money } from '@/lib/util/format';
import type { PocketMoneyRequest } from '@/lib/data/types';

function parseDateBadge(dateStr: string) {
  try {
    const d = new Date(dateStr);
    const day = d.getDate();
    const month = d.toLocaleString('en-IN', { month: 'short' });
    return { day, month };
  } catch {
    return { day: '—', month: '—' };
  }
}

export function StaffPocketHistory({
  requests,
}: {
  requests: PocketMoneyRequest[];
}) {
  const [filter, setFilter] = useState<'ALL' | 'CURRENT' | 'PREVIOUS'>('ALL');

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      const time = new Date(r.requestedAt).getTime();
      if (filter === 'CURRENT') {
        return time >= currentMonthStart;
      }
      if (filter === 'PREVIOUS') {
        return time < currentMonthStart;
      }
      return true;
    });
  }, [requests, filter, currentMonthStart]);

  const totalWithdrawn = useMemo(() => {
    return requests
      .filter((r) => r.status === 'APPROVED' || r.status === 'PAID')
      .reduce((sum, r) => sum + r.amount, 0);
  }, [requests]);

  const currentMonthWithdrawn = useMemo(() => {
    return requests
      .filter(
        (r) =>
          (r.status === 'APPROVED' || r.status === 'PAID') &&
          new Date(r.requestedAt).getTime() >= currentMonthStart,
      )
      .reduce((sum, r) => sum + r.amount, 0);
  }, [requests, currentMonthStart]);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
            <IconCalendar width={20} height={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Withdrawal History & Requests</h3>
            <p className="text-xs text-slate-500">
              Total withdrawn: <b className="text-slate-900">{money(totalWithdrawn)}</b> · This month: <b className="text-emerald-700">{money(currentMonthWithdrawn)}</b>
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          {[
            { id: 'ALL', label: 'All Time' },
            { id: 'CURRENT', label: 'Current Month' },
            { id: 'PREVIOUS', label: 'Previous Months' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id as 'ALL' | 'CURRENT' | 'PREVIOUS')}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                filter === tab.id
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-xs font-medium text-slate-400">
          No withdrawal requests found for this filter.
        </p>
      ) : (
        <div className="divide-y divide-slate-100">
          {filtered.map((request) => {
            const badge = parseDateBadge(request.requestedAt);
            return (
              <div
                key={request.id}
                className="flex items-center justify-between gap-4 py-3.5 first:pt-4 last:pb-0"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl border border-blue-100/80 bg-blue-50 text-blue-600">
                    <span className="text-sm font-extrabold leading-none">{badge.day}</span>
                    <span className="text-[10px] font-bold uppercase leading-tight mt-0.5">
                      {badge.month}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-black text-slate-900">
                      {money(request.amount)}
                    </div>
                    <div className="text-[11.5px] text-slate-500 font-medium truncate mt-0.5">
                      Requested {formatDateFull(request.requestedAt)}
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      request.status === 'PAID'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : request.status === 'APPROVED'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : request.status === 'PENDING'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {request.status === 'PAID'
                      ? 'Paid'
                      : request.status === 'APPROVED'
                        ? 'Approved (Pending Payout)'
                        : request.status === 'PENDING'
                          ? 'Awaiting Manager'
                          : 'Rejected'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
