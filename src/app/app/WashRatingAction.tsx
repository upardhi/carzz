'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/ui/ToastProvider';
import { safeOfflineFetch } from '@/lib/util/offlineQueue';
import { COMPLAINT_TYPES, type ComplaintType } from '@/lib/data/types';
import { COMPLAINT_TYPE_LABEL } from '@/lib/util/labels';

interface WashRatingActionProps {
  visitId: string;
  carId?: string;
  carLabel: string;
  dateLabel: string;
  staffName?: string | null;
  rating?: number | null;
  ratingComment?: string | null;
  isMissed?: boolean;
  variant?: 'inline' | 'compact';
}

export function WashRatingAction({
  visitId,
  carId,
  carLabel,
  dateLabel,
  staffName,
  rating: initialRating,
  ratingComment: initialComment,
  isMissed = false,
  variant = 'inline',
}: WashRatingActionProps) {
  const router = useRouter();
  const [currentRating, setCurrentRating] = useState<number | null>(initialRating ?? null);
  const [currentComment, setCurrentComment] = useState<string | null>(initialComment ?? null);

  // Modal visibility states
  const [showRateModal, setShowRateModal] = useState(false);
  const [showComplaintModal, setShowComplaintModal] = useState(false);

  // Rating Form states
  const [selectedStars, setSelectedStars] = useState<number>(initialRating ?? 5);
  const [hoverStars, setHoverStars] = useState<number | null>(null);
  const [ratingCommentText, setRatingCommentText] = useState(initialComment ?? '');
  const [submittingRating, setSubmittingRating] = useState(false);

  // Complaint Form states
  const [complaintType, setComplaintType] = useState<ComplaintType>(
    isMissed ? 'WASH_NOT_DONE' : 'WASH_QUALITY'
  );
  const [complaintBody, setComplaintBody] = useState('');
  const [submittingComplaint, setSubmittingComplaint] = useState(false);
  const [complaintSubmitted, setComplaintSubmitted] = useState(false);

  async function handleSaveRating(e: React.FormEvent) {
    e.preventDefault();
    if (selectedStars < 1 || selectedStars > 5) {
      toast.error('Please select between 1 and 5 stars.');
      return;
    }

    setSubmittingRating(true);
    try {
      const result = await safeOfflineFetch<{ message?: string; error?: string }>('/api/customer/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          visitId,
          rating: selectedStars,
          comment: ratingCommentText.trim() || undefined,
        },
        label: `Rating for ${carLabel}`,
      });

      if (!result.ok) {
        toast.error(result.error || 'Failed to submit review.');
        return;
      }

      setCurrentRating(selectedStars);
      setCurrentComment(ratingCommentText.trim() || null);
      setShowRateModal(false);

      if (result.queuedOffline) {
        toast.success('Rating saved offline! It will sync when reconnected.');
      } else {
        toast.success(result.data?.message || 'Thank you! Your wash rating has been saved.');
      }

      router.refresh();
    } catch {
      toast.error('Could not save rating. Please try again.');
    } finally {
      setSubmittingRating(false);
    }
  }

  async function handleSaveComplaint(e: React.FormEvent) {
    e.preventDefault();
    if (!complaintBody.trim() || complaintBody.trim().length < 5) {
      toast.error('Please describe the issue in at least 5 characters.');
      return;
    }

    setSubmittingComplaint(true);
    try {
      const res = await fetch('/api/customer/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitId,
          carId: carId || null,
          type: complaintType,
          body: complaintBody.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Could not send complaint.');
        return;
      }

      toast.success(data.message || 'Complaint submitted to your area manager.');
      setComplaintSubmitted(true);
      setShowComplaintModal(false);
      setComplaintBody('');
      router.refresh();
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setSubmittingComplaint(false);
    }
  }

  const activeStars = hoverStars ?? selectedStars;
  const filteredComplaintTypes = COMPLAINT_TYPES.filter((t) => t !== 'REFUND_DEMAND');

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. BUTTONS ON THE WASH CARD                                               */}
      {/* ========================================================================= */}
      {variant === 'compact' ? (
        <div className="flex items-center gap-2">
          {!isMissed && (
            currentRating !== null ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200/90 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                <span>★</span>
                <span>{currentRating} Rated</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setShowRateModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200/90 px-2.5 py-1 text-[11px] font-bold text-amber-800 transition-all cursor-pointer"
              >
                <span>⭐</span>
                <span>Rate</span>
              </button>
            )
          )}

          {complaintSubmitted ? (
            <span className="text-[10.5px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
              ✓ Reported
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setShowComplaintModal(true)}
              title="Report issue for this wash"
              className="inline-flex items-center gap-1 rounded-lg bg-slate-50 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 transition-all cursor-pointer"
            >
              <span>⚠️</span>
              <span>Issue</span>
            </button>
          )}
        </div>
      ) : (
        /* INLINE VARIANT FOR CAR DETAIL FEED */
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
          {/* Left Action: Rate Wash (Locked once rated) */}
          {!isMissed ? (
            <div className="flex items-center gap-2">
              {currentRating !== null ? (
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-bold text-amber-900 shadow-2xs">
                  <span>★</span>
                  <span>Rated {currentRating}.0 Stars</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowRateModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white px-3.5 py-1.5 text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <span>⭐</span>
                  <span>Rate This Wash</span>
                </button>
              )}

              {currentComment && (
                <span className="text-xs italic text-slate-500 max-w-xs truncate">
                  &ldquo;{currentComment}&rdquo;
                </span>
              )}
            </div>
          ) : (
            <div className="text-xs text-amber-800 font-medium">
              Was this wash missed or skipped unexpectedly?
            </div>
          )}

          {/* Right Action: Report Issue / Raise Complaint */}
          <div>
            {complaintSubmitted ? (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200">
                <span>✓</span>
                <span>Issue Reported</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setShowComplaintModal(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 px-3.5 py-1.5 text-xs font-bold shadow-2xs transition-all cursor-pointer"
              >
                <span>⚠️</span>
                <span>{isMissed ? 'Report Missed Wash' : 'Report Issue'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. RATE & REVIEW POPUP MODAL                                              */}
      {/* ========================================================================= */}
      {showRateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 text-lg">
                  ⭐
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Rate Your Car Wash</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {carLabel} · {dateLabel}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRateModal(false)}
                className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg p-1.5 text-sm font-bold transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveRating} className="space-y-4 text-xs">
              {staffName && (
                <div className="rounded-xl bg-blue-50/80 border border-blue-100 px-3 py-2 text-xs text-blue-900 flex items-center justify-between">
                  <span className="text-slate-600">Wash Attendant:</span>
                  <span className="font-bold text-blue-950">{staffName}</span>
                </div>
              )}

              {/* Interactive 5-Star Selector */}
              <div className="text-center py-2 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="text-xs font-semibold text-slate-500 mb-1">
                  How was the cleaning quality?
                </div>
                <div className="flex items-center justify-center gap-2" role="radiogroup" aria-label="Select star rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      role="radio"
                      aria-checked={activeStars >= star}
                      onMouseEnter={() => setHoverStars(star)}
                      onMouseLeave={() => setHoverStars(null)}
                      onClick={() => setSelectedStars(star)}
                      className="text-3xl leading-none transition-transform hover:scale-110 active:scale-95 focus:outline-none cursor-pointer"
                      style={{ color: star <= activeStars ? '#f59e0b' : '#cbd5e1' }}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 text-xs font-bold text-amber-700">
                  {activeStars === 5
                    ? '⭐️ 5 Stars — Excellent Service'
                    : activeStars === 4
                    ? '⭐️ 4 Stars — Very Good'
                    : activeStars === 3
                    ? '⭐️ 3 Stars — Average'
                    : activeStars === 2
                    ? '⭐️ 2 Stars — Needs Improvement'
                    : '⭐️ 1 Star — Poor Cleaning'}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Review & Comments (Optional)
                </label>
                <textarea
                  rows={3}
                  value={ratingCommentText}
                  onChange={(e) => setRatingCommentText(e.target.value)}
                  placeholder="Share details about shine, interior vacuuming, dashboard polish..."
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRateModal(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingRating}
                  className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 px-5 py-2 font-bold text-white transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {submittingRating ? 'Saving…' : 'Submit Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. REPORT ISSUE / COMPLAINT POPUP MODAL                                   */}
      {/* ========================================================================= */}
      {showComplaintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 text-lg">
                  ⚠️
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Report an Issue</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {carLabel} · {dateLabel}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowComplaintModal(false)}
                className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg p-1.5 text-sm font-bold transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveComplaint} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-800 mb-1.5">Issue Category *</label>
                <select
                  value={complaintType}
                  onChange={(e) => setComplaintType(e.target.value as ComplaintType)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-100 focus:outline-none"
                >
                  {filteredComplaintTypes.map((t) => (
                    <option key={t} value={t} className="text-slate-900 py-1">
                      {COMPLAINT_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1.5">Describe What Happened *</label>
                <textarea
                  rows={3}
                  required
                  value={complaintBody}
                  onChange={(e) => setComplaintBody(e.target.value)}
                  placeholder="e.g. Cleaner did not vacuum the backseat, water stains left on windshield, arrived 2 hours late..."
                  className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100 focus:outline-none"
                />
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-[11px] text-slate-600">
                ℹ️ This ticket will be assigned directly to your Area Manager for quick investigation and re-wash arrangements.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowComplaintModal(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingComplaint}
                  className="rounded-xl bg-rose-600 hover:bg-rose-700 px-5 py-2 font-bold text-white transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {submittingComplaint ? 'Submitting…' : 'Submit Issue Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
