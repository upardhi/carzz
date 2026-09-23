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
    <div className="space-y-4">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-800">Weekly Wash Days *</label>
            <p className="text-xs text-slate-500">Pick which days this car gets washed — it repeats every week on its own.</p>
          </div>
        </div>

        {pkg && (
          <div className="inline-flex items-center gap-2 self-start sm:self-auto rounded-xl sm:rounded-full bg-blue-50/90 px-3.5 py-1.5 text-xs font-medium text-blue-700 border border-blue-200/80 shadow-2xs shrink-0">
            <svg className="h-3.5 w-3.5 shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="leading-snug">
              {isExactWeekly
                ? `This package is billed ${pkg.washesPerPeriod || 1} wash${(pkg.washesPerPeriod || 1) === 1 ? '' : 'es'}/week — pick ${maxDays} day${maxDays === 1 ? '' : 's'}.`
                : `This package (${pkg.washesPerMonth}/month) allows up to ${maxDays} day${maxDays === 1 ? '' : 's'} per week.`}
            </span>
          </div>
        )}
      </div>

      {/* 7-Day Responsive Cards with Flex Wrap */}
      <div className="flex flex-wrap gap-2.5 sm:gap-3">
        {WEEKDAYS.map((day) => {
          const checked = weeklyDays.includes(day);
          const disabled = !checked && atLimit;
          const selectedService = dayServices[day] || '';

          return (
            <div
              key={day}
              onClick={() => {
                if (!disabled) toggleDay(day);
              }}
              className={`group flex flex-1 min-w-[130px] sm:min-w-[140px] flex-col justify-between rounded-xl border p-3 transition-all ${
                checked
                  ? 'border-blue-500 bg-blue-50/40 shadow-xs ring-1 ring-blue-500/20'
                  : disabled
                  ? 'border-slate-200 bg-slate-50/60 opacity-55 cursor-not-allowed'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50 cursor-pointer'
              }`}
            >
              {/* Day & Checkbox Header */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <input
                  type="checkbox"
                  id={`weekday-${day}`}
                  checked={checked}
                  disabled={disabled}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleDay(day);
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed cursor-pointer"
                />
                <label
                  htmlFor={`weekday-${day}`}
                  className={`text-sm font-bold ${
                    checked ? 'text-blue-900' : disabled ? 'text-slate-400' : 'text-slate-700 group-hover:text-slate-900'
                  } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {WEEKDAY_SHORT[day]}
                </label>
              </div>

              {/* Service Select Dropdown */}
              <div onClick={(e) => e.stopPropagation()}>
                {serviceOptions.length > 0 ? (
                  <select
                    value={checked ? selectedService : ''}
                    disabled={!checked}
                    onChange={(e) => setDayService(day, e.target.value)}
                    className={`w-full rounded-lg border px-2 py-1.5 text-xs font-medium focus:outline-none transition-colors ${
                      checked
                        ? 'border-blue-200 bg-white text-slate-800 shadow-2xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                        : 'border-slate-200 bg-slate-100/60 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <option value="">{checked ? 'Full package' : 'Select'}</option>
                    {serviceOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div
                    className={`w-full rounded-lg border px-2 py-1.5 text-center text-xs font-medium truncate ${
                      checked
                        ? 'border-blue-200 bg-white text-blue-800 shadow-2xs'
                        : 'border-slate-200 bg-slate-100/60 text-slate-400'
                    }`}
                  >
                    Full package
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info & Counter Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-xs text-blue-900">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            {pkg
              ? `You can select up to ${maxDays} days per week (${pkg.washesPerMonth} washes/month).`
              : `You can select up to ${maxDays} days per week.`}
          </span>
        </div>
        <div className="self-end sm:self-auto">
          <span className="inline-flex items-center rounded-full bg-blue-100/80 px-2.5 py-0.5 text-xs font-bold text-blue-700">
            {weeklyDays.length}/{maxDays} selected
          </span>
        </div>
      </div>

      {/* Selected Services Chips Section */}
      {weeklyDays.length > 0 && (
        <div className="space-y-2 pt-1">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Selected Services</h4>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.filter((d) => weeklyDays.includes(d)).map((day) => {
              const service = dayServices[day] || 'Full package service';
              return (
                <div
                  key={day}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-2xs"
                >
                  <svg className="h-3.5 w-3.5 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="font-bold text-slate-800">{WEEKDAY_LABEL[day]}</span>
                  <span className="text-slate-300">•</span>
                  <span className="font-medium text-blue-600">{service}</span>
                  <button
                    type="button"
                    onClick={() => toggleDay(day)}
                    className="ml-1 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                    title={`Remove ${WEEKDAY_LABEL[day]}`}
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Day Limit Warning Alert */}
      {atLimit && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-800">
          <svg className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-semibold text-amber-900">Day limit reached for this package — uncheck a day to pick another.</p>
            {pkg && <p className="mt-0.5 text-amber-700">This package includes {pkg.washesPerMonth} washes/month.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
