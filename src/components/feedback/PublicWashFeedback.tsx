'use client';

import { useState } from 'react';
import Link from 'next/link';

interface PublicWashFeedbackProps {
  visitId: string;
  carPlate: string;
  carModel: string;
  washDate: string;
  cleanerName?: string | null;
  servicesDone?: string[];
  beforePhotoUrl?: string | null;
  afterPhotoUrl?: string | null;
  initialRating?: number | null;
  initialComment?: string | null;
  isExpired?: boolean;
}

export function PublicWashFeedback({
  visitId,
  carPlate,
  carModel,
  washDate,
  cleanerName,
  servicesDone = [],
  beforePhotoUrl,
  afterPhotoUrl,
  initialRating = null,
  initialComment = null,
  isExpired = false,
}: PublicWashFeedbackProps) {
  const [rating, setRating] = useState<number>(initialRating || 5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState<string>(initialComment || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(Boolean(initialRating));
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isExpired) {
      setErrorMessage('Rating period for this wash has expired (over 7 days).');
      return;
    }
    if (rating < 1 || rating > 5) {
      setErrorMessage('Please select a star rating between 1 and 5.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/customer/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitId,
          rating,
          comment: comment.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to record rating. Please try again.');
        setIsSubmitting(false);
        return;
      }

      setSubmitted(true);
      setServerMessage(data.message || 'Thank you for rating your wash experience!');
    } catch {
      setErrorMessage('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const effectiveBeforePhoto = beforePhotoUrl || '/demo/wash-before.jpg';
  const effectiveAfterPhoto = afterPhotoUrl || '/demo/wash-after.jpg';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      {/* Brand Header */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-sm border-b border-slate-800">
        <div className="mx-auto max-w-lg px-4 py-3.5 flex items-center justify-between">
          <Link href="/app" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 font-black text-white text-base">
              C
            </span>
            <span className="font-extrabold text-lg tracking-tight text-white">Carz</span>
          </Link>
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 rounded-full">
            Wash Inspection
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pt-5 space-y-4">
        {/* Vehicle & Visit Banner */}
        <div className="rounded-2xl bg-white p-5 shadow-xs border border-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="inline-block rounded-md bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-black tracking-wide text-blue-900 uppercase">
                {carPlate.toUpperCase()}
              </span>
              <h1 className="mt-1 text-lg font-bold text-slate-900">{carModel}</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {washDate}
                {cleanerName ? ` · Washed by ${cleanerName}` : ''}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-700">
              <span className="text-emerald-500">✓</span> Completed
            </span>
          </div>

          {servicesDone.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Services Performed
              </span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {servicesDone.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 rounded-md bg-slate-100 border border-slate-200/80 px-2 py-0.5 text-xs font-medium text-slate-700"
                  >
                    ✨ {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Before / After Inspection Photos */}
        <div className="rounded-2xl bg-white p-5 shadow-xs border border-slate-200 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center justify-between">
            <span>📸 Inspection Photos</span>
            <span className="text-xs font-normal text-slate-400">Quality Verified</span>
          </h2>

          <div className="grid grid-cols-2 gap-3">
            {/* Before */}
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-900 border border-slate-200 shadow-2xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={effectiveBeforePhoto}
                alt="Before wash inspection"
                className="h-full w-full object-cover"
              />
              <span className="absolute inset-x-0 bottom-0 bg-slate-900/80 backdrop-blur-xs py-1 text-center text-[11px] font-bold text-slate-200">
                Before Wash
              </span>
            </div>

            {/* After */}
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-900 border border-emerald-300 shadow-2xs ring-1 ring-emerald-500/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={effectiveAfterPhoto}
                alt="After wash inspection"
                className="h-full w-full object-cover"
              />
              <span className="absolute inset-x-0 bottom-0 bg-emerald-950/85 backdrop-blur-xs py-1 text-center text-[11px] font-bold text-emerald-300">
                ✨ After Wash
              </span>
            </div>
          </div>
        </div>

        {/* Customer Rating Card */}
        <div className="rounded-2xl bg-white p-5 shadow-xs border border-slate-200 space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">How did we do? ⭐</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Your honest feedback helps us keep quality high and rewards your wash expert.
            </p>
          </div>

          {submitted && serverMessage ? (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center space-y-2">
              <div className="text-3xl">🎉</div>
              <h3 className="text-sm font-bold text-emerald-950">Rating Saved!</h3>
              <p className="text-xs text-emerald-800">{serverMessage}</p>
              <div className="flex justify-center gap-1 pt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    className={`text-xl ${star <= rating ? 'text-amber-400' : 'text-slate-300'}`}
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 5-Star Selector */}
              <div className="flex items-center justify-center gap-2 py-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const active = (hoverRating ?? rating) >= star;
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(null)}
                      className="group p-1 focus:outline-hidden transition-transform active:scale-90"
                      aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                    >
                      <span
                        className={`text-3xl sm:text-4xl transition-colors ${
                          active ? 'text-amber-400' : 'text-slate-200 group-hover:text-amber-200'
                        }`}
                      >
                        ★
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="text-center text-xs font-semibold text-slate-600">
                {rating === 5 && '🌟 Excellent — Spotless and sparkling!'}
                {rating === 4 && '👍 Great wash, well done!'}
                {rating === 3 && '😐 Average — Room for improvement'}
                {rating === 2 && '👎 Below expectations'}
                {rating === 1 && '⚠️ Poor wash quality'}
              </div>

              {/* Comment text area */}
              <div>
                <label
                  htmlFor="rating-comment"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Feedback or notes (optional)
                </label>
                <textarea
                  id="rating-comment"
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="e.g. Great shine on the wheels, windshield is crystal clear..."
                  className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  maxLength={500}
                />
              </div>

              {errorMessage && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-800">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || isExpired}
                className="w-full rounded-xl bg-slate-900 py-3 text-xs font-bold text-white shadow-xs hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Saving Review...' : 'Submit Rating'}
              </button>
            </form>
          )}
        </div>

        {/* Navigation back to Portal */}
        <div className="text-center pt-2">
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
          >
            Go to Carz Customer Portal →
          </Link>
        </div>
      </main>
    </div>
  );
}
