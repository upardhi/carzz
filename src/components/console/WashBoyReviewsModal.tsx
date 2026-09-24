'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  IconStar,
  IconClock,
  IconCheck,
  IconCar,
} from '@/components/shell/icons';

interface ReviewItem {
  id: string;
  scheduledDate: string;
  dateLabel: string;
  timeLabel: string;
  startedAtLabel: string | null;
  completedAtLabel: string | null;
  durationLabel: string | null;
  onTime: boolean;
  servicesDone: string[];
  rating: number | null;
  ratingComment: string | null;
  managerRating: number | null;
  managerRatingComment: string | null;
  managerRatedAt: string | null;
  beforePhotoUrl: string | null;
  afterPhotoUrl: string | null;
  customer: {
    id: string;
    name: string;
    phone: string;
  };
  car: {
    id: string;
    make: string;
    model: string;
    plateNumber: string;
    color: string;
  };
  areaName: string;
}

interface ReviewStats {
  totalFeedback: number;
  totalWashesDone: number;
  avgCustomerRating: number | null;
  customerRatingCount: number;
  avgManagerRating: number | null;
  managerRatingCount: number;
  commentsCount: number;
  lowRatedCount: number;
  starCounts: {
    five: number;
    four: number;
    three: number;
    two: number;
    one: number;
  };
}

interface WashBoyReviewsModalProps {
  staffId: string;
  staffName: string;
  onClose: () => void;
}

