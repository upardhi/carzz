'use client';

import { WEEKDAYS, type Weekday, type DayServices } from '@/lib/data/types';
import { WEEKDAY_SHORT } from '@/lib/util/labels';

/**
 * Picks which weekdays a car gets washed on, recurring every week, and
 * optionally which named service runs on each day (e.g. Monday = full
 * pressure wash, Thursday = interior vacuum only). Replaces the old
 * "pick N exact one-off dates" flow — the package's monthly wash count still
 * caps how many of these weekly slots actually get delivered and billed.
 */
export function WeeklyScheduleEditor({
  weeklyDays,
  dayServices,
  serviceOptions,
  washesPerMonth,
  onChange,
}: {
  weeklyDays: Weekday[];
  dayServices: DayServices;
  serviceOptions: string[];
  washesPerMonth?: number;
  onChange: (next: { weeklyDays: Weekday[]; dayServices: DayServices }) => void;
}) {
  function toggleDay(day: Weekday) {
    const isOn = weeklyDays.includes(day);
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
      </p>
      <div className="space-y-1.5">
        {WEEKDAYS.map((day) => {
          const checked = weeklyDays.includes(day);
          return (
            <div
              key={day}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
                checked ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200'
              }`}
            >
              <input
                type="checkbox"
                id={`weekday-${day}`}
                checked={checked}
                onChange={() => toggleDay(day)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor={`weekday-${day}`} className="w-16 font-bold text-slate-700 cursor-pointer">
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
          {washesPerMonth ? ` · package includes ${washesPerMonth}/month` : ''}.
        </p>
      )}
    </div>
  );
}
