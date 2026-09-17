'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface CandidateSlot {
  date: string;
  formattedDate: string;
  dayOfWeek: string;
  isRegularPatternDay: boolean;
  available: boolean;
  reason?: string;
  times: string[];
}

interface WashActionControlsProps {
  visitId: string;
  scheduledDate: string;
  scheduledTime: string;
  carModel: string;
  carPlate: string;
  isHold?: boolean;
  holdUntil?: string | null;
  totalCars?: number;
}

export function WashActionControls({
  visitId,
  scheduledDate,
  scheduledTime,
  carModel,
  carPlate,
  isHold,
  holdUntil,
  totalCars = 1,
}: WashActionControlsProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'skip' | 'reschedule' | 'vacation'>('skip');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Slots
  const [candidateSlots, setCandidateSlots] = useState<CandidateSlot[]>([]);
  const [nextRegularDateFormatted, setNextRegularDateFormatted] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('06:30 AM');
  const [reschedulesRemaining, setReschedulesRemaining] = useState(3);

  // Vacation
  const [vacationDays, setVacationDays] = useState(7);

  const loadSlots = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/customer/wash?visitId=${encodeURIComponent(visitId)}`);
      const data = await res.json();
      if (data.ok) {
        setNextRegularDateFormatted(data.nextRegularDateFormatted || '');
        const slots: CandidateSlot[] = data.candidateSlots || [];
        setCandidateSlots(slots);
        setReschedulesRemaining(data.reschedulesRemaining ?? 3);
        const firstAvail = slots.find((s) => s.available);
        if (firstAvail) {
          setSelectedDate(firstAvail.date);
          if (firstAvail.times?.length) {
            setSelectedTime(firstAvail.times[0]);
          }
        }
      } else {
        setMsg({ type: 'err', text: data.error || 'Could not load slots.' });
      }
    } catch (e: unknown) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Network error loading slots.' });
    } finally {
      setLoading(false);
    }
  }, [visitId]);

  useEffect(() => {
    if (modalOpen && visitId) {
      void loadSlots();
    }
  }, [modalOpen, visitId, loadSlots]);

  const handleSkip = async () => {
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch('/api/customer/wash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'skip', visitId }),
      });
      const data = await res.json();
      if (data.ok) {
        setMsg({ type: 'ok', text: data.message });
        setTimeout(() => {
          setModalOpen(false);
          router.refresh();
        }, 1200);
      } else {
        setMsg({ type: 'err', text: data.error || 'Could not skip wash.' });
      }
    } catch (e: unknown) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Network error.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReschedule = async () => {
    if (!selectedDate) return;
    setSubmitting(true);
    setMsg(null);
    try {
      const res = await fetch('/api/customer/wash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reschedule',
          visitId,
          targetDate: selectedDate,
          targetTime: selectedTime,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setMsg({ type: 'ok', text: data.message });
        setTimeout(() => {
          setModalOpen(false);
          router.refresh();
        }, 1200);
      } else {
        setMsg({ type: 'err', text: data.error || 'Could not reschedule wash.' });
      }
    } catch (e: unknown) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Network error.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVacationPause = async () => {
    setSubmitting(true);
    setMsg(null);
    try {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + vacationDays);
      const dateStr = targetDate.toISOString().slice(0, 10);

      const res = await fetch('/api/customer/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause', holdUntil: dateStr }),
      });
      const data = await res.json();
      if (data.ok) {
        setMsg({ type: 'ok', text: data.message });
        setTimeout(() => {
          setModalOpen(false);
          router.refresh();
        }, 1200);
      } else {
        setMsg({ type: 'err', text: data.error || 'Could not pause subscription.' });
      }
    } catch (e: unknown) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'Network error.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResume = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/customer/hold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume' }),
      });
      const data = await res.json();
      if (data.ok) {
        router.refresh();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Vacation / Hold Banner if active */}
      {isHold && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✈️</span>
            <div>
              <div className="text-sm font-bold text-amber-900">Vacation Mode Active</div>
              <div className="text-xs text-amber-700">
                Washes paused until {holdUntil || 'your return'}. Your wash count is fully preserved.
              </div>
            </div>
          </div>
          <button
            onClick={handleResume}
            disabled={submitting}
            className="rounded-lg bg-amber-700 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-amber-800 disabled:opacity-50"
          >
            {submitting ? 'Resuming...' : 'Resume Early'}
          </button>
        </div>
      )}

      {/* Quick Action Buttons on Next Wash Card */}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => {
            setActiveTab('skip');
            setModalOpen(true);
          }}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 py-2 px-3 text-xs font-bold text-[#0f2347] shadow-2xs transition-colors"
        >
          <span className="text-sky-500 font-bold">⚡</span>
          <span>Skip Wash</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('reschedule');
            setModalOpen(true);
          }}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-[#003893] hover:bg-[#002d75] py-2 px-3 text-xs font-bold text-white shadow-xs transition-colors"
        >
          <span>📅</span>
          <span>Change Date</span>
        </button>
      </div>

      {/* Interactive Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl transition-all">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-navy-950">Manage Wash Schedule</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {carModel} · {carPlate} ({scheduledDate}, {scheduledTime})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-full bg-slate-100 p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Notification Banner */}
            {msg && (
              <div
                className={`mt-3 rounded-xl p-3 text-xs font-semibold ${
                  msg.type === 'ok'
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border border-rose-200 bg-rose-50 text-rose-800'
                }`}
              >
                {msg.text}
              </div>
            )}

            {/* Tabs */}
            <div className="mt-4 flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setActiveTab('skip')}
                className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
                  activeTab === 'skip'
                    ? 'bg-white text-[#214f92] shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ⚡ Skip Wash
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('reschedule')}
                className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
                  activeTab === 'reschedule'
                    ? 'bg-white text-[#214f92] shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🗓️ Pick Date
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('vacation')}
                className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition-all ${
                  activeTab === 'vacation'
                    ? 'bg-white text-[#214f92] shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ✈️ Vacation
              </button>
            </div>

            {/* TAB CONTENT */}
            <div className="mt-4">
              {/* TAB 1: SKIP */}
              {activeTab === 'skip' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5">
                    <div className="text-xs font-bold text-blue-900">
                      Move to next routine slot
                    </div>
                    <div className="text-xs text-blue-700 mt-1">
                      Your wash will not be lost. It will automatically roll over to your next routine schedule date:
                    </div>
                    <div className="mt-2.5 rounded-lg border border-blue-300 bg-white p-2.5 text-xs font-bold text-blue-950">
                      📅 {nextRegularDateFormatted || 'Next routine pattern date'}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2">✓ No loss of paid washes</div>
                    <div className="flex items-center gap-2">✓ Zero route disruption for wash team</div>
                    <div className="flex items-center gap-2">✓ Instant 1-tap confirmation</div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSkip}
                    disabled={submitting}
                    className="w-full rounded-xl bg-[#214f92] py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#1a3f75] disabled:opacity-50"
                  >
                    {submitting ? 'Updating...' : 'Confirm Skip & Reschedule'}
                  </button>
                </div>
              )}

              {/* TAB 2: RESCHEDULE */}
              {activeTab === 'reschedule' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Choose Alternate Date
                    </label>
                    <span className="text-[11px] font-semibold text-emerald-600">
                      {reschedulesRemaining} changes left
                    </span>
                  </div>

                  {loading ? (
                    <div className="py-8 text-center text-xs text-slate-500">
                      Checking staff capacity...
                    </div>
                  ) : (
                    <>
                      {/* Dates scroll list */}
                      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                        {candidateSlots.map((slot) => {
                          const isSelected = selectedDate === slot.date;
                          return (
                            <button
                              key={slot.date}
                              type="button"
                              disabled={!slot.available || submitting}
                              onClick={() => setSelectedDate(slot.date)}
                              className={`flex min-w-[58px] flex-col items-center rounded-xl border p-2.5 transition-all ${
                                isSelected
                                  ? 'border-[#214f92] bg-[#214f92] text-white shadow-sm'
                                  : slot.available
                                  ? 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                                  : 'border-slate-100 bg-slate-100 text-slate-300 opacity-60'
                              }`}
                            >
                              <span className="text-[10px] font-bold uppercase">
                                {slot.dayOfWeek}
                              </span>
                              <span className="text-base font-extrabold mt-0.5">
                                {slot.date.slice(8, 10)}
                              </span>
                              {slot.isRegularPatternDay && (
                                <span
                                  className={`mt-1 h-1.5 w-1.5 rounded-full ${
                                    isSelected ? 'bg-white' : 'bg-[#214f92]'
                                  }`}
                                />
                              )}
                              {!slot.available && (
                                <span className="text-[9px] font-bold text-rose-500">Full</span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Time grid */}
                      <div>
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Time Window
                        </label>
                        <div className="mt-1.5 grid grid-cols-2 gap-2">
                          {['06:30 AM', '07:30 AM', '05:30 PM', '06:30 PM'].map((time) => {
                            const isSelected = selectedTime === time;
                            return (
                              <button
                                key={time}
                                type="button"
                                onClick={() => setSelectedTime(time)}
                                className={`rounded-lg border py-2 text-xs font-semibold transition-all ${
                                  isSelected
                                    ? 'border-[#214f92] bg-[#eff6ff] text-[#214f92]'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                {time}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleReschedule}
                        disabled={!selectedDate || submitting}
                        className="w-full rounded-xl bg-[#214f92] py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#1a3f75] disabled:opacity-50"
                      >
                        {submitting ? 'Updating...' : 'Confirm Reschedule'}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* TAB 3: VACATION */}
              {activeTab === 'vacation' && (() => {
                const target = new Date();
                target.setDate(target.getDate() + vacationDays);
                const formattedResume = target.toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                });

                return (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
                      <div className="text-xs font-bold text-amber-900">
                        🌴 Going on Holiday / Vacation?
                      </div>
                      <div className="text-xs text-amber-700 mt-1">
                        Pause washes across <span className="font-bold">all {totalCars} registered cars</span> on your account. Zero washes are lost — your monthly quota stays saved and resumes automatically on your return date.
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        How long will you be away?
                      </label>
                      <div className="mt-1.5 grid grid-cols-2 gap-2">
                        {[
                          { label: '3 Days', days: 3 },
                          { label: '1 Week', days: 7 },
                          { label: '10 Days', days: 10 },
                          { label: '2 Weeks', days: 14 },
                          { label: '1 Month', days: 30 },
                        ].map((item) => {
                          const isSelected = vacationDays === item.days;
                          return (
                            <button
                              key={item.days}
                              type="button"
                              onClick={() => setVacationDays(item.days)}
                              className={`rounded-xl border py-2 text-xs font-bold transition-all ${
                                isSelected
                                  ? 'border-amber-600 bg-amber-50 text-amber-900'
                                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {item.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                        AUTOMATIC RESUMPTION
                      </div>
                      <div className="text-xs font-bold text-amber-950 mt-0.5">
                        📅 Washes resume on {formattedResume}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleVacationPause}
                      disabled={submitting}
                      className="w-full rounded-xl bg-amber-700 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-amber-800 disabled:opacity-50"
                    >
                      {submitting ? 'Updating...' : `Pause All ${totalCars} Cars for ${vacationDays} Days`}
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