export function WashBoyReviewsModal({
  staffId,
  staffName,
  onClose,
}: WashBoyReviewsModalProps) {
  const [loading, setLoading] = useState(true);
  const [ratingFilter, setRatingFilter] = useState<'ALL' | '5' | '4' | '3' | 'LOW' | 'MANAGER' | 'WITH_COMMENTS'>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(8);

  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 8,
    totalItems: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });

  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; title: string } | null>(null);

  const fetchReviews = useCallback(
    async (targetPage = page, filter = ratingFilter) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          staffId,
          ratingFilter: filter,
          page: String(targetPage),
          pageSize: String(pageSize),
        });

        const res = await fetch(`/api/ops/staff/reviews?${params.toString()}`);
        const data = await res.json();

        if (res.ok && data.ok) {
          setReviews(data.reviews || []);
          setStats(data.stats || null);
          setPagination(data.pagination || {
            page: targetPage,
            pageSize,
            totalItems: data.reviews?.length || 0,
            totalPages: Math.max(1, Math.ceil((data.reviews?.length || 0) / pageSize)),
            hasNext: false,
            hasPrev: false,
          });
        }
      } catch (err) {
        console.error('Failed to load reviews:', err);
      } finally {
        setLoading(false);
      }
    },
    [staffId, page, pageSize, ratingFilter],
  );

  useEffect(() => {
    fetchReviews(page, ratingFilter);
  }, [page, ratingFilter, fetchReviews]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewPhoto) {
          setPreviewPhoto(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, previewPhoto]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200/80 bg-slate-900 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <IconStar className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {staffName} — Reviews & Ratings
                </h2>
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-300 border border-amber-500/30">
                  Wash Boy Feedback
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Customer and manager ratings, written reviews, and wash inspection history
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
          {/* Stats Overview */}
          {stats && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              {/* Avg Rating Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                  Avg Customer Rating
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-amber-600">
                    {stats.avgCustomerRating !== null ? stats.avgCustomerRating.toFixed(1) : '—'}
                  </span>
                  <span className="text-amber-500 text-xl font-bold">★</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  From {stats.customerRatingCount} customer rating{stats.customerRatingCount === 1 ? '' : 's'}
                </div>
              </div>

              {/* Manager Rating Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                  Avg Manager Rating
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-black text-indigo-600">
                    {stats.avgManagerRating !== null ? stats.avgManagerRating.toFixed(1) : '—'}
                  </span>
                  <span className="text-indigo-500 text-xl font-bold">★</span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  From {stats.managerRatingCount} manager review{stats.managerRatingCount === 1 ? '' : 's'}
                </div>
              </div>

              {/* Written Comments */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                  Written Comments
                </div>
                <div className="mt-1 text-3xl font-black text-slate-900">
                  {stats.commentsCount}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Detailed reviews submitted
                </div>
              </div>

              {/* Low Ratings Alert */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
                <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                  Below 3★ Ratings
                </div>
                <div className={`mt-1 text-3xl font-black ${stats.lowRatedCount > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {stats.lowRatedCount}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {stats.lowRatedCount > 0 ? 'Requires attention / follow-up' : 'Zero low ratings recorded'}
                </div>
              </div>
            </div>
          )}

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'ALL', label: `All Reviews (${stats?.totalFeedback ?? 0})` },
                { id: 'WITH_COMMENTS', label: `💬 Comments (${stats?.commentsCount ?? 0})` },
                { id: '5', label: `5★ (${stats?.starCounts.five ?? 0})` },
                { id: '4', label: `4★ (${stats?.starCounts.four ?? 0})` },
                { id: '3', label: `3★ (${stats?.starCounts.three ?? 0})` },
                { id: 'LOW', label: `⚠️ Below 3★ (${stats?.lowRatedCount ?? 0})` },
                { id: 'MANAGER', label: `👔 Manager (${stats?.managerRatingCount ?? 0})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setRatingFilter(tab.id as typeof ratingFilter);
                    setPage(1);
                  }}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                    ratingFilter === tab.id
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Showing {reviews.length} of {pagination.totalItems} reviews
            </div>
          </div>

          {/* Reviews List */}
          {loading ? (
            <div className="space-y-4 py-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-36 rounded-2xl bg-white p-5 border border-slate-200 animate-pulse" />
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-2xs">
              <span className="text-4xl">🌟</span>
              <h3 className="mt-3 text-base font-bold text-slate-800">No reviews found</h3>
              <p className="mt-1 text-xs text-slate-500">
                {ratingFilter === 'ALL'
                  ? 'This wash boy does not have any recorded customer or manager reviews yet.'
                  : 'No reviews found matching the selected filter.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((rev) => {
                const hasCustomerRating = rev.rating !== null;
                const isLow = hasCustomerRating && (rev.rating ?? 5) < 3;

                return (
                  <div
                    key={rev.id}
                    className={`rounded-2xl bg-white p-5 shadow-xs border transition-shadow hover:shadow-md ${
                      isLow ? 'border-rose-200 ring-1 ring-rose-100' : 'border-slate-200'
                    }`}
                  >
                    {/* Top Row: Ratings, Date, Car, Customer */}
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3.5">
                      <div className="flex items-center gap-3">
                        {/* Rating Stars Badge */}
                        {hasCustomerRating ? (
                          <div
                            className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-sm font-black border ${
                              isLow
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : (rev.rating ?? 0) >= 4
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            <span>{rev.rating}</span>
                            <span>★</span>
                          </div>
                        ) : (
                          <span className="rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                            Unrated
                          </span>
                        )}

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">
                              {rev.customer.name}
                            </span>
                            <span className="text-xs text-slate-400">·</span>
                            <span className="text-xs text-slate-600 font-medium">
                              {rev.areaName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                            <IconCar className="h-3.5 w-3.5 text-slate-400" />
                            <span>
                              {rev.car.make} {rev.car.model} ({rev.car.plateNumber})
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right metadata */}
                      <div className="text-right">
                        <div className="text-xs font-semibold text-slate-800">
                          {rev.dateLabel}
                        </div>
                        <div className="flex items-center justify-end gap-1.5 text-[11px] text-slate-500 mt-0.5">
                          <IconClock className="h-3 w-3" />
                          <span>{rev.timeLabel}</span>
                          {rev.durationLabel && (
                            <>
                              <span>·</span>
                              <span>{rev.durationLabel}</span>
                            </>
                          )}
                          {rev.onTime && (
                            <span className="inline-flex items-center gap-0.5 text-emerald-600 font-semibold ml-1">
                              <IconCheck className="h-3 w-3" /> On-time
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Feedback content */}
                    <div className="pt-3.5 space-y-3">
                      {/* Customer Comment */}
                      {rev.ratingComment ? (
                        <div className="rounded-xl bg-amber-50/60 p-3 border border-amber-100/80">
                          <div className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider text-amber-800 mb-1">
                            <span>💬</span> Customer Feedback
                          </div>
                          <p className="text-xs font-medium text-slate-800 italic leading-relaxed">
                            &ldquo;{rev.ratingComment}&rdquo;
                          </p>
                        </div>
                      ) : null}

                      {/* Manager Review */}
                      {(rev.managerRating !== null || rev.managerRatingComment) && (
                        <div className="rounded-xl bg-indigo-50/60 p-3 border border-indigo-100/80">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider text-indigo-800">
                              <span>👔</span> Manager Inspection Rating
                            </div>
                            {rev.managerRating !== null && (
                              <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-xs font-black text-indigo-700">
                                {rev.managerRating} ★
                              </span>
                            )}
                          </div>
                          {rev.managerRatingComment && (
                            <p className="text-xs font-medium text-slate-800 leading-relaxed">
                              {rev.managerRatingComment}
                            </p>
                          )}
                          {rev.managerRatedAt && (
                            <span className="text-[10.5px] text-indigo-600 mt-1 block">
                              Evaluated on {rev.managerRatedAt}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Photos & Services */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        {/* Services Done */}
                        {rev.servicesDone.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {rev.servicesDone.map((srv, idx) => (
                              <span
                                key={idx}
                                className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                              >
                                {srv}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div />
                        )}

                        {/* Before & After Photos Thumbnails */}
                        {(rev.beforePhotoUrl || rev.afterPhotoUrl) && (
                          <div className="flex items-center gap-2">
                            {rev.beforePhotoUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewPhoto({
                                    url: rev.beforePhotoUrl!,
                                    title: `Before Wash — ${rev.car.plateNumber} (${rev.dateLabel})`,
                                  })
                                }
                                className="group relative flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-1 hover:bg-slate-100 transition-colors"
                              >
                                <div className="relative h-8 w-8 overflow-hidden rounded-md bg-slate-200">
                                  <Image
                                    src={rev.beforePhotoUrl}
                                    alt="Before wash"
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                                <span className="text-[11px] font-bold text-slate-700 pr-1">
                                  Before
                                </span>
                              </button>
                            )}

                            {rev.afterPhotoUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewPhoto({
                                    url: rev.afterPhotoUrl!,
                                    title: `After Wash — ${rev.car.plateNumber} (${rev.dateLabel})`,
                                  })
                                }
                                className="group relative flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-1 hover:bg-slate-100 transition-colors"
                              >
                                <div className="relative h-8 w-8 overflow-hidden rounded-md bg-slate-200">
                                  <Image
                                    src={rev.afterPhotoUrl}
                                    alt="After wash"
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                                <span className="text-[11px] font-bold text-emerald-700 pr-1">
                                  After ✨
                                </span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <div className="text-xs text-slate-500 font-medium">
                Page <span className="font-bold text-slate-800">{pagination.page}</span> of{' '}
                <span className="font-bold text-slate-800">{pagination.totalPages}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!pagination.hasPrev || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← Previous
                </button>
                <button
                  type="button"
                  disabled={!pagination.hasNext || loading}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end border-t border-slate-200 bg-white px-6 py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800 transition-colors shadow-xs"
          >
            Close
          </button>
        </div>
      </div>

      {/* Lightbox Photo Preview */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-4 py-3 text-white">
              <span className="text-xs font-bold">{previewPhoto.title}</span>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="relative h-[65vh] w-full min-w-[320px] bg-slate-950">
              <Image
                src={previewPhoto.url}
                alt={previewPhoto.title}
                fill
                className="object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
