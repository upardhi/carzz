'use client';

import { WEEKDAYS, maxWeeklyDaysForPackage, type BillingPeriod, type Weekday, type DayServices } from '@/lib/data/types';
import { WEEKDAY_SHORT } from '@/lib/util/labels';

interface PackageFrequency {
  washesPerMonth: number;
  billingPeriod?: BillingPeriod;
  washesPerPeriod?: number;
}

/**
 * Picks which weekdays a car gets washed on, recurring every week, and
 * optionally which named service runs on each day (e.g. Monday = full
 * pressure wash, Thursday = interior vacuum only). Replaces the old
 * "pick N exact one-off dates" flow.
 *
 * The number of days pickable is capped by the package's frequency — a
 * 4-wash/month package can't be spread across all 7 days, or the whole
 * month's quota gets burned in the first week and every week after has
 * nothing scheduled. A package billed "per week" (e.g. "2 washes/week")
 * uses that exact count instead of an approximation.
 */
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

  const perMonth = (weeklyDays.length * 4.345).toFixed(1);

  return (
    <div>
      <label className="block font-bold text-slate-700 mb-1">Weekly Wash Days *</label>
      <p className="text-[11px] text-slate-500 mb-2">
        Pick which days this car gets washed — it repeats every week on its own.
        {pkg ? (
          <>
            {' '}
            {isExactWeekly ? (
              <>This package is billed <b>{pkg.washesPerPeriod} washes/week</b> — pick {pkg.washesPerPeriod} day{maxDays === 1 ? '' : 's'}.</>
            ) : (
              <>This package ({pkg.washesPerMonth}/month) allows up to <b>{maxDays} day{maxDays === 1 ? '' : 's'}/week</b>.</>
            )}
          </>
        ) : null}
      </p>
      <div className="space-y-1.5">
        {WEEKDAYS.map((day) => {
          const checked = weeklyDays.includes(day);
          const disabled = !checked && atLimit;
          return (
            <div
              key={day}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
                checked ? 'border-blue-300 bg-blue-50/50' : disabled ? 'border-slate-100 opacity-50' : 'border-slate-200'
              }`}
            >
              <input
                type="checkbox"
                id={`weekday-${day}`}
                checked={checked}
                disabled={disabled}
                onChange={() => toggleDay(day)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
              />
              <label
                htmlFor={`weekday-${day}`}
                className={`w-16 font-bold text-slate-700 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                {WEEKDAY_SHORT[day]}
              </label>
              {checked && serviceOptions.length > 0 && (
                <select
                  value={dayServices[day] || ''}
                  onChange={(e) => setDayService(day, e.target.value)}
                  className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs bg-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Full package service</option>
                  {serviceOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>
      {weeklyDays.length > 0 && (
        <p className="mt-1.5 text-[11px] text-slate-500">
          ≈ {perMonth} washes/month at this pace
          {pkg ? ` · package includes ${pkg.washesPerMonth}/month` : ''}.
        </p>
      )}
      {atLimit && (
        <p className="mt-1 text-[11px] font-semibold text-amber-600">
          Day limit reached for this package — un-check a day to pick another.
        </p>
      )}
    </div>
  );
}
