'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  IconCheckCircle,
  IconClock,
  IconSearch,
  IconSliders,
  IconUser,
} from '@/components/shell/icons';
import { StatCard, StatGrid } from '@/components/ui/primitives';
import { formatDateFull, formatTime } from '@/lib/util/format';
import type { WhatsAppMessageRecord, WhatsAppStats } from '@/lib/services/whatsappQueue';

interface WhatsAppTrackRecordProps {
  isOpen?: boolean;
  onClose?: () => void;
  standalone?: boolean;
  initialBatchId?: string | null;
  initialStatusFilter?: string;
}

export function WhatsAppTrackRecord({
  isOpen = true,
  onClose,
  standalone = false,
  initialBatchId,
  initialStatusFilter = 'ALL',
}: WhatsAppTrackRecordProps) {
  const [mounted, setMounted] = useState(false);
  const [logs, setLogs] = useState<WhatsAppMessageRecord[]>([]);
  const [stats, setStats] = useState<WhatsAppStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [eventFilter, setEventFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRetryingAll, setIsRetryingAll] = useState(false);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Full message inspection states
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [previewMessage, setPreviewMessage] = useState<WhatsAppMessageRecord | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: '15',
        status: statusFilter,
        event: eventFilter,
        search: searchQuery,
      });

      if (initialBatchId) {
        params.set('batchId', initialBatchId);
      }

      const res = await fetch(`/api/ops/notifications/queue?${params.toString()}`);
      if (!res.ok) return;

      const data = await res.json();
      setLogs(data.records || []);
      setStats(data.stats || null);
      setTotalPages(data.totalPages || 1);
      setTotalItems(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch WhatsApp track records:', err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, eventFilter, searchQuery, initialBatchId]);

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, fetchLogs]);

  // Polling when queue has pending messages
  useEffect(() => {
    if (!isOpen) return;
    if (stats && (stats.totalQueued > 0 || stats.totalProcessing > 0)) {
      const timer = setInterval(() => {
        fetchLogs();
      }, 3000);
      return () => clearInterval(timer);
    }
  }, [isOpen, stats, fetchLogs]);

  // Clear toast after 4s
  useEffect(() => {
    if (!actionSuccessMessage) return;
    const timer = setTimeout(() => setActionSuccessMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [actionSuccessMessage]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleRetryFailedAll() {
    setIsRetryingAll(true);
    try {
      const res = await fetch('/api/ops/notifications/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry' }),
      });
      if (res.ok) {
        const data = await res.json();
        setActionSuccessMessage(data.message || 'All failed messages re-queued for delivery.');
        fetchLogs();
      }
    } finally {
      setIsRetryingAll(false);
    }
  }

  async function handleRetrySingle(jobId: string) {
    setRetryingIds((prev) => new Set(prev).add(jobId));
    try {
      const res = await fetch('/api/ops/notifications/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry', jobIds: [jobId] }),
      });
      if (res.ok) {
        setActionSuccessMessage('Message re-queued for delivery.');
        fetchLogs();
        if (previewMessage && previewMessage.id === jobId) {
          setPreviewMessage((prev) => (prev ? { ...prev, status: 'QUEUED', error: null } : null));
        }
      }
    } catch (err) {
      console.error('Failed to retry message:', err);
    } finally {
      setRetryingIds((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  }

  function handleCopyMessage(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!isOpen) return null;

  const content = (
    <div className={`relative flex flex-col w-full ${standalone ? 'min-h-[700px] rounded-2xl border border-slate-200 bg-white shadow-sm' : 'max-w-6xl h-[90vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl'}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs text-lg">
            💬
          </div>
          <div>
            <h2 className="text-lg font-bold text-navy-950">
              WhatsApp Message Track Record & Delivery Monitor
            </h2>
            <p className="text-xs text-slate-500">
              Live delivery status, failure diagnostics, one-click resend, and Meta message confirmations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {actionSuccessMessage && (
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-100 border border-emerald-300 px-3 py-1 text-xs font-semibold text-emerald-800 animate-fade-in">
              ✓ {actionSuccessMessage}
            </span>
          )}
          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-100 transition-colors"
          >
            {loading ? 'Refreshing...' : '↻ Refresh'}
          </button>
          {!standalone && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-800 font-semibold"
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Top KPI Metrics Bar with interactive click-to-filter */}
      {stats && (
        <div className="border-b border-slate-100 px-6 py-3 bg-white">
          <StatGrid columns={4}>
            <div
              onClick={() => {
                setStatusFilter('ALL');
                setPage(1);
              }}
              className={`cursor-pointer rounded-2xl transition-all ${
                statusFilter === 'ALL' ? 'ring-2 ring-blue-500 ring-offset-1' : 'hover:opacity-90'
              }`}
              title="Click to view all messages"
            >
              <StatCard
                label="TOTAL SENT"
                value={stats.totalSent}
                tone="emerald"
                icon={<IconCheckCircle width={18} height={18} />}
                subtext={`${stats.successRate}% delivery rate`}
                subtextTone="success"
              />
            </div>

            <div
              onClick={() => {
                setStatusFilter('QUEUED');
                setPage(1);
              }}
              className={`cursor-pointer rounded-2xl transition-all ${
                statusFilter === 'QUEUED' || statusFilter === 'PROCESSING'
                  ? 'ring-2 ring-sky-500 ring-offset-1'
                  : 'hover:opacity-90'
              }`}
              title="Click to view queue"
            >
              <StatCard
                label="IN QUEUE"
                value={stats.totalQueued + stats.totalProcessing}
                tone="sky"
                icon={<IconClock width={18} height={18} />}
                subtext={stats.totalProcessing > 0 ? `${stats.totalProcessing} delivering now` : 'Idle'}
                subtextTone="info"
              />
            </div>

            <div
              onClick={() => {
                setStatusFilter('FAILED');
                setPage(1);
              }}
              className={`cursor-pointer rounded-2xl transition-all ${
                statusFilter === 'FAILED'
                  ? 'ring-2 ring-rose-500 ring-offset-1'
                  : stats.totalFailed > 0
                  ? 'hover:ring-2 hover:ring-rose-300'
                  : 'hover:opacity-90'
              }`}
              title="Click to see failed messages only"
            >
              <StatCard
                label="FAILED"
                value={stats.totalFailed}
                tone={stats.totalFailed > 0 ? 'rose' : 'slate'}
                icon={<span className="text-sm">⚠️</span>}
                subtext={stats.totalFailed > 0 ? 'Click to inspect & resend' : 'Zero delivery errors'}
                subtextTone={stats.totalFailed > 0 ? 'danger' : 'muted'}
              />
            </div>

            <div
              onClick={() => {
                setStatusFilter('SENT');
                setPage(1);
              }}
              className={`cursor-pointer rounded-2xl transition-all ${
                statusFilter === 'SENT' ? 'ring-2 ring-purple-500 ring-offset-1' : 'hover:opacity-90'
              }`}
              title="Click to view sent messages"
            >
              <StatCard
                label="THROUGHPUT"
                value={`${stats.rateLimitPerSec}/s`}
                tone="purple"
                icon={<span className="text-sm">⚡</span>}
                subtext="Meta rate-limit protected"
                subtextTone="neutral"
              />
            </div>
          </StatGrid>

          {/* Prominent Action Banner for Failed Messages */}
          {stats.totalFailed > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-white font-bold text-[10px]">
                  !
                </span>
                <span className="font-semibold text-rose-900">
                  {stats.totalFailed} message{stats.totalFailed === 1 ? '' : 's'} failed delivery.
                </span>
                <span className="hidden sm:inline text-rose-700">
                  (Invalid phone format, customer WhatsApp opt-out, or network error)
                </span>
              </div>
              <div className="flex items-center gap-2">
                {statusFilter !== 'FAILED' && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter('FAILED');
                      setPage(1);
                    }}
                    className="rounded-lg border border-rose-300 bg-white px-3 py-1 font-semibold text-rose-800 hover:bg-rose-100 shadow-2xs transition-colors"
                  >
                    👁 View Failed Only ({stats.totalFailed})
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleRetryFailedAll}
                  disabled={isRetryingAll}
                  className="rounded-lg bg-rose-600 px-3.5 py-1 font-bold text-white hover:bg-rose-700 shadow-2xs transition-colors flex items-center gap-1.5"
                >
                  {isRetryingAll ? (
                    <>
                      <span className="inline-block animate-spin">↻</span>
                      <span>Resending All...</span>
                    </>
                  ) : (
                    <>
                      <span>↻</span>
                      <span>Resend All Failed ({stats.totalFailed})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-3 bg-slate-50/70">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Quick Segmented Filter Tabs */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100/80 p-0.5 text-xs shadow-2xs">
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setPage(1);
              }}
              className={`rounded-lg px-2.5 py-1 font-semibold transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-white text-navy-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All {stats ? `(${stats.total})` : ''}
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('FAILED');
                setPage(1);
              }}
              className={`rounded-lg px-2.5 py-1 font-semibold transition-all flex items-center gap-1 ${
                statusFilter === 'FAILED'
                  ? 'bg-rose-600 text-white shadow-xs font-bold'
                  : stats?.totalFailed
                  ? 'text-rose-700 hover:bg-rose-100/80 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Failed</span>
              {stats && stats.totalFailed > 0 && (
                <span className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.2 text-[10px] ${statusFilter === 'FAILED' ? 'bg-white text-rose-700 font-extrabold' : 'bg-rose-600 text-white'}`}>
                  {stats.totalFailed}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('SENT');
                setPage(1);
              }}
              className={`rounded-lg px-2.5 py-1 font-semibold transition-all ${
                statusFilter === 'SENT'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sent {stats ? `(${stats.totalSent})` : ''}
            </button>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('QUEUED');
                setPage(1);
              }}
              className={`rounded-lg px-2.5 py-1 font-semibold transition-all ${
                statusFilter === 'QUEUED'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Queued {stats ? `(${stats.totalQueued + stats.totalProcessing})` : ''}
            </button>
          </div>

          {/* Search */}
          <div className="relative flex items-center">
            <IconSearch width={14} height={14} className="absolute left-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search recipient, phone, or text..."
              className="h-8 w-52 sm:w-64 rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none shadow-2xs"
            />
          </div>

          {/* Event Filter */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-800 shadow-2xs">
            <IconSliders width={13} height={13} className="text-blue-600" />
            <span className="text-slate-400 hidden sm:inline">Event:</span>
            <select
              value={eventFilter}
              onChange={(e) => {
                setEventFilter(e.target.value);
                setPage(1);
              }}
              className="cursor-pointer bg-transparent font-semibold text-slate-800 focus:outline-none"
            >
              <option value="ALL">All triggers</option>
              <option value="Wash Completed">Wash Completed</option>
              <option value="Payment Approved">Payment Approved</option>
              <option value="Wash Skipped">Wash Skipped</option>
              <option value="Invoice Due">Invoice Due</option>
              <option value="Customer Welcome">Customer Welcome</option>
              <option value="Morning Route">Morning Route</option>
              <option value="Advance Wash Reminder">Advance Wash Reminder</option>
              <option value="Today Wash Reminder">Today Wash Reminder</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="font-bold text-slate-800">{logs.length}</span> of {totalItems} messages
          {statusFilter === 'FAILED' && (
            <span className="ml-2 font-bold text-rose-600">(Filtering: Failed only)</span>
          )}
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto">
        {logs.length === 0 ? (
          <div className="flex h-64 sm:h-96 flex-col items-center justify-center p-8 text-center text-slate-400">
            <span className="text-4xl mb-2">💬</span>
            <p className="text-sm font-semibold text-slate-700">
              {statusFilter === 'FAILED'
                ? 'No failed messages found!'
                : 'No WhatsApp messages found'}
            </p>
            <p className="text-xs mt-1 text-slate-500 max-w-sm">
              {statusFilter === 'FAILED'
                ? 'All outbound messages have delivered successfully with zero errors.'
                : 'Dispatched wash alerts, invoice reminders, and morning routes will appear here.'}
            </p>
            {statusFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('ALL');
                  setPage(1);
                }}
                className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-slate-50 shadow-2xs"
              >
                Clear filter & view all messages
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-slate-100/95 backdrop-blur-xs text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 z-10">
              <tr>
                <th className="py-2.5 px-4">When</th>
                <th className="py-2.5 px-4">Recipient</th>
                <th className="py-2.5 px-4">Event Trigger</th>
                <th className="py-2.5 px-4 min-w-[280px]">Message Sent</th>
                <th className="py-2.5 px-4">Delivery Status</th>
                <th className="py-2.5 px-4">Meta ID / Error</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((item) => {
                const isExpanded = expandedIds.has(item.id);

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      item.status === 'FAILED' ? 'bg-rose-50/40' : ''
                    }`}
                  >
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600 align-top">
                      <div className="font-semibold text-slate-900">
                        {formatDateFull(item.sentAt || item.createdAt)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {formatTime(new Date(item.sentAt || item.createdAt).toTimeString().slice(0, 5))}
                      </div>
                    </td>

                    <td className="py-3 px-4 align-top">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <IconUser width={12} height={12} className="text-slate-400" />
                        <span>{item.recipientName}</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        +{item.to}
                      </div>
                      <span className="inline-block mt-0.5 rounded px-1.5 py-0.2 text-[9.5px] font-bold uppercase tracking-wider border border-slate-200 text-slate-600 bg-slate-50">
                        {item.recipientType}
                      </span>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap align-top">
                      <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                        {item.event}
                      </span>
                    </td>

                    {/* Message Column with Full View Controls */}
                    <td className="py-3 px-4 align-top max-w-sm sm:max-w-md md:max-w-lg">
                      <div className="flex flex-col gap-1.5">
                        <div
                          onClick={() => setPreviewMessage(item)}
                          className="cursor-pointer group"
                          title="Click to open full WhatsApp chat preview"
                        >
                          <p
                            className={`text-slate-800 text-xs leading-relaxed font-sans transition-all ${
                              isExpanded
                                ? 'whitespace-pre-wrap bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono text-[11px]'
                                : 'line-clamp-2 group-hover:text-blue-600'
                            }`}
                          >
                            {item.message}
                          </p>
                        </div>

                        {/* Interactive Buttons: Toggle expand + Open Chat Modal */}
                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold pt-0.5">
                          <button
                            type="button"
                            onClick={() => toggleExpand(item.id)}
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {isExpanded ? '▴ Collapse' : '▾ Show full message'}
                          </button>

                          <span className="text-slate-300">•</span>

                          <button
                            type="button"
                            onClick={() => setPreviewMessage(item)}
                            className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-900 hover:underline font-bold"
                            title="Open full message in WhatsApp preview modal"
                          >
                            <span>👁 Full WhatsApp Preview</span>
                          </button>

                          {item.mediaUrl && (
                            <>
                              <span className="text-slate-300">•</span>
                              <a
                                href={item.mediaUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[10px] text-amber-800 font-semibold hover:bg-amber-100 transition-colors"
                              >
                                📷 View Photo
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap align-top">
                      {item.status === 'SENT' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                          ✓ Sent
                        </span>
                      ) : item.status === 'QUEUED' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">
                          ⏱ Queued
                        </span>
                      ) : item.status === 'PROCESSING' ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 border border-sky-200 px-2.5 py-0.5 text-[11px] font-bold text-sky-700 animate-pulse">
                          ⚡ Sending
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[11px] font-bold text-rose-700"
                          title={item.error || 'Delivery failed'}
                        >
                          ✕ Failed
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 max-w-xs text-[11px] align-top">
                      {item.metaMessageId ? (
                        <span className="font-mono text-slate-500 truncate block" title={item.metaMessageId}>
                          {item.metaMessageId}
                        </span>
                      ) : item.error ? (
                        <span className="text-rose-600 font-medium line-clamp-2" title={item.error}>
                          {item.error}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap text-right align-top">
                      {item.status === 'FAILED' ? (
                        <button
                          type="button"
                          onClick={() => handleRetrySingle(item.id)}
                          disabled={retryingIds.has(item.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 hover:border-rose-400 active:scale-95 transition-all shadow-2xs disabled:opacity-50"
                          title="Retry sending this message now"
                        >
                          {retryingIds.has(item.id) ? (
                            <>
                              <span className="inline-block animate-spin">↻</span>
                              <span>Resending...</span>
                            </>
                          ) : (
                            <>
                              <span>↻</span>
                              <span>Resend</span>
                            </>
                          )}
                        </button>
                      ) : item.status === 'SENT' ? (
                        <span className="text-[11px] text-slate-400 font-medium">Delivered</span>
                      ) : (
                        <span className="text-[11px] text-amber-600 font-medium">In Queue</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer Pagination */}
      <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3 bg-slate-50 text-xs">
        <div className="text-slate-500 font-medium">
          Page <span className="font-bold text-slate-800">{page}</span> of {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors shadow-2xs"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 transition-colors shadow-2xs"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {standalone ? (
        content
      ) : (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-navy-950/80 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && onClose) onClose();
          }}
        >
          {content}
        </div>
      )}

      {/* ========================================================================= */}
      {/* WHATSAPP FULL MESSAGE PREVIEW MODAL (PORTALED TO BODY TO PREVENT Z-INDEX BUGS) */}
      {/* ========================================================================= */}
      {previewMessage && mounted && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-navy-950/85 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewMessage(null);
          }}
        >
          <div className="relative flex flex-col w-full max-w-lg overflow-hidden rounded-2xl border border-slate-600/50 bg-[#e5ddd5] shadow-2xl max-h-[90vh]">
            {/* WhatsApp App Bar */}
            <div className="flex items-center justify-between bg-[#075e54] px-4 py-3 text-white shadow-md">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-white font-bold text-sm">
                  {previewMessage.recipientName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm leading-tight text-white truncate">
                      {previewMessage.recipientName}
                    </h3>
                    <span className="shrink-0 rounded bg-white/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-100">
                      {previewMessage.recipientType}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-100/90 font-mono">
                    +{previewMessage.to}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPreviewMessage(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 transition-colors font-bold text-sm"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Chat Body Wallpaper */}
            <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-3">
              {/* Event Badge in chat */}
              <div className="self-center rounded-lg bg-white/90 backdrop-blur-xs border border-slate-200/80 px-3 py-1 text-[11px] font-bold text-slate-700 shadow-2xs">
                Trigger: {previewMessage.event}
              </div>

              {/* Message Bubble (Outgoing) */}
              <div className="self-end max-w-[88%] rounded-2xl rounded-tr-none bg-[#d9fdd3] text-slate-900 p-3.5 shadow-sm border border-emerald-300/40">
                {/* Media Preview if attached */}
                {previewMessage.mediaUrl && (
                  <div className="mb-2 overflow-hidden rounded-xl border border-emerald-200 bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewMessage.mediaUrl}
                      alt="Attached wash proof"
                      className="max-h-60 w-full object-cover"
                    />
                    <div className="p-1.5 bg-emerald-50 text-[10px] font-semibold text-emerald-800 flex justify-between items-center">
                      <span>📸 Attached Media Proof</span>
                      <a
                        href={previewMessage.mediaUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-emerald-950 font-bold"
                      >
                        Open Full
                      </a>
                    </div>
                  </div>
                )}

                {/* Message Text with preserved whitespace and formatting */}
                <p className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-900 break-words select-text">
                  {previewMessage.message}
                </p>

                {/* Timestamp and Double Checkmark */}
                <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-slate-500 font-medium">
                  <span>
                    {formatTime(new Date(previewMessage.sentAt || previewMessage.createdAt).toTimeString().slice(0, 5))}
                  </span>
                  {previewMessage.status === 'SENT' ? (
                    <span className="font-bold text-sky-600" title="Delivered to WhatsApp">
                      ✓✓
                    </span>
                  ) : previewMessage.status === 'QUEUED' ? (
                    <span className="text-slate-400" title="Queued">
                      ⏱
                    </span>
                  ) : previewMessage.status === 'PROCESSING' ? (
                    <span className="text-amber-500" title="Sending">
                      ⚡
                    </span>
                  ) : (
                    <span className="text-rose-600 font-bold" title="Failed">
                      ✕
                    </span>
                  )}
                </div>
              </div>

              {/* Error Diagnostics if failed */}
              {previewMessage.status === 'FAILED' && (
                <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900 shadow-2xs">
                  <div className="font-bold flex items-center gap-1.5 text-rose-800 mb-1">
                    <span>⚠️</span>
                    <span>Delivery Failure Diagnostic:</span>
                  </div>
                  <p className="font-mono text-[11px] bg-white/80 p-2 rounded border border-rose-200 break-words">
                    {previewMessage.error || 'Meta API returned delivery error'}
                  </p>
                  <p className="text-[10px] text-rose-700 mt-1">
                    Attempts made: {previewMessage.retryCount} of {previewMessage.maxRetries}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Bottom Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-300 bg-white px-4 py-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyMessage(previewMessage.message)}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-2xs transition-colors flex items-center gap-1.5"
                >
                  {copied ? '✓ Copied!' : '📋 Copy Text'}
                </button>

                {previewMessage.metaMessageId && (
                  <span className="font-mono text-[10px] text-slate-400 truncate max-w-[140px]" title={previewMessage.metaMessageId}>
                    ID: {previewMessage.metaMessageId}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {previewMessage.status === 'FAILED' && (
                  <button
                    type="button"
                    onClick={() => handleRetrySingle(previewMessage.id)}
                    disabled={retryingIds.has(previewMessage.id)}
                    className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700 shadow-2xs transition-colors flex items-center gap-1.5"
                  >
                    {retryingIds.has(previewMessage.id) ? (
                      <>
                        <span className="inline-block animate-spin">↻</span>
                        <span>Resending...</span>
                      </>
                    ) : (
                      <>
                        <span>↻</span>
                        <span>Resend Message Now</span>
                      </>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewMessage(null)}
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
