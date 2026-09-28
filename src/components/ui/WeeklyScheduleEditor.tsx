'use client';

import { WEEKDAYS, maxWeeklyDaysForPackage, type BillingPeriod, type Weekday, type DayServices } from '@/lib/data/types';
import { WEEKDAY_LABEL, WEEKDAY_SHORT } from '@/lib/util/labels';

interface PackageFrequency {
  washesPerMonth: number;
  billingPeriod?: BillingPeriod;
  washesPerPeriod?: number;
}

export function WeeklyScheduleEditor({
  weeklyDays,
  dayServices,
  serviceOptions,
  pkg,
  onChange,
}: {
  weeklyDays: Weekday[];
  dayServices: DayServices;
  serviceOptions: string[];
  pkg?: PackageFrequency;
  onChange: (next: { weeklyDays: Weekday[]; dayServices: DayServices }) => void;
}) {
  const maxDays = pkg ? maxWeeklyDaysForPackage(pkg) : 7;
  const atLimit = weeklyDays.length >= maxDays;
  const isExactWeekly = pkg?.billingPeriod === 'WEEKLY';

  function toggleDay(day: Weekday) {
    const isOn = weeklyDays.includes(day);
    if (!isOn && atLimit) return;
    const nextDays = isOn ? weeklyDays.filter((d) => d !== day) : [...weeklyDays, day];
    const nextServices = { ...dayServices };
    if (isOn) delete nextServices[day];
    onChange({ weeklyDays: nextDays, dayServices: nextServices });
  }

  function setDayService(day: Weekday, service: string) {
    const nextServices = { ...dayServices };
    if (service) nextServices[day] = service;
    else delete nextServices[day];
    onChange({ weeklyDays, dayServices: nextServices });
  }

  return (
    <div className="space-y-3.5">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-900">Weekly Wash Days *</label>
            <p className="text-[11px] text-slate-500">Pick which days this car gets washed — repeats weekly.</p>
          </div>
        </div>

        {pkg && (
          <div className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 border border-blue-200 shadow-2xs">
            <svg className="h-3 w-3 shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>
              {isExactWeekly
                ? `${pkg.washesPerPeriod || 1} wash${(pkg.washesPerPeriod || 1) === 1 ? '' : 'es'}/wk · pick ${maxDays} day${maxDays === 1 ? '' : 's'}`
                : `${pkg.washesPerMonth}/month · up to ${maxDays} day${maxDays === 1 ? '' : 's'}/week`}
            </span>
          </div>
        )}
      </div>

      {/* Modern 7-Column Day Selector Grid */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {WEEKDAYS.map((day) => {
          const checked = weeklyDays.includes(day);
          const disabled = !checked && atLimit;

          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => toggleDay(day)}
              className={`group flex flex-col items-center justify-center py-2.5 px-1 sm:px-2 rounded-xl border transition-all cursor-pointer select-none ${
                checked
                  ? 'border-blue-600 bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/20 active:scale-95'
                  : disabled
                  ? 'border-slate-200 bg-slate-50 text-slate-300 opacity-50 cursor-not-allowed'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/40 hover:text-blue-700 active:scale-95'
              }`}
            >
              <span className={`text-[10px] font-bold uppercase tracking-wider ${checked ? 'text-blue-100' : 'text-slate-400'}`}>
                {WEEKDAY_SHORT[day].slice(0, 1)}
              </span>
              <span className={`text-xs font-bold mt-0.5 ${checked ? 'text-white' : 'text-slate-800'}`}>
                {WEEKDAY_SHORT[day]}
              </span>
              <div className="mt-1 h-3.5 flex items-center justify-center">
                {checked ? (
                  <span className="inline-flex h-3 w-3 items-center justify-center rounded-full bg-white text-blue-600 text-[9px] font-extrabold">
                    ✓
                  </span>
                ) : (
                  <span className={`h-1.5 w-1.5 rounded-full ${disabled ? 'bg-slate-200' : 'bg-slate-300 group-hover:bg-blue-400'}`} />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Info & Counter Pill */}
      <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-xs">
        <span className="text-[11px] text-slate-600">
          {pkg
            ? `You can select up to ${maxDays} days per week (${pkg.washesPerMonth} washes/month).`
            : `You can select up to ${maxDays} days per week.`}
        </span>
        <span
          className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold shrink-0 ${
            weeklyDays.length === maxDays
              ? 'bg-blue-100 text-blue-800 border border-blue-200'
              : weeklyDays.length > 0
              ? 'bg-amber-100 text-amber-800 border border-amber-200'
              : 'bg-slate-200/80 text-slate-600'
          }`}
        >
          {weeklyDays.length}/{maxDays} selected
        </span>
      </div>

      {/* Service Configuration for Selected Days (If custom options exist) */}
      {serviceOptions.length > 0 && weeklyDays.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Selected Days Service Type
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {WEEKDAYS.filter((d) => weeklyDays.includes(d)).map((day) => {
              const selectedService = dayServices[day] || '';
              return (
                <div
                  key={day}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-2xs"
                >
                  <span className="font-bold text-slate-800 flex items-center gap-1.5 shrink-0">
                    <span className="h-2 w-2 rounded-full bg-blue-600" />
                    {WEEKDAY_LABEL[day]}
                  </span>
                  <select
                    value={selectedService}
                    onChange={(e) => setDayService(day, e.target.value)}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
                  >
                    <option value="">Full package</option>
                    {serviceOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
