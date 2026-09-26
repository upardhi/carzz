'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Note } from '@/components/ui/primitives';
import { IconCamera, IconCheck } from '@/components/shell/icons';
import { MISS_REASONS, type MissReason } from '@/lib/data/types';
import { MISS_REASON_LABEL } from '@/lib/util/labels';
import { LiveCameraModal } from '@/components/staff/LiveCameraModal';
import { PhotoPreviewModal } from '@/components/staff/PhotoPreviewModal';
import { safeOfflineFetch } from '@/lib/util/offlineQueue';
import { toast } from '@/components/ui/ToastProvider';
import { formatDate } from '@/lib/util/format';
import { formatDurationMinutes } from '@/lib/util/washTiming';
import type { PastWashRecord, ServiceUsageStat } from './page';

interface Props {
  visitId: string;
  services: string[];
  packageName: string;
  totalPackageWashes: number;
  totalDoneThisCycle: number;
  totalDoneLastCycle: number;
  currentCycleLabel: string;
  lastCycleLabel: string;
  serviceStats: ServiceUsageStat[];
  pastHistory: PastWashRecord[];
  initialBefore: string | null;
  initialAfter: string | null;
  requireBothPhotos: boolean;
  nextSlotDate: string | null;
  startedAt: string | null;
}

export function WashFlow({
  visitId,
  services,
  packageName,
  totalPackageWashes,
  totalDoneThisCycle,
  totalDoneLastCycle: _totalDoneLastCycle,
  currentCycleLabel,
  lastCycleLabel,
  serviceStats,
  pastHistory,
  initialBefore,
  initialAfter,
  requireBothPhotos: _requireBothPhotos,
  nextSlotDate,
  startedAt,
}: Props) {
  const router = useRouter();
  const [before, setBefore] = useState<string | null>(initialBefore);
  const [after, setAfter] = useState<string | null>(initialAfter);
  const [washStartedAt, setWashStartedAt] = useState<string | null>(startedAt);
  const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null);

  // Initial work checklist: auto-select services that still have quota remaining
  const [done, setDone] = useState<string[]>(() => {
    const due = serviceStats
      .filter((s) => !s.shouldDefaultSkip)
      .map((s) => s.name);
    return due.length > 0 ? due : services.slice(0, 1);
  });

  const [uploading, setUploading] = useState<'before' | 'after' | null>(null);
  const [starting, setStarting] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isWashStarted = Boolean(washStartedAt);
  const currentStep = !before || !isWashStarted ? 1 : !after ? 2 : 3;

  // Live timer ticking from startedAt until after photo / completion
  useEffect(() => {
    if (!washStartedAt || after) {
      setElapsedSeconds(null);
      return;
    }
    const startMs = new Date(washStartedAt).getTime();
    const tick = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [washStartedAt, after]);

  const [missOpen, setMissOpen] = useState(false);
  const [activeCamera, setActiveCamera] = useState<'before' | 'after' | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{ kind: 'before' | 'after'; url: string } | null>(null);

  // History tab filtering & accordion
  const [historyTab, setHistoryTab] = useState<'ALL' | 'THIS_MONTH' | 'LAST_MONTH'>('ALL');
  const [showHistory, setShowHistory] = useState(false);
  const [showQuotaDetails, setShowQuotaDetails] = useState(false);

  async function upload(kind: 'before' | 'after', file: File) {
    setUploading(kind);
    setError(null);
    try {
      const body = new FormData();
      body.set('visitId', visitId);
      body.set('kind', kind);
      body.set('photo', file);

      const response = await fetch('/api/staff/photo', { method: 'POST', body });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        setError(data.error ?? 'Could not save that photo.');
        return;
      }
      if (kind === 'before') {
        setBefore(data.url);
        toast.success('Before photo saved! Tap "START WASH" to start cleaning.');
      } else {
        setAfter(data.url);
        toast.success('After photo saved! Ready to complete wash.');
      }
    } catch {
      setError('No signal. Move somewhere with network and tap again.');
    } finally {
      setUploading(null);
    }
  }

  async function startWash() {
    if (!before) {
      setError('Please take the Before Photo first.');
      return;
    }
    setStarting(true);
    setError(null);
    try {
      const res = await fetch('/api/staff/wash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', visitId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not start wash.');
        return;
      }
      const nowIso = data.startedAt || new Date().toISOString();
      setWashStartedAt(nowIso);
      toast.success('Wash started! Cleaning timer is running.');
    } catch {
      setError('Network issue. Please tap start again.');
    } finally {
      setStarting(false);
    }
  }

  async function closeWash() {
    if (!before || !after) {
      setError('Both Before and After photos are required.');
      return;
    }
    if (!done.length) {
      setError('Please select at least one service done.');
      return;
    }

    setPending(true);
    setError(null);
    try {
      const result = await safeOfflineFetch<{ error?: string }>('/api/staff/wash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { action: 'complete', visitId, servicesDone: done },
        label: `Complete wash (${done.length} services)`,
      });

      if (!result.ok) {
        setError(result.error ?? 'Could not close this wash.');
        return;
      }

      if (result.queuedOffline) {
        toast.info('Wash marked complete offline. It will sync automatically as soon as you have network!', {
          title: 'Saved Offline (Auto-Sync)',
        });
      } else {
        toast.success('Wash completed successfully! Great job.');
      }

      router.push('/staff');
      router.refresh();
    } catch {
      setError('Something unexpected happened. Please try again.');
    } finally {
      setPending(false);
    }
  }

  // Filtered past history list
  const filteredHistory = pastHistory.filter((v) => {
    if (historyTab === 'THIS_MONTH') {
      return v.cycle === currentCycleLabel.slice(0, 7) || v.cycle.includes(currentCycleLabel.split(' ')[0]);
    }
    if (historyTab === 'LAST_MONTH') {
      return v.cycle === lastCycleLabel.slice(0, 7) || v.cycle.includes(lastCycleLabel.split(' ')[0]);
    }
    return true;
  });

  if (missOpen) {
    return (
      <MissWashForm
        visitId={visitId}
        nextSlotDate={nextSlotDate}
        onCancel={() => setMissOpen(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* ========================================================================= */}
      {/* 1. VISUAL 3-STEP PROGRESS STEPPER                                         */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          {/* Step 1 */}
          <div className="flex-1 flex flex-col items-center text-center">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black transition-all ${
                before
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-blue-600 text-white ring-4 ring-blue-100 animate-pulse'
              }`}
            >
              {before ? '✓' : '1'}
            </div>
            <span
              className={`text-xs font-bold mt-1.5 ${
                currentStep === 1 ? 'text-blue-700' : 'text-slate-700'
              }`}
            >
              Before Photo
            </span>
          </div>

          <div
            className={`h-1 flex-1 mx-2 rounded-full transition-colors ${
              isWashStarted ? 'bg-emerald-500' : 'bg-slate-200'
            }`}
          />

          {/* Step 2 */}
          <div className="flex-1 flex flex-col items-center text-center">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black transition-all ${
                after
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : isWashStarted
                  ? 'bg-blue-600 text-white ring-4 ring-blue-100 animate-pulse'
                  : 'bg-slate-100 text-slate-400 border border-slate-200'
              }`}
            >
              {after ? '✓' : '2'}
            </div>
            <span
              className={`text-xs font-bold mt-1.5 ${
                currentStep === 2
                  ? 'text-blue-700'
                  : isWashStarted
                  ? 'text-slate-700'
                  : 'text-slate-400'
              }`}
            >
              Wash &amp; After Photo
            </span>
          </div>

          <div
            className={`h-1 flex-1 mx-2 rounded-full transition-colors ${
              before && after && isWashStarted ? 'bg-emerald-500' : 'bg-slate-200'
            }`}
          />

          {/* Step 3 */}
          <div className="flex-1 flex flex-col items-center text-center">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black transition-all ${
                before && after && isWashStarted
                  ? 'bg-emerald-600 text-white ring-4 ring-emerald-100 animate-bounce'
                  : 'bg-slate-100 text-slate-400 border border-slate-200'
              }`}
            >
              3
            </div>
            <span
              className={`text-xs font-bold mt-1.5 ${
                currentStep === 3 ? 'text-emerald-700 font-extrabold' : 'text-slate-400'
              }`}
            >
              Complete
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. STEP 1: BEFORE PHOTO & START WASH (SHOWN BEFORE WASH STARTS)           */}
      {/* ========================================================================= */}
      {!isWashStarted && (
        <div className="rounded-2xl border-2 border-blue-400 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">
                1
              </span>
              <h3 className="text-sm md:text-base font-bold text-slate-900">
                Step 1: Capture Before Photo
              </h3>
            </div>
            {before && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                ✓ Photo Ready
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="space-y-4">
              <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                Capture a clear photo of the vehicle before cleaning begins. Once captured, tap <strong>&ldquo;START WASH&rdquo;</strong> to start the service timer.
              </p>

              <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-100 text-xs text-blue-900 space-y-1">
                <div className="font-bold">📸 Photo Guidelines:</div>
                <ul className="list-disc list-inside text-[11.5px] text-blue-800 space-y-0.5">
                  <li>Capture from front 45-degree angle</li>
                  <li>Ensure license plate and car condition are visible</li>
                </ul>
              </div>

              <div>
                {!before ? (
                  <button
                    type="button"
                    onClick={() => setActiveCamera('before')}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 text-sm font-bold text-white shadow-md hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99] transition-all cursor-pointer"
                  >
                    <IconCamera width={20} height={20} />
                    <span>📸 Take Before Photo</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={starting}
                    onClick={startWash}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 py-4 text-base font-black text-white shadow-lg hover:from-emerald-700 hover:to-teal-700 active:scale-[0.99] transition-all cursor-pointer ring-4 ring-emerald-100"
                  >
                    <span>▶ START WASH (Start Timer)</span>
                  </button>
                )}
              </div>
            </div>

            <div className="w-full max-w-sm mx-auto md:max-w-none">
              <PhotoTile
                label="Before Wash Photo"
                url={before}
                busy={uploading === 'before'}
                onPick={() => setActiveCamera('before')}
                onPreview={(url) => setPreviewPhoto({ kind: 'before', url })}
                onRetake={() => setActiveCamera('before')}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. STEP 2 & 3: WASH IN PROGRESS & AFTER PHOTO (SHOWN AFTER START)         */}
      {/* ========================================================================= */}
      {isWashStarted && (
        <>
          {/* Live Running Timer Banner */}
          <div className="flex items-center justify-between rounded-2xl border-2 border-emerald-400 bg-emerald-50 px-5 py-3.5 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-600"></span>
              </span>
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-900 block">
                  Wash In Progress
                </span>
                <span className="text-[11px] text-emerald-700 font-medium">
                  Started at {new Date(washStartedAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="font-mono text-2xl font-black text-emerald-950 block">
                {elapsedSeconds !== null ? (
                  `${String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:${String(
                    elapsedSeconds % 60,
                  ).padStart(2, '0')}`
                ) : (
                  '00:00'
                )}
              </span>
            </div>
          </div>

          {/* Photos & Work Done Container */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center justify-between">
              <span>📷 Proof Photos</span>
              <span className="text-[11px] font-normal text-slate-500">Before &amp; After</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <PhotoTile
                label="Before Photo"
                url={before}
                busy={uploading === 'before'}
                onPick={() => setActiveCamera('before')}
                onPreview={(url) => setPreviewPhoto({ kind: 'before', url })}
                onRetake={() => setActiveCamera('before')}
              />
              <PhotoTile
                label="After Photo"
                url={after}
                busy={uploading === 'after'}
                onPick={() => setActiveCamera('after')}
                onPreview={(url) => setPreviewPhoto({ kind: 'after', url })}
                onRetake={() => setActiveCamera('after')}
              />
            </div>

            {/* Checklist of Work Done */}
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Services Done ({done.length} selected)
                </p>
                <span className="text-[11px] font-semibold text-blue-600">
                  Tap to toggle
                </span>
              </div>

              <div className="space-y-2">
                {services.map((service) => {
                  const on = done.includes(service);
                  const stat = serviceStats.find(
                    (s) => s.name.toLowerCase() === service.toLowerCase(),
                  );

                  return (
                    <button
                      key={service}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setDone((current) =>
                          on ? current.filter((s) => s !== service) : [...current, service],
                        )
                      }
                      className={`flex w-full items-center justify-between rounded-xl p-3 text-left text-xs font-semibold transition-all cursor-pointer ${
                        on
                          ? 'bg-blue-50/70 text-slate-900 border border-blue-200 shadow-2xs'
                          : 'bg-white text-slate-400 border border-dashed border-slate-200 hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0 pr-2">
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all mt-0.5 ${
                            on
                              ? 'border-blue-600 bg-blue-600 text-white shadow-2xs'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {on ? <IconCheck width={12} height={12} strokeWidth={3} /> : null}
                        </span>
                        <div className="min-w-0">
                          <span className={on ? 'text-slate-900 font-bold block truncate' : 'text-slate-400 line-through block truncate'}>
                            {service}
                          </span>
                          <span className="text-[11px] text-slate-500 font-normal block mt-0.5">
                            {stat?.lastDoneDate ? (
                              <>Last done: <strong className="text-slate-700">{formatDate(stat.lastDoneDate)}</strong></>
                            ) : (
                              <span className="text-emerald-700 font-semibold">✨ Due today (Not done yet this month)</span>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        {stat && (
                          <span
                            className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md ${
                              stat.isQuotaMet
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-blue-50 text-blue-800 border border-blue-200'
                            }`}
                          >
                            {stat.timesDoneThisCycle}/{stat.quotaPerMonth} mo
                          </span>
                        )}
                        {stat?.isQuotaMet ? (
                          <span className="text-[9.5px] font-semibold text-amber-700">Quota Met</span>
                        ) : (
                          <span className="text-[9.5px] font-semibold text-emerald-600">Recommended</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons for Step 2 & 3 */}
            <div className="pt-3 border-t border-slate-100">
              {!after ? (
                <button
                  type="button"
                  onClick={() => setActiveCamera('after')}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 text-sm font-bold text-white shadow-md hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99] transition-all cursor-pointer"
                >
                  <IconCamera width={20} height={20} />
                  <span>📸 Take After Photo</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={pending || !done.length}
                  onClick={closeWash}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 py-4 text-base font-black text-white shadow-lg hover:from-emerald-700 hover:to-teal-700 active:scale-[0.99] transition-all cursor-pointer ring-4 ring-emerald-100 disabled:opacity-50"
                >
                  <IconCheck width={22} height={22} strokeWidth={3} />
                  <span>{pending ? 'Saving…' : '✅ COMPLETE & SUBMIT WASH'}</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* 4. COLLAPSIBLE PACKAGE DETAILS & HISTORY                                   */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setShowQuotaDetails(!showQuotaDetails)}
          className="flex w-full items-center justify-between text-left text-xs font-bold text-slate-800 cursor-pointer"
        >
          <span>📦 Package Plan &amp; Quotas</span>
          <span className="text-slate-400 font-semibold">{showQuotaDetails ? '▲ Hide' : '▼ View'}</span>
        </button>

        {showQuotaDetails && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
            <div className="text-xs text-slate-700 font-medium">
              <strong>Package:</strong> {packageName} ({totalDoneThisCycle} of {totalPackageWashes} washes done this month)
            </div>
            <div className="space-y-1.5 pt-1">
              {serviceStats.map((stat) => (
                <div
                  key={stat.name}
                  className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 border border-slate-100"
                >
                  <span className="font-semibold text-slate-800">{stat.name}</span>
                  <span className="text-slate-500 font-medium">
                    This month: {stat.timesDoneThisCycle} / {stat.quotaPerMonth}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Past Car Wash History Collapsible */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          className="flex w-full items-center justify-between text-left text-xs font-bold text-slate-800 cursor-pointer"
        >
          <span>📜 Past Wash History ({pastHistory.length})</span>
          <span className="text-slate-400 font-semibold">{showHistory ? '▲ Hide' : '▼ View'}</span>
        </button>

        {showHistory && (
          <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setHistoryTab('ALL')}
                className={`rounded-lg px-3 py-1 text-xs cursor-pointer ${
                  historyTab === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                All ({pastHistory.length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryTab('THIS_MONTH')}
                className={`rounded-lg px-3 py-1 text-xs cursor-pointer ${
                  historyTab === 'THIS_MONTH' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => setHistoryTab('LAST_MONTH')}
                className={`rounded-lg px-3 py-1 text-xs cursor-pointer ${
                  historyTab === 'LAST_MONTH' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                Last Month
              </button>
            </div>

            {filteredHistory.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3 font-medium">No history for this filter.</p>
            ) : (
              <div className="space-y-2">
                {filteredHistory.map((item) => (
                  <div key={item.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{formatDate(item.date)}</span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          item.status === 'DONE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {item.status === 'DONE' ? '✓ Done' : 'Missed'}
                      </span>
                    </div>
                    {item.durationMinutes !== null && (
                      <div className="text-[11px] text-slate-500">
                        ⏱ Took {formatDurationMinutes(item.durationMinutes)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-3">
          <Note tone="danger">{error}</Note>
        </div>
      )}

      {/* 5. Safety Action: Missed / Skipped Wash */}
      <div className="pt-2 text-center">
        <button
          type="button"
          onClick={() => setMissOpen(true)}
          className="text-xs font-bold text-rose-600 hover:text-rose-800 hover:underline py-2 cursor-pointer"
        >
          ⚠️ Vehicle Not Available / Skip Wash
        </button>
      </div>

      {/* Camera and Lightbox Modals */}
      {activeCamera && (
        <LiveCameraModal
          kind={activeCamera}
          onCapture={(file) => void upload(activeCamera, file)}
          onClose={() => setActiveCamera(null)}
        />
      )}

      {previewPhoto && (
        <PhotoPreviewModal
          kind={previewPhoto.kind}
          url={previewPhoto.url}
          onClose={() => setPreviewPhoto(null)}
          onRetake={() => {
            const kind = previewPhoto.kind;
            setPreviewPhoto(null);
            setActiveCamera(kind);
          }}
        />
      )}
    </div>
  );
}

function PhotoTile({
  label,
  url,
  busy,
  disabled,
  onPick,
  onPreview,
  onRetake,
}: {
  label: string;
  url: string | null;
  busy: boolean;
  disabled?: boolean;
  onPick: () => void;
  onPreview: (url: string) => void;
  onRetake?: () => void;
}) {
  return (
    <div className="relative aspect-[4/3] w-full">
      <button
        type="button"
        onClick={() => {
          if (url) {
            onPreview(url);
          } else {
            onPick();
          }
        }}
        disabled={disabled || busy}
        className={`relative flex h-full w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 text-xs font-bold transition-all shadow-2xs ${
          url
            ? 'border-emerald-500 bg-emerald-50 text-emerald-700 active:opacity-85'
            : disabled
            ? 'border-dashed border-slate-200 bg-slate-50 text-slate-400'
            : 'border-dashed border-blue-400 bg-blue-50/60 text-blue-900 hover:bg-blue-100/60 active:scale-[0.99] cursor-pointer'
        }`}
      >
        {url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`${label} photo`}
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-slate-900/80 py-1.5 text-[11px] font-bold text-white backdrop-blur-xs">
              <IconCheck width={13} height={13} strokeWidth={3} />
              {label} · Tap to View
            </span>
          </>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
              <IconCamera width={24} height={24} />
            </div>
            <span className="text-xs font-bold text-slate-800">{busy ? 'Saving…' : label}</span>
            <span className="text-[11px] font-normal text-slate-500">Tap to open camera</span>
          </>
        )}
      </button>

      {url && onRetake && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRetake();
          }}
          className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-black/75 px-3 py-1 text-[11px] font-bold text-white shadow-md backdrop-blur-xs hover:bg-black/90 active:scale-95 transition-all cursor-pointer z-10"
        >
          📷 Retake
        </button>
      )}
    </div>
  );
}

function MissWashForm({
  visitId,
  nextSlotDate,
  onCancel,
}: {
  visitId: string;
  nextSlotDate: string | null;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<MissReason | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(reason: MissReason) {
    setPending(reason);
    setError(null);
    try {
      const result = await safeOfflineFetch<{ error?: string }>('/api/staff/wash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          action: 'miss',
          visitId,
          reason,
          rescheduleTo: nextSlotDate || undefined,
        },
        label: `Record missed wash: ${reason}`,
      });

      if (!result.ok) {
        setError(result.error ?? 'Could not record that.');
        return;
      }

      if (result.queuedOffline) {
        toast.info('Missed wash recorded offline. It will sync automatically when reconnected.', {
          title: 'Saved Offline',
        });
      } else {
        toast.success('Missed wash recorded.');
      }

      router.push('/staff');
      router.refresh();
    } catch {
      setError('Something unexpected happened.');
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-sm font-bold text-slate-900">
          Why could this wash not be completed?
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer"
        >
          ✕
        </button>
      </div>

      <p className="text-xs text-slate-600">
        Select the reason below. This keeps customer records and compensation accurate.
      </p>

      <div className="space-y-2">
        {MISS_REASONS.map((reason) => (
          <button
            key={reason}
            type="button"
            disabled={pending !== null}
            onClick={() => submit(reason)}
            className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 hover:bg-rose-50 hover:border-rose-200 p-3 text-left text-xs font-bold text-slate-800 transition-all cursor-pointer disabled:opacity-50"
          >
            <span>{MISS_REASON_LABEL[reason]}</span>
            <span className="text-slate-400 font-bold">›</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-3">
          <Note tone="danger">{error}</Note>
        </div>
      )}

      <div className="pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="w-full py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
        >
          Cancel &amp; Back to Wash
        </button>
      </div>
    </div>
  );
}
