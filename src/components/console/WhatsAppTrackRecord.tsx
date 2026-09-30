'use client';

import { useState, useEffect, useCallback } from 'react';
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
  isOpen: boolean;
  onClose: () => void;
  initialBatchId?: string | null;
}

export function WhatsAppTrackRecord({
  isOpen,
  onClose,
  initialBatchId,
}: WhatsAppTrackRecordProps) {
  const [logs, setLogs] = useState<WhatsAppMessageRecord[]>([]);
  const [stats, setStats] = useState<WhatsAppStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [eventFilter, setEventFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);

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

  async function handleRetryFailed() {
    setIsRetrying(true);
    try {
      const res = await fetch('/api/ops/notifications/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry' }),
      });
      if (res.ok) {
        fetchLogs();
      }
    } finally {
      setIsRetrying(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-navy-950/80 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex flex-col w-full max-w-5xl h-[90vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs text-lg">
              💬
            </div>
            <div>
              <h2 className="text-lg font-bold text-navy-950">
                WhatsApp Track Record & Delivery Monitor
              </h2>
              <p className="text-xs text-slate-500">
                Live delivery status, timestamp logs, and Meta message confirmations
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchLogs}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-100 transition-colors"
            >
              {loading ? 'Refreshing...' : '↻ Refresh'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-800 font-semibold"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Top KPI Metrics Bar */}
        {stats && (
          <div className="border-b border-slate-100 px-6 py-3 bg-white">
            <StatGrid columns={4}>
              <StatCard
                label="TOTAL SENT"
                value={stats.totalSent}
                tone="emerald"
                icon={<IconCheckCircle width={18} height={18} />}
                subtext={`${stats.successRate}% delivery rate`}
                subtextTone="success"
              />
              <StatCard
                label="IN QUEUE"
                value={stats.totalQueued + stats.totalProcessing}
                tone="sky"
                icon={<IconClock width={18} height={18} />}
                subtext={stats.totalProcessing > 0 ? `${stats.totalProcessing} delivering now` : 'Idle'}
                subtextTone="info"
              />
              <StatCard
                label="FAILED"
                value={stats.totalFailed}
                tone={stats.totalFailed > 0 ? 'rose' : 'slate'}
                icon={<span className="text-sm">⚠️</span>}
                subtext={stats.totalFailed > 0 ? 'Click retry below' : 'Zero errors'}
                subtextTone={stats.totalFailed > 0 ? 'danger' : 'muted'}
              />
              <StatCard
                label="THROUGHPUT"
                value={`${stats.rateLimitPerSec}/s`}
                tone="purple"
                icon={<span className="text-sm">⚡</span>}
                subtext="Meta rate-limit protected"
                subtextTone="neutral"
              />
            </StatGrid>

            {stats.totalFailed > 0 && (
              <div className="mt-3 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs">
                <span className="font-semibold text-rose-900">
                  {stats.totalFailed} message{stats.totalFailed === 1 ? '' : 's'} encountered delivery issues (e.g. invalid phone number or network timeout).
                </span>
                <button
                  type="button"
                  onClick={handleRetryFailed}
                  disabled={isRetrying}
                  className="rounded-lg bg-rose-600 px-3 py-1 font-semibold text-white hover:bg-rose-700 shadow-2xs transition-colors"
                >
                  {isRetrying ? 'Retrying...' : '↻ Retry Failed'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-3 bg-slate-50/70">
          <div className="flex flex-wrap items-center gap-3">
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
                className="h-8 w-60 rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:outline-none shadow-2xs"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-800 shadow-2xs">
              <IconSliders width={13} height={13} className="text-blue-600" />
              <span className="text-slate-400">Status —</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="cursor-pointer bg-transparent font-semibold text-slate-800 focus:outline-none"
              >
                <option value="ALL">All statuses</option>
                <option value="SENT">Sent</option>
                <option value="QUEUED">Queued</option>
                <option value="PROCESSING">Processing</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>

            {/* Event Filter */}
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-800 shadow-2xs">
              <span className="text-slate-400">Event —</span>
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
            Showing {logs.length} of {totalItems} messages
          </div>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto">
          {logs.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center text-slate-400">
              <span className="text-3xl mb-2">💬</span>
              <p className="text-sm font-semibold text-slate-600">No WhatsApp messages found</p>
              <p className="text-xs mt-1">Dispatched wash alerts, invoice reminders, and routes will appear here.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-100/90 backdrop-blur-xs text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">When</th>
                  <th className="py-2.5 px-4">Recipient</th>
                  <th className="py-2.5 px-4">Event Trigger</th>
                  <th className="py-2.5 px-4">Message Sent</th>
                  <th className="py-2.5 px-4">Delivery Status</th>
                  <th className="py-2.5 px-4">Meta ID / Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                      <div className="font-semibold text-slate-900">
                        {formatDateFull(item.sentAt || item.createdAt)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {formatTime(new Date(item.sentAt || item.createdAt).toTimeString().slice(0, 5))}
                      </div>
                    </td>

                    <td className="py-3 px-4">
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

                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                        {item.event}
                      </span>
                    </td>

                    <td className="py-3 px-4 max-w-xs sm:max-w-md">
                      <p className="text-slate-700 line-clamp-2 leading-relaxed font-sans text-xs">
                        {item.message}
                      </p>
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
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

                    <td className="py-3 px-4 max-w-xs text-[11px]">
                      {item.metaMessageId ? (
                        <span className="font-mono text-slate-500 truncate block" title={item.metaMessageId}>
                          {item.metaMessageId}
                        </span>
                      ) : item.error ? (
                        <span className="text-rose-600 font-medium truncate block" title={item.error}>
                          {item.error}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer Pagination */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3 bg-slate-50 text-xs">
          <div className="text-slate-500 font-medium">
            Page {page} of {totalPages}
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
    </div>
  );
}
