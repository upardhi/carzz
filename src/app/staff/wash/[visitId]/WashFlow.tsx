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
import { resolvePublicPhotoUrl } from '@/lib/util/photoUrl';
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
  nextSlotDate: string;
  /** Set the moment the before photo was taken — the clock this wash is timed against. */
  startedAt: string | null;
}

/**
 * The wash execution flow for wash staff.
 * Displays service quota intelligence (this month and last month usage),
 * past wash history with photos, and guided work checklist.
 */
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
  requireBothPhotos,
  nextSlotDate,
  startedAt,
}: Props) {
  const router = useRouter();
  const [before, setBefore] = useState<string | null>(initialBefore);
  const [after, setAfter] = useState<string | null>(initialAfter);
  const [elapsedSeconds, setElapsedSeconds] = useState<number | null>(null);

  // Initial work checklist: auto-select services that still have quota remaining
  const [done, setDone] = useState<string[]>(() => {
    const due = serviceStats
      .filter((s) => !s.shouldDefaultSkip)
      .map((s) => s.name);
    return due.length > 0 ? due : services.slice(0, 1);
  });

  const [uploading, setUploading] = useState<'before' | 'after' | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live "how long is this taking" clock, ticking from the moment the before
  // photo was taken until the wash is closed — the same window the recorded
  // duration (and the too-fast/too-slow flag) is measured against.
  useEffect(() => {
    if (!startedAt || after) {
      setElapsedSeconds(null);
      return;
    }
    const startMs = new Date(startedAt).getTime();
    const tick = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt, after]);
  const [missOpen, setMissOpen] = useState(false);
  const [activeCamera, setActiveCamera] = useState<'before' | 'after' | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{ kind: 'before' | 'after'; url: string } | null>(null);

  // History tab filtering: 'ALL' | 'THIS_MONTH' | 'LAST_MONTH'
  const [historyTab, setHistoryTab] = useState<'ALL' | 'THIS_MONTH' | 'LAST_MONTH'>('ALL');
  const [showHistory, setShowHistory] = useState(true);

  const ready = requireBothPhotos
    ? Boolean(before && after && done.length)
    : done.length > 0;

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
      if (kind === 'before') setBefore(data.url);
      else setAfter(data.url);
    } catch {
      setError('No signal. Move somewhere with network and tap again.');
    } finally {
      setUploading(null);
    }
  }

  async function closeWash() {
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
        toast.success('Wash marked complete!');
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
    <>
      {/* 0. Live wash timer — running from the before photo until the wash closes */}
      {elapsedSeconds !== null ? (
        <div className="flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 shadow-2xs">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
            ⏱ Time on this wash
          </span>
          <span className="font-mono text-lg font-bold text-blue-900">
            {String(Math.floor(elapsedSeconds / 60)).padStart(2, '0')}:
            {String(elapsedSeconds % 60).padStart(2, '0')}
          </span>
        </div>
      ) : null}

      {/* 1. Service Quota & Skip Advisory Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Package:</span>
              <span className="text-xs font-bold text-slate-900">{packageName}</span>
            </div>
            <p className="text-[11.5px] font-medium text-slate-500 mt-0.5">
              {totalDoneThisCycle} of {totalPackageWashes} washes completed this month ({currentCycleLabel})
            </p>
          </div>
          <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-[11px] font-bold text-blue-700">
            {totalPackageWashes - totalDoneThisCycle} washes left
          </span>
        </div>

        {/* Service-by-service breakdown */}
        <div className="mt-3.5 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Service Quota & Past History</span>
            <span>Monthly Allocation</span>
          </div>

          <div className="space-y-2">
            {serviceStats.map((stat) => {
              const isChecked = done.includes(stat.name);
              return (
                <div
                  key={stat.name}
                  className={`rounded-xl border p-3 transition-all ${
                    stat.isQuotaMet
                      ? 'border-amber-200/80 bg-amber-50/40'
                      : 'border-slate-200/70 bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{stat.name}</span>
                        {stat.isQuotaMet ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10.5px] font-bold text-amber-800">
                            ✓ Monthly Quota Full (Skip Suggested)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10.5px] font-bold text-emerald-800">
                            ⚡ Due Today ({stat.quotaPerMonth - stat.timesDoneThisCycle} left)
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-slate-500">
                        <span>
                          This month: <strong className="text-slate-800">{stat.timesDoneThisCycle} / {stat.quotaPerMonth}</strong>
                        </span>
                        <span>·</span>
                        <span>
                          Last month ({lastCycleLabel.split(' ')[0]}): <strong className="text-slate-800">{stat.timesDoneLastCycle} done</strong>
                        </span>
                        {stat.lastDoneDate ? (
                          <>
                            <span>·</span>
                            <span>Last done: <strong className="text-slate-700">{formatDate(stat.lastDoneDate)}</strong></span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setDone((cur) =>
                          isChecked ? cur.filter((s) => s !== stat.name) : [...cur, stat.name],
                        )
                      }
                      className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                        isChecked
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {isChecked ? '✓ Doing Today' : '+ Add to Wash'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Today's Wash Photos & Checklist Panel */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 font-bold text-sm">
            📷
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Vehicle Wash Photos
            </h3>
            <p className="text-[11.5px] text-slate-500">Capture before and after wash photos</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <PhotoTile
            label="Before"
            url={before}
            busy={uploading === 'before'}
            onPick={() => setActiveCamera('before')}
            onPreview={(url) => setPreviewPhoto({ kind: 'before', url })}
          />
          <PhotoTile
            label="After"
            url={after}
            busy={uploading === 'after'}
            disabled={!before}
            onPick={() => setActiveCamera('after')}
            onPreview={(url) => setPreviewPhoto({ kind: 'after', url })}
          />
        </div>

        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Work Done Checklist ({done.length} selected)
            </p>
            <span className="text-[11px] font-medium text-slate-400">
              Tap to toggle
            </span>
          </div>

          <div className="space-y-1.5">
            {services.map((service) => {
              const on = done.includes(service);
              const stat = serviceStats.find((s) => s.name.toLowerCase() === service.toLowerCase());

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
                  className={`flex w-full items-center justify-between rounded-xl p-2.5 text-left text-[13.5px] font-semibold transition-colors ${
                    on ? 'bg-slate-50 text-slate-900' : 'bg-white text-slate-400 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all ${
                        on
                          ? 'border-emerald-600 bg-emerald-600 text-white shadow-2xs'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {on ? <IconCheck width={12} height={12} strokeWidth={3} /> : null}
                    </span>
                    <span className={on ? 'text-slate-900 truncate' : 'text-slate-400 line-through truncate'}>
                      {service}
                    </span>
                  </div>

                  {stat ? (
                    <span
                      className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-md ${
                        stat.isQuotaMet
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {stat.timesDoneThisCycle}/{stat.quotaPerMonth} mo
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Past Wash History & Photos Section */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 font-bold text-sm">
              📜
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Car Wash History & Past Photos
              </h3>
              <p className="text-[11.5px] text-slate-500">
                {pastHistory.length} recorded {pastHistory.length === 1 ? 'wash' : 'washes'} for this car
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs font-bold text-blue-600 hover:text-blue-700"
          >
            {showHistory ? 'Collapse' : 'Expand'}
          </button>
        </div>

        {showHistory && (
          <div className="space-y-3 pt-2">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setHistoryTab('ALL')}
                className={`rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap ${
                  historyTab === 'ALL'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All ({pastHistory.length})
              </button>
              <button
                type="button"
                onClick={() => setHistoryTab('THIS_MONTH')}
                className={`rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap ${
                  historyTab === 'THIS_MONTH'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                This Month ({currentCycleLabel.split(' ')[0]})
              </button>
              <button
                type="button"
                onClick={() => setHistoryTab('LAST_MONTH')}
                className={`rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap ${
                  historyTab === 'LAST_MONTH'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Last Month ({lastCycleLabel.split(' ')[0]})
              </button>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="rounded-xl bg-slate-50 p-6 text-center text-xs text-slate-500">
                No wash history recorded for this filter.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3.5 text-xs transition-colors hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">
                          {formatDate(item.date)}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-500 font-medium">{item.time}</span>
                      </div>
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                          item.status === 'DONE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {item.status === 'DONE' ? '✓ Done' : 'Missed'}
                      </span>
                    </div>

                    {/* Time taken, and whether it was suspiciously fast or slow */}
                    {item.durationMinutes !== null ? (
                      <div className="mb-2 flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-slate-500">
                          ⏱ Took {formatDurationMinutes(item.durationMinutes)}
                        </span>
                        {item.speedFlag ? (
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                              item.speedFlag === 'fast'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                            title={
                              item.speedFlag === 'fast'
                                ? 'Finished much faster than usual — check the photos'
                                : 'Took much longer than usual'
                            }
                          >
                            {item.speedFlag === 'fast' ? '⚡ Too fast' : '🐢 Too slow'}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Services done in that visit */}
                    {item.servicesDone && item.servicesDone.length > 0 && (
                      <div className="mb-2.5 flex flex-wrap gap-1">
                        {item.servicesDone.map((s) => (
                          <span
                            key={s}
                            className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700 shadow-2xs"
                          >
                            <span className="text-emerald-600">✓</span> {s}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Photos from that past wash */}
                    {(item.beforePhotoUrl || item.afterPhotoUrl) && (
                      <div className="mt-2 grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60">
                        {item.beforePhotoUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewPhoto({ kind: 'before', url: item.beforePhotoUrl! })
                            }
                            className="group relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-200 shadow-2xs cursor-pointer"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.beforePhotoUrl}
                              alt="Before wash photo"
                              className="h-full w-full object-cover transition-transform group-hover:scale-105"
                            />
                            <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                              Before (Tap to view)
                            </span>
                          </button>
                        ) : null}

                        {item.afterPhotoUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewPhoto({ kind: 'after', url: item.afterPhotoUrl! })
                            }
                            className="group relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-200 shadow-2xs cursor-pointer"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.afterPhotoUrl}
                              alt="After wash photo"
                              className="h-full w-full object-cover transition-transform group-hover:scale-105"
                            />
                            <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
                              After (Tap to view)
                            </span>
                          </button>
                        ) : null}
                      </div>
                    )}

                    {/* Feedback / note */}
                    {item.rating || item.ratingComment ? (
                      <div className="mt-2 text-[11.5px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200/60">
                        <span className="mr-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                          Customer
                        </span>
                        {item.rating ? (
                          <span className="text-amber-500 font-bold mr-1.5">
                            {'★'.repeat(item.rating)}
                          </span>
                        ) : null}
                        {item.ratingComment ? <span>&ldquo;{item.ratingComment}&rdquo;</span> : null}
                      </div>
                    ) : null}

                    {item.managerRating || item.managerRatingComment ? (
                      <div className="mt-1.5 text-[11.5px] text-slate-600 bg-blue-50 p-2 rounded-lg border border-blue-200/60">
                        <span className="mr-1.5 text-[10px] font-bold uppercase tracking-wide text-blue-500">
                          Manager
                        </span>
                        {item.managerRating ? (
                          <span className="text-amber-500 font-bold mr-1.5">
                            {'★'.repeat(item.managerRating)}
                          </span>
                        ) : null}
                        {item.managerRatingComment ? (
                          <span>&ldquo;{item.managerRatingComment}&rdquo;</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {error ? (
        <div className="mt-3">
          <Note tone="danger">{error}</Note>
        </div>
      ) : null}

      {/* Action buttons sit cleanly below the cards */}
      <div className="mt-4 space-y-2.5 pb-6">
        <button
          type="button"
          disabled={!ready || pending}
          onClick={closeWash}
          className="flex w-full items-center justify-center rounded-xl bg-[#214f92] py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#1a3f75] active:scale-[0.99] disabled:opacity-50"
        >
          {pending
            ? 'Saving…'
            : ready
              ? '✓ Mark Wash Completed'
              : !before
                ? '📷 Take Before Photo'
                : '📷 Take After Photo'}
        </button>
        <button
          type="button"
          onClick={() => setMissOpen(true)}
          className="w-full rounded-xl border border-slate-200 bg-white py-3 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50"
        >
          Could not do this wash
        </button>
      </div>

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
        />
      )}
    </>
  );
}

function PhotoTile({
  label,
  url,
  busy,
  disabled,
  onPick,
  onPreview,
}: {
  label: string;
  url: string | null;
  busy: boolean;
  disabled?: boolean;
  onPick: () => void;
  onPreview: (url: string) => void;
}) {
  return (
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
      className={`relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-2xl border-2 text-xs font-bold transition-all shadow-2xs ${
        url
          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 active:opacity-85'
          : disabled
            ? 'border-dashed border-slate-200 bg-slate-50 text-slate-400'
            : 'border-dashed border-blue-300 bg-blue-50/60 text-blue-900 hover:bg-blue-50 active:scale-[0.98]'
      }`}
    >
      {url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolvePublicPhotoUrl(url) || url}
            alt={`${label} photo`}
            className="h-full w-full object-cover"
          />
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-emerald-600/90 py-1 text-[11px] font-bold text-white backdrop-blur-xs">
            <IconCheck width={13} height={13} strokeWidth={3} />
            {label} · View
          </span>
          <span className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white backdrop-blur-sm">
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
        </>
      ) : (
        <>
          <IconCamera width={26} height={26} className={disabled ? 'text-slate-300' : 'text-blue-700'} />
          <span>{busy ? 'Saving…' : `${label} Photo`}</span>
        </>
      )}
    </button>
  );
}

function MissWashForm({
  visitId,
  nextSlotDate,
  onCancel,
}: {
  visitId: string;
  nextSlotDate: string;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<MissReason | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** One tap: choosing the reason is the submit. */
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
          rescheduleTo: nextSlotDate,
        },
        label: `Record missed wash: ${reason}`,
      });

      if (!result.ok) {
        setError(result.error ?? 'Could not record that.');
        return;
      }

      if (result.queuedOffline) {
        toast.info('Missed wash recorded offline. It will sync automatically as soon as network returns!', {
          title: 'Saved Offline (Auto-Sync)',
        });
      } else {
        toast.success('Missed wash recorded.');
      }

      router.push('/staff');
      router.refresh();
    } catch {
      setError('Something unexpected happened. Please try again.');
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 font-bold text-sm">
            ⚠️
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Why was this wash missed?
            </h3>
            <p className="text-[11.5px] text-slate-500">Select a reason to reschedule the customer</p>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {MISS_REASONS.filter((r) => r !== 'STAFF_ABSENT').map((reason) => (
            <button
              key={reason}
              type="button"
              disabled={pending !== null}
              onClick={() => submit(reason)}
              className="flex w-full items-center justify-between py-3.5 text-left text-[14px] font-semibold text-slate-800 hover:text-blue-700 transition-colors disabled:opacity-50"
            >
              <span>{MISS_REASON_LABEL[reason]}</span>
              {pending === reason ? (
                <span className="text-xs font-semibold text-blue-600">Saving…</span>
              ) : (
                <span className="text-slate-300 text-sm">›</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-blue-200/70 bg-blue-50/70 p-3.5 text-xs font-medium text-blue-900">
        💡 The wash will automatically return to the customer&rsquo;s package quota and move to their next scheduled slot.
      </div>

      {error ? (
        <div className="mt-3">
          <Note tone="danger">{error}</Note>
        </div>
      ) : null}

      <button
        type="button"
        className="mt-3 w-full rounded-xl border border-slate-200 bg-white py-3 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:bg-slate-50"
        onClick={onCancel}
      >
        ← Cancel & Back to Wash
      </button>
    </>
  );
}
