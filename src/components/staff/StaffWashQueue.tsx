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
      <div className="mt-4 space-y-3.5">
        {visits.map((visit) => {
          // 1. Completed Wash State
          if (visit.status === 'DONE') {
            return (
              <div
                key={visit.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-xl border border-slate-200/70 bg-slate-50/80 p-4 transition-all"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <IconCheck width={20} height={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900 truncate">
                        {visit.customerName}
                      </span>
                      <span className="rounded-md bg-slate-200/90 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700">
                        {visit.carPlate}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        · {visit.carMake} {visit.carModel}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                      <span>Scheduled: {formatTime(visit.scheduledTime)}</span>
                      {visit.servicesDone.length > 0 && (
                        <span>• {visit.servicesDone.join(', ')}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {visit.beforePhotoUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewPhoto({ kind: 'before', url: visit.beforePhotoUrl! })
                      }
                      className="px-2.5 py-1 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      Before
                    </button>
                  )}
                  {visit.afterPhotoUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewPhoto({ kind: 'after', url: visit.afterPhotoUrl! })
                      }
                      className="px-2.5 py-1 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      After
                    </button>
                  )}
                  <span className="rounded-full bg-emerald-100/90 text-emerald-800 px-3 py-1 text-xs font-bold border border-emerald-200">
                    Done at {formatClock(visit.completedAt)}
                  </span>
                </div>
              </div>
            );
          }

          // 2. Missed / Skipped State
          if (visit.status === 'MISSED') {
            return (
              <div
                key={visit.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 truncate">
                      {visit.customerName}
                    </span>
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-800">
                      {visit.carPlate}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-amber-700">
                    {visit.missReason
                      ? MISS_REASON_LABEL[visit.missReason as keyof typeof MISS_REASON_LABEL] ||
                        visit.missReason
                      : 'Skipped / Car Not Available'}
                  </div>
                </div>

                <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-bold border border-amber-200">
                  Moved to Next Slot
                </span>
              </div>
            );
          }

          // Active / In-progress flags
          const isStarted = Boolean(visit.startedAt) || visit.status === 'IN_PROGRESS';
          const hasAfterPhoto = Boolean(visit.afterPhotoUrl);

          // Calculate elapsed time for active washes
          const startMs = visit.startedAt ? new Date(visit.startedAt).getTime() : 0;
          const elapsedSecs =
            isStarted && startMs > 0 ? Math.max(0, Math.floor((now - startMs) / 1000)) : 0;

          // 3. Washing in Progress (Started, or Work Done photo uploaded)
          if (isStarted) {
            return (
              <div
                key={visit.id}
                className="group relative overflow-hidden rounded-2xl border-2 border-emerald-500/80 bg-gradient-to-b from-white to-emerald-50/20 p-4 sm:p-5 shadow-sm transition-all hover:shadow-md"
              >
                {/* Active pulsating banner top accent */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600 animate-pulse" />

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Left Column: Car & Customer info */}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-emerald-800 border border-emerald-200">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                        </span>
                        Washing in Progress
                      </span>

                      <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-xs font-black text-white">
                        {visit.carPlate}
                      </span>

                      <span className="text-sm font-extrabold text-slate-900">
                        {visit.customerName}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-slate-600">
                      {visit.carMake} {visit.carModel} · Scheduled {formatTime(visit.scheduledTime)}
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
                  </div>

                  {/* Right Column: Big Live Timer */}
                  <div className="flex flex-col sm:flex-row md:flex-col items-start sm:items-center md:items-end justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2.5 rounded-xl bg-white px-4 py-2 border-2 border-emerald-500/70 shadow-xs">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                        <IconClock width={18} height={18} className="animate-spin-slow" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Active Cleaning Timer
                        </div>
                        <div className="font-mono text-xl sm:text-2xl font-black tracking-tight text-emerald-700">
                          {formatTimer(elapsedSecs)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Guidance & Action Bar */}
                <div className="mt-4 pt-3.5 border-t border-emerald-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  {!hasAfterPhoto ? (
                    <>
                      {/* Notice: Wash started, finish work and upload after photo */}
                      <div className="flex items-center gap-2 text-xs text-emerald-900 bg-emerald-100/60 border border-emerald-200 rounded-xl px-3 py-2 flex-1">
                        <span className="text-base shrink-0">🧼</span>
                        <span>
                          <strong>Washing started!</strong> Finish cleaning this car, then upload the{' '}
                          <strong>work done (after) photo</strong> to unlock finish wash.
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Link
                          href={`/staff/wash/${visit.id}`}
                          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-xs font-bold shadow-xs transition-colors cursor-pointer w-full sm:w-auto"
                        >
                          <IconCamera width={16} height={16} />
                          <span>Upload Work Done Photo</span>
                          <IconChevron width={14} height={14} />
                        </Link>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Notice: After photo uploaded, ready to complete */}
                      <div className="flex items-center gap-2 text-xs text-emerald-950 bg-emerald-100 border border-emerald-300 rounded-xl px-3.5 py-2 flex-1">
                        <span className="text-base shrink-0">✅</span>
                        <div className="min-w-0">
                          <p className="font-bold">Work done photo uploaded!</p>
                          <p className="text-[11px] text-emerald-800">
                            Tap <strong>Finish Wash</strong> below to record completion and update your earnings.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewPhoto({ kind: 'after', url: visit.afterPhotoUrl! })
                          }
                          className="ml-auto shrink-0 px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-white border border-emerald-300 rounded-lg hover:bg-emerald-50 transition-colors"
                        >
                          View Photo
                        </button>
                      </div>

                      {/* UNLOCKED: Finish Wash Button */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Link
                          href={`/staff/wash/${visit.id}`}
                          className="px-3 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors text-center"
                        >
                          Details
                        </Link>

                        <button
                          type="button"
                          disabled={submittingId === visit.id}
                          onClick={() => handleFinishWash(visit)}
                          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white px-5 py-2.5 text-xs font-extrabold shadow-sm transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {submittingId === visit.id ? (
                            <>
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              <span>Completing...</span>
                            </>
                          ) : (
                            <>
                              <IconCheck width={16} height={16} />
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

          // 4. Pending / Not Started State
          return (
            <div
              key={visit.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition-all hover:border-blue-400 hover:shadow-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{visit.customerName}</span>
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-700 border border-blue-100">
                      {visit.carPlate}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      · {visit.carMake} {visit.carModel}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200">
                      Not Started
                    </span>
                  </div>

                  <div className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
                    <IconMap width={14} height={14} className="shrink-0 text-slate-400 mt-0.5" />
                    <span className="line-clamp-2">
                      {visit.customerAddress}
                      {visit.customerLandmark ? ` (${visit.customerLandmark})` : ''}
                    </span>
                  </div>

                  {visit.customerNote && (
                    <div className="mt-2.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-800 border border-amber-100 inline-block">
                      Note: {visit.customerNote}
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
                  <div className="text-left sm:text-right hidden sm:block">
                    <div className="text-xs font-bold text-slate-900">
                      {formatTime(visit.scheduledTime)}
                    </div>
                    <div className="text-[10.5px] text-slate-400 font-medium">Scheduled</div>
                  </div>

                  <Link
                    href={`/staff/wash/${visit.id}`}
                    className="flex items-center justify-center gap-2 w-full sm:w-auto rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <IconCamera width={15} height={15} />
                    <span>Start Wash</span>
                    <IconChevron width={14} height={14} />
                  </Link>
                </div>
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
