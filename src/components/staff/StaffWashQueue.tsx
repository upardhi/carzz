'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  IconCar,
  IconCheck,
  IconChevron,
  IconClock,
  IconCamera,
  IconMap,
} from '@/components/shell/icons';
import { PhotoPreviewModal } from '@/components/staff/PhotoPreviewModal';
import { toast } from '@/components/ui/ToastProvider';
import { formatClock, formatTime } from '@/lib/util/format';
import { MISS_REASON_LABEL } from '@/lib/util/labels';
import { safeOfflineFetch } from '@/lib/util/offlineQueue';

export interface WashQueueItem {
  id: string;
  customerId: string;
  carId: string;
  customerName: string;
  customerAddress: string;
  customerLandmark?: string | null;
  customerNote?: string | null;
  carPlate: string;
  carMake: string;
  carModel: string;
  scheduledTime: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'MISSED';
  startedAt: string | null;
  completedAt: string | null;
  beforePhotoUrl: string | null;
  afterPhotoUrl: string | null;
  plannedService: string | null;
  servicesDone: string[];
  missReason: string | null;
  missNote: string | null;
}

interface Props {
  initialVisits: WashQueueItem[];
}

function formatTimer(elapsedSeconds: number): string {
  const hrs = Math.floor(elapsedSeconds / 3600);
  const mins = Math.floor((elapsedSeconds % 3600) / 60);
  const secs = elapsedSeconds % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
  }
  return `${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
}

export function StaffWashQueue({ initialVisits }: Props) {
  const router = useRouter();
  const [visits, setVisits] = useState<WashQueueItem[]>(initialVisits);
  const [now, setNow] = useState<number>(Date.now());
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{
    kind: 'before' | 'after';
    url: string;
  } | null>(null);

  // Sync state if initialVisits change from server router.refresh()
  useEffect(() => {
    setVisits(initialVisits);
  }, [initialVisits]);

  // Master 1-second ticker for live running timers
  useEffect(() => {
    const hasActiveWash = visits.some(
      (v) =>
        (v.status === 'IN_PROGRESS' || Boolean(v.startedAt)) &&
        v.status !== 'DONE' &&
        v.status !== 'MISSED',
    );

    if (!hasActiveWash) return;

    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, [visits]);

  async function handleFinishWash(visit: WashQueueItem) {
    if (!visit.afterPhotoUrl) {
      toast.error('Please upload the work done (after) photo first.');
      return;
    }

    setSubmittingId(visit.id);
    try {
      const servicesToSubmit =
        visit.servicesDone && visit.servicesDone.length > 0
          ? visit.servicesDone
          : [visit.plannedService || 'Exterior Wash'];

      const result = await safeOfflineFetch<{ error?: string }>('/api/staff/wash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          action: 'complete',
          visitId: visit.id,
          servicesDone: servicesToSubmit,
        },
        label: `Finish wash ${visit.carPlate}`,
      });

      if (!result.ok) {
        toast.error(result.error ?? 'Could not complete this wash.');
        return;
      }

      if (result.queuedOffline) {
        toast.info(
          'Wash completed offline. It will sync automatically as soon as network returns.',
          { title: 'Saved Offline' },
        );
      } else {
        toast.success(`Wash for ${visit.carPlate} completed! Earnings updated.`);
      }

      const completedTime = new Date().toISOString();
      setVisits((prev) =>
        prev.map((v) =>
          v.id === visit.id
            ? {
                ...v,
                status: 'DONE',
                completedAt: completedTime,
                servicesDone: servicesToSubmit,
              }
            : v,
        ),
      );

      router.refresh();
    } catch {
      toast.error('Unexpected error while finishing wash. Please try again.');
    } finally {
      setSubmittingId(null);
    }
  }

  if (visits.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <IconCar width={24} height={24} />
        </div>
        <h4 className="mt-3 text-sm font-bold text-slate-900">No cars assigned today</h4>
        <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
          Your area manager will assign today&apos;s wash route shortly. Check back in a few minutes.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 space-y-4">
        {visits.map((visit) => {
          // =========================================================================
          // 1. COMPLETED WASH CARD
          // =========================================================================
          if (visit.status === 'DONE') {
            return (
              <div
                key={visit.id}
                className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 sm:p-5 transition-all space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                      <IconCheck width={16} height={16} />
                    </div>
                    <span className="text-sm font-bold text-slate-900 truncate">
                      {visit.customerName}
                    </span>
                    <span className="rounded-md bg-slate-200/90 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700">
                      {visit.carPlate}
                    </span>
                  </div>

                  <span className="rounded-full bg-emerald-100/90 text-emerald-800 px-3 py-1 text-[11.5px] font-extrabold border border-emerald-200 shrink-0">
                    Done at {formatClock(visit.completedAt)}
                  </span>
                </div>

                <div className="text-xs text-slate-500 flex items-center justify-between flex-wrap gap-2">
                  <span>
                    {visit.carMake} {visit.carModel} · Scheduled {formatTime(visit.scheduledTime)}
                  </span>
                  {visit.servicesDone.length > 0 && (
                    <span className="font-medium text-slate-600 truncate max-w-full">
                      {visit.servicesDone.join(', ')}
                    </span>
                  )}
                </div>

                {(visit.beforePhotoUrl || visit.afterPhotoUrl) && (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60 flex-wrap">
                    <span className="text-[11px] font-semibold text-slate-400">Photos:</span>
                    {visit.beforePhotoUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewPhoto({ kind: 'before', url: visit.beforePhotoUrl! })
                        }
                        className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
                      >
                        Before Photo
                      </button>
                    )}
                    {visit.afterPhotoUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewPhoto({ kind: 'after', url: visit.afterPhotoUrl! })
                        }
                        className="px-2.5 py-1 text-[11px] font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
                      >
                        After Photo
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          }

          // =========================================================================
          // 2. MISSED / SKIPPED WASH CARD
          // =========================================================================
          if (visit.status === 'MISSED') {
            return (
              <div
                key={visit.id}
                className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 sm:p-5 space-y-2"
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="text-sm font-bold text-slate-900 truncate">
                      {visit.customerName}
                    </span>
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-800">
                      {visit.carPlate}
                    </span>
                  </div>

                  <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-bold border border-amber-200 shrink-0">
                    Moved to Next Slot
                  </span>
                </div>

                <div className="text-xs text-amber-800 font-medium">
                  Reason:{' '}
                  {visit.missReason
                    ? MISS_REASON_LABEL[visit.missReason as keyof typeof MISS_REASON_LABEL] ||
                      visit.missReason
                    : 'Skipped / Car Not Available'}
                </div>
              </div>
            );
          }

          // Flags for active status
          const isStarted = Boolean(visit.startedAt) || visit.status === 'IN_PROGRESS';
          const hasAfterPhoto = Boolean(visit.afterPhotoUrl);

          // Calculate elapsed time for active washes
          const startMs = visit.startedAt ? new Date(visit.startedAt).getTime() : 0;
          const elapsedSecs =
            isStarted && startMs > 0 ? Math.max(0, Math.floor((now - startMs) / 1000)) : 0;

          // =========================================================================
          // 3. WASHING IN PROGRESS (STARTED / PHOTO UPLOADED)
          // =========================================================================
          if (isStarted) {
            return (
              <div
                key={visit.id}
                className="relative overflow-hidden rounded-2xl border-2 border-emerald-500/80 bg-gradient-to-b from-white via-white to-emerald-50/25 p-4 sm:p-5 shadow-xs transition-all"
              >
                {/* Active pulsating banner accent */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 animate-pulse" />

                {/* Top Row: Plate, Customer Name, and Active Status */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="rounded-lg bg-slate-900 px-2.5 py-1 font-mono text-xs font-black tracking-wide text-white shrink-0 shadow-2xs">
                      {visit.carPlate}
                    </span>
                    <span className="text-sm font-extrabold text-slate-900 truncate">
                      {visit.customerName}
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100/90 px-2.5 py-0.5 text-[10.5px] font-black uppercase tracking-wider text-emerald-800 border border-emerald-300/80 shrink-0">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                    </span>
                    In Progress
                  </span>
                </div>

                {/* Car & Schedule Details */}
                <div className="mt-2 flex items-center justify-between text-xs text-slate-600 font-medium">
                  <span>{visit.carMake} {visit.carModel}</span>
                  <span className="font-semibold text-slate-700">Scheduled: {formatTime(visit.scheduledTime)}</span>
                </div>

                {/* Address */}
                <div className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-500">
                  <IconMap width={14} height={14} className="shrink-0 text-slate-400 mt-0.5" />
                  <span className="line-clamp-2">
                    {visit.customerAddress}
                    {visit.customerLandmark ? ` (${visit.customerLandmark})` : ''}
                  </span>
                </div>

                {visit.customerNote && (
                  <div className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200 inline-block">
                    Note: {visit.customerNote}
                  </div>
                )}

                {/* Big Live Timer Banner (Full width on all screens) */}
                <div className="mt-3.5 flex items-center justify-between rounded-xl bg-emerald-50/90 border border-emerald-200/90 px-3.5 py-2.5 shadow-2xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                      <IconClock width={18} height={18} className="animate-spin-slow" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                        Cleaning Timer
                      </div>
                      <div className="text-[11px] font-medium text-emerald-900/80 truncate">
                        Wash actively running
                      </div>
                    </div>
                  </div>

                  <div className="font-mono text-xl sm:text-2xl font-black tracking-tight text-emerald-800 shrink-0">
                    {formatTimer(elapsedSecs)}
                  </div>
                </div>

                {/* Guidance & Actions */}
                <div className="mt-3.5 space-y-3 pt-3 border-t border-emerald-100">
                  {!hasAfterPhoto ? (
                    <>
                      {/* Notice: Wash in progress, finish and upload after photo */}
                      <div className="rounded-xl bg-blue-50/80 border border-blue-200/80 p-3 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                          <span>🧼</span>
                          <span>Wash started</span>
                        </div>
                        <p className="text-xs leading-relaxed text-blue-800">
                          Finish cleaning this vehicle, then upload the <strong>work done (after) photo</strong> to complete.
                        </p>
                      </div>

                      <Link
                        href={`/staff/wash/${visit.id}`}
                        className="flex items-center justify-center gap-2 w-full rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white py-3 text-xs sm:text-sm font-extrabold shadow-sm transition-colors cursor-pointer"
                      >
                        <IconCamera width={16} height={16} />
                        <span>Upload Work Done Photo</span>
                        <IconChevron width={14} height={14} />
                      </Link>
                    </>
                  ) : (
                    <>
                      {/* Notice: After photo uploaded, ready to complete */}
                      <div className="rounded-xl bg-emerald-50 border border-emerald-200/90 p-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-sm shrink-0">✅</span>
                            <span className="text-xs font-extrabold text-emerald-900 truncate">
                              Work done photo uploaded!
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewPhoto({ kind: 'after', url: visit.afterPhotoUrl! })
                            }
                            className="shrink-0 px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-50 transition-colors shadow-2xs cursor-pointer"
                          >
                            View Photo
                          </button>
                        </div>
                        <p className="text-xs leading-relaxed text-emerald-800">
                          Tap <strong>Finish Wash</strong> below to complete this wash and record your earnings.
                        </p>
                      </div>

                      {/* Action buttons (Details + Finish Wash) */}
                      <div className="grid grid-cols-3 gap-2.5">
                        <Link
                          href={`/staff/wash/${visit.id}`}
                          className="col-span-1 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 py-3 text-xs font-bold transition-colors text-center border border-slate-200"
                        >
                          Details
                        </Link>

                        <button
                          type="button"
                          disabled={submittingId === visit.id}
                          onClick={() => handleFinishWash(visit)}
                          className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white py-3 text-xs sm:text-sm font-extrabold shadow-sm transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                          {submittingId === visit.id ? (
                            <>
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              <span>Finishing...</span>
                            </>
                          ) : (
                            <>
                              <IconCheck width={17} height={17} />
                              <span>Finish Wash</span>
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          }

          // =========================================================================
          // 4. NOT STARTED WASH CARD (PENDING)
          // =========================================================================
          return (
            <div
              key={visit.id}
              className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-2xs transition-all hover:border-blue-400 hover:shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="rounded-lg bg-blue-50 px-2.5 py-1 font-mono text-xs font-bold text-blue-700 border border-blue-200">
                    {visit.carPlate}
                  </span>
                  <span className="text-sm font-extrabold text-slate-900 truncate">
                    {visit.customerName}
                  </span>
                </div>

                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10.5px] font-bold text-slate-600 border border-slate-200 shrink-0">
                  Not Started
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
                <span>{visit.carMake} {visit.carModel}</span>
                <span className="font-semibold text-slate-700">Scheduled: {formatTime(visit.scheduledTime)}</span>
              </div>

              <div className="flex items-start gap-1.5 text-xs text-slate-500">
                <IconMap width={14} height={14} className="shrink-0 text-slate-400 mt-0.5" />
                <span className="line-clamp-2">
                  {visit.customerAddress}
                  {visit.customerLandmark ? ` (${visit.customerLandmark})` : ''}
                </span>
              </div>

              {visit.customerNote && (
                <div className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200 inline-block">
                  Note: {visit.customerNote}
                </div>
              )}

              <div className="pt-2 border-t border-slate-100">
                <Link
                  href={`/staff/wash/${visit.id}`}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto sm:ml-auto rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white py-2.5 px-4 text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <IconCamera width={16} height={16} />
                  <span>Start Wash</span>
                  <IconChevron width={14} height={14} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full Photo Preview Modal */}
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
