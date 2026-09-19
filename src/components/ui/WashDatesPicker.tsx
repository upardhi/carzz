'use client';

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function formatDateDisplay(iso: string): string {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const date = new Date(`${iso}T00:00:00`);
  return `${dayNames[date.getDay()]} ${d} ${months[Number(m) - 1]}`;
}

function autoFillDates(firstDate: string, count: number): string[] {
  // Distribute remaining dates evenly over ~30 days from the first date
  const interval = Math.max(1, Math.round(30 / count));
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(`${firstDate}T00:00:00`);
    d.setDate(d.getDate() + interval * i);
    result.push(d.toISOString().slice(0, 10));
  }
  return result;
}

interface WashDatesPickerProps {
  count: number;
  dates: string[];
  onChange: (dates: string[]) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export function WashDatesPicker({ count, dates, onChange, className = '', size = 'md' }: WashDatesPickerProps) {
  const today = new Date().toISOString().slice(0, 10);
  const filledCount = dates.filter(Boolean).length;
  const allFilled = filledCount === count;

  function updateDate(index: number, value: string) {
    const next = [...dates];
    next[index] = value;

    // When first date is picked and rest are empty, auto-fill all subsequent dates
    if (index === 0 && value) {
      const restAllEmpty = next.slice(1).every((d) => !d);
      if (restAllEmpty) {
        onChange(autoFillDates(value, count));
        return;
      }
    }

    onChange(next);
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className={`font-bold text-slate-700 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>
            Wash Schedule Dates <span className="text-rose-500">*</span>
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Pick the 1st date — rest auto-fill, then edit as needed
          </p>
        </div>
        <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
          allFilled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-50 text-amber-600'
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${allFilled ? 'bg-emerald-500' : 'bg-amber-400'}`} />
          {filledCount}/{count} set
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: count }).map((_, i) => {
          const value = dates[i] ?? '';
          const filled = Boolean(value);
          const isPast = value && value < today;
          const isAutoFilled = i > 0 && filled;

          return (
            <label
              key={i}
              className={`block rounded-xl border-2 cursor-pointer transition-all duration-150 ${
                filled
                  ? isPast
                    ? 'border-amber-300 bg-amber-50'
                    : isAutoFilled
                    ? 'border-blue-300 bg-blue-50/70'
                    : 'border-blue-500 bg-blue-50 shadow-sm shadow-blue-100'
                  : i === 0
                  ? 'border-blue-300 border-dashed bg-blue-50/40 hover:border-blue-500 hover:bg-blue-50'
                  : 'border-slate-200 bg-slate-50/50 hover:border-blue-200'
              }`}
            >
              {/* Top label */}
              <div className={`flex items-center justify-between px-2.5 pt-2 pb-1 rounded-t-xl ${
                filled
                  ? isPast ? 'bg-amber-100/60' : 'bg-blue-100/50'
                  : i === 0 ? 'bg-blue-100/40' : 'bg-slate-100/60'
              }`}>
                <span className={`text-[9px] font-extrabold tracking-widest uppercase ${
                  filled
                    ? isPast ? 'text-amber-600' : 'text-blue-600'
                    : i === 0 ? 'text-blue-500' : 'text-slate-400'
                }`}>
                  {ordinal(i + 1)} Wash
                </span>
                <span className={`text-[8px] font-bold ${
                  filled
                    ? isPast ? 'text-amber-500' : isAutoFilled ? 'text-blue-400' : 'text-blue-600'
                    : i === 0 ? 'text-blue-400' : 'text-slate-300'
                }`}>
                  {filled ? (isAutoFilled ? 'auto ✎' : '✓') : i === 0 ? 'pick first' : '—'}
                </span>
              </div>

              {/* Date display */}
              <div className="px-2.5 pt-1.5 pb-1 min-h-[22px]">
                {filled ? (
                  <p className={`text-[11px] font-semibold leading-snug ${isPast ? 'text-amber-700' : 'text-blue-800'}`}>
                    {formatDateDisplay(value)}
                  </p>
                ) : (
                  <p className={`text-[11px] font-medium ${i === 0 ? 'text-blue-300' : 'text-slate-200'}`}>
                    {i === 0 ? 'Tap to pick...' : 'Auto-fills after 1st'}
                  </p>
                )}
              </div>

              {/* Visible date input */}
              <div className="px-2 pb-2">
                <input
                  type="date"
                  min={today}
                  value={value}
                  onChange={(e) => updateDate(i, e.target.value)}
                  className={`w-full rounded-lg border px-2 py-1.5 text-[10px] font-semibold focus:outline-none focus:ring-2 transition-colors cursor-pointer ${
                    filled
                      ? isPast
                        ? 'border-amber-200 bg-amber-100 text-amber-700 focus:ring-amber-300'
                        : 'border-blue-200 bg-blue-100 text-blue-700 focus:ring-blue-300'
                      : i === 0
                      ? 'border-blue-200 bg-white text-slate-600 focus:ring-blue-300'
                      : 'border-slate-200 bg-white text-slate-400 focus:ring-blue-200'
                  }`}
                />
              </div>
            </label>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${allFilled ? 'bg-emerald-400' : 'bg-blue-400'}`}
          style={{ width: `${count > 0 ? (filledCount / count) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}
