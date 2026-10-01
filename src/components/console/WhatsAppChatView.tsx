'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import type { WhatsAppMessageRecord, WhatsAppJobStatus } from '@/lib/services/whatsappQueue';
import { formatDateFull, formatTime } from '@/lib/util/format';

interface ChatThread {
  contactKey: string; // phone number
  name: string;
  phone: string;
  recipientType: 'CUSTOMER' | 'STAFF';
  recipientId?: string;
  messages: WhatsAppMessageRecord[];
  lastMessage: WhatsAppMessageRecord;
  failedCount: number;
  pendingCount: number;
}

interface WhatsAppChatViewProps {
  initialContactKey?: string;
  onSelectContact?: (phone: string) => void;
}

export function WhatsAppChatView({
  initialContactKey,
  onSelectContact,
}: WhatsAppChatViewProps) {
  const [messages, setMessages] = useState<WhatsAppMessageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeContactKey, setActiveContactKey] = useState<string | null>(initialContactKey || null);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'UNREAD' | 'CUSTOMER' | 'STAFF' | 'FAILED'>('ALL');

  // Composer
  const [composerText, setComposerText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showQuickTemplates, setShowQuickTemplates] = useState(false);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const [notificationToast, setNotificationToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  // Image preview modal
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch all recent messages
  async function fetchMessages(isBackground = false) {
    if (!isBackground) setLoading(true);
    else setRefreshing(true);

    try {
      const res = await fetch('/api/ops/notifications/queue?limit=1000&page=1');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.records)) {
        setMessages(data.records);
      }
    } catch (err) {
      console.error('Failed to load WhatsApp messages:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchMessages();
  }, []);

  // Auto-resize composer textarea as user types or templates are inserted
  const adjustTextareaHeight = () => {
    if (composerInputRef.current) {
      composerInputRef.current.style.height = 'auto';
      const scrollHeight = composerInputRef.current.scrollHeight;
      composerInputRef.current.style.height = `${Math.min(Math.max(scrollHeight, 24), 180)}px`;
    }
  };

  // Group messages into contact threads
  const threads = useMemo<ChatThread[]>(() => {
    const map = new Map<string, WhatsAppMessageRecord[]>();

    for (const m of messages) {
      const key = m.to || 'Unknown';
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(m);
    }

    const result: ChatThread[] = [];

    for (const [phone, threadMsgs] of map.entries()) {
      const sorted = [...threadMsgs].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );

      const last = sorted[sorted.length - 1];
      const failedCount = sorted.filter((m) => m.status === 'FAILED').length;
      const pendingCount = sorted.filter((m) => m.status === 'QUEUED' || m.status === 'PROCESSING').length;

      const bestName =
        sorted.find((m) => m.recipientName && m.recipientName !== 'Recipient')?.recipientName ||
        last.recipientName ||
        formatPhonePretty(phone);

      result.push({
        contactKey: phone,
        name: bestName,
        phone,
        recipientType: last.recipientType || 'CUSTOMER',
        recipientId: last.recipientId,
        messages: sorted,
        lastMessage: last,
        failedCount,
        pendingCount,
      });
    }

    return result.sort(
      (a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime(),
    );
  }, [messages]);

  // Filtered threads list
  const filteredThreads = useMemo(() => {
    return threads.filter((t) => {
      if (filterType === 'CUSTOMER' && t.recipientType !== 'CUSTOMER') return false;
      if (filterType === 'STAFF' && t.recipientType !== 'STAFF') return false;
      if (filterType === 'FAILED' && t.failedCount === 0) return false;
      if (filterType === 'UNREAD' && t.failedCount === 0 && t.pendingCount === 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = t.name.toLowerCase().includes(q);
        const matchesPhone = t.phone.toLowerCase().includes(q);
        const matchesContent = t.messages.some((m) => m.message.toLowerCase().includes(q));
        return matchesName || matchesPhone || matchesContent;
      }

      return true;
    });
  }, [threads, filterType, searchQuery]);

  // Default active contact
  useEffect(() => {
    if (!activeContactKey && filteredThreads.length > 0) {
      setActiveContactKey(filteredThreads[0].contactKey);
    }
  }, [filteredThreads, activeContactKey]);

  // Active thread
  const activeThread = useMemo(() => {
    return threads.find((t) => t.contactKey === activeContactKey) || null;
  }, [threads, activeContactKey]);

  // Scroll to bottom on thread change or new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeContactKey, activeThread?.messages.length]);

  // Toast timer
  useEffect(() => {
    if (!notificationToast) return;
    const t = setTimeout(() => setNotificationToast(null), 3500);
    return () => clearTimeout(t);
  }, [notificationToast]);

  // Actions: Retry single message
  async function handleRetryMessage(jobId: string) {
    setRetryingIds((prev) => new Set(prev).add(jobId));
    try {
      const res = await fetch('/api/ops/notifications/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry', jobIds: [jobId] }),
      });
      if (res.ok) {
        setNotificationToast({ message: 'Message re-queued for delivery via WhatsApp.', tone: 'success' });
        setMessages((prev) =>
          prev.map((m) => (m.id === jobId ? { ...m, status: 'QUEUED', error: null } : m)),
        );
        fetchMessages(true);
      } else {
        setNotificationToast({ message: 'Failed to re-queue message.', tone: 'error' });
      }
    } catch {
      setNotificationToast({ message: 'Network error while retrying message.', tone: 'error' });
    } finally {
      setRetryingIds((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  }

  // Actions: Retry all failed in this thread
  async function handleRetryThreadFailed() {
    if (!activeThread || activeThread.failedCount === 0) return;
    const failedIds = activeThread.messages.filter((m) => m.status === 'FAILED').map((m) => m.id);

    setRetryingIds((prev) => {
      const next = new Set(prev);
      failedIds.forEach((id) => next.add(id));
      return next;
    });

    try {
      const res = await fetch('/api/ops/notifications/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry', jobIds: failedIds }),
      });
      if (res.ok) {
        setNotificationToast({
          message: `Re-queued ${failedIds.length} failed message${failedIds.length === 1 ? '' : 's'}.`,
          tone: 'success',
        });
        setMessages((prev) =>
          prev.map((m) => (failedIds.includes(m.id) ? { ...m, status: 'QUEUED', error: null } : m)),
        );
        fetchMessages(true);
      }
    } catch {
      setNotificationToast({ message: 'Error retrying failed messages.', tone: 'error' });
    } finally {
      setRetryingIds((prev) => {
        const next = new Set(prev);
        failedIds.forEach((id) => next.delete(id));
        return next;
      });
    }
  }

  // Actions: Send new custom message
  async function handleSendMessage() {
    if (!activeThread || !composerText.trim() || isSending) return;

    const messageText = composerText.trim();
    setIsSending(true);

    try {
      const res = await fetch('/api/ops/notifications/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          to: activeThread.phone,
          recipientName: activeThread.name,
          recipientType: activeThread.recipientType,
          recipientId: activeThread.recipientId,
          message: messageText,
        }),
      });

      if (res.ok) {
        setComposerText('');
        setShowQuickTemplates(false);
        if (composerInputRef.current) {
          composerInputRef.current.style.height = 'auto';
        }
        setNotificationToast({ message: `Message sent to ${activeThread.name}!`, tone: 'success' });
        await fetchMessages(true);
        composerInputRef.current?.focus();
      } else {
        const err = await res.json();
        setNotificationToast({ message: err?.error || 'Failed to send message', tone: 'error' });
      }
    } catch {
      setNotificationToast({ message: 'Network error sending WhatsApp message.', tone: 'error' });
    } finally {
      setIsSending(false);
    }
  }

  function handleCopyText(id: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  }

  function handleSelectTemplate(text: string) {
    setComposerText(text);
    setShowQuickTemplates(false);
    setTimeout(() => {
      adjustTextareaHeight();
      composerInputRef.current?.focus();
    }, 0);
  }

  // Quick preset templates for car wash operations
  const quickTemplates = useMemo(() => {
    if (!activeThread) return [];
    const name = activeThread.name || 'Valued Customer';
    return [
      {
        label: '☀️ 6 AM Morning Reminder',
        text: `Good morning *${name}*! ☀️\n\nYour car is scheduled for a wash today. Our expert will arrive at your scheduled slot.\n\n📲 Track live: https://carz.com/app\n\nHave a wonderful day! — Team Carz`,
      },
      {
        label: '💳 Monthly Payment Link',
        text: `Hello *${name}*! 🚗\n\nFriendly reminder regarding your Carz monthly wash subscription. Please complete your payment via Razorpay:\n\n👉 Pay Now: https://carz.com/app/payments\n\nThank you for choosing Carz!`,
      },
      {
        label: '✨ Wash Completed (Photos)',
        text: `Hello *${name}*! 🎉\n\nYour car wash has been completed with showroom shine! 🚿✨\n\n📸 Inspect before/after photos & rate our expert: https://carz.com/app\n\nThank you! — Team Carz`,
      },
      {
        label: '🚗 Car Access Request',
        text: `Hello *${name}*! 👋\n\nOur wash expert is arriving shortly for your car wash. Kindly ensure your vehicle is parked in an accessible spot.\n\nThank you for your cooperation! — Team Carz`,
      },
      {
        label: '🌧️ Weather Reschedule Alert',
        text: `Hello *${name}*! 🌧️\n\nDue to heavy rain in your area today, exterior washing is briefly postponed to ensure long-lasting clean. Your wash has been adjusted. Thank you for your patience! — Team Carz`,
      },
    ];
  }, [activeThread]);

  // Overall Stats
  const totalFailedOverall = messages.filter((m) => m.status === 'FAILED').length;
  const totalSentOverall = messages.filter((m) => m.status === 'SENT').length;

  return (
    <div className="relative flex flex-col w-full h-[calc(100vh-130px)] min-h-[680px] rounded-2xl bg-white shadow-2xl overflow-hidden font-sans border border-[#d1d7db] text-[#111b21]">
      {/* ==================================================================== */}
      {/* WHATSAPP TOP ACCENT APP BAR */}
      {/* ==================================================================== */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#00a884] text-white shrink-0 shadow-sm z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <WhatsAppLogo />
            <span className="font-bold text-sm tracking-tight text-white">
              WhatsApp Web
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-emerald-500/80 text-xs text-emerald-100">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
            <span>Meta Cloud API Connected • End-to-End Delivery</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {totalFailedOverall > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-rose-500 text-white px-2.5 py-0.5 text-xs font-bold shadow-xs">
              <span>⚠️</span>
              <span>{totalFailedOverall} Failed</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => fetchMessages()}
            disabled={loading || refreshing}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-700/60 hover:bg-emerald-700 text-white text-xs font-semibold px-2.5 py-1 transition-colors"
          >
            <span>↻</span>
            <span>{refreshing ? 'Syncing...' : 'Sync'}</span>
          </button>
        </div>
      </div>

      {/* Toast Alert Banner */}
      {notificationToast && (
        <div
          className={`absolute top-12 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold shadow-xl transition-all ${
            notificationToast.tone === 'success'
              ? 'bg-[#00a884] text-white'
              : 'bg-[#ea0038] text-white'
          }`}
        >
          <span>{notificationToast.tone === 'success' ? '✓' : '⚠️'}</span>
          <span>{notificationToast.message}</span>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2-COLUMN WHATSAPP INTERFACE */}
      {/* ==================================================================== */}
      <div className="flex flex-1 w-full overflow-hidden">
        {/* ==================================================================== */}
        {/* LEFT COLUMN: CHAT THREADS & CONTACT LIST */}
        {/* ==================================================================== */}
        <div className="flex flex-col w-80 sm:w-[380px] border-r border-[#e9edef] bg-white shrink-0">
          {/* WhatsApp Left Header (60px) */}
          <div className="flex items-center justify-between h-[60px] px-4 bg-[#f0f2f5] border-b border-[#e9edef] shrink-0">
            {/* Operator Avatar */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00a884] text-white font-bold text-sm shadow-xs">
                🚗
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#111b21] leading-tight">
                  Carz Support
                </h3>
                <p className="text-[11px] text-[#00a884] font-medium">Online</p>
              </div>
            </div>

            {/* WhatsApp Standard Action Icons */}
            <div className="flex items-center gap-3 text-[#54656f]">
              <button
                type="button"
                onClick={() => fetchMessages()}
                title="Status updates"
                className="hover:text-[#111b21] transition-colors p-1"
              >
                <WhatsAppStatusIcon />
              </button>
              <button
                type="button"
                onClick={() => composerInputRef.current?.focus()}
                title="New Chat"
                className="hover:text-[#111b21] transition-colors p-1"
              >
                <WhatsAppNewChatIcon />
              </button>
              <button
                type="button"
                title="Menu"
                className="hover:text-[#111b21] transition-colors p-1"
              >
                <WhatsAppMenuIcon />
              </button>
            </div>
          </div>

          {/* WhatsApp Search Bar */}
          <div className="p-2 border-b border-[#f0f2f5] bg-white">
            <div className="flex items-center bg-[#f0f2f5] rounded-lg px-3 py-1.5">
              <span className="text-[#54656f] mr-2">
                <WhatsAppSearchIcon />
              </span>
              <input
                type="text"
                placeholder="Search or start new chat"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-sm text-[#111b21] placeholder-[#8696a0] focus:outline-hidden"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-[#8696a0] hover:text-[#111b21] text-xs ml-1"
                >
                  ✕
                </button>
              )}
            </div>

            {/* WhatsApp Filter Chips */}
            <div className="flex items-center gap-1.5 mt-2 px-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => setFilterType('ALL')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filterType === 'ALL'
                    ? 'bg-[#00a884] text-white'
                    : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterType('CUSTOMER')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  filterType === 'CUSTOMER'
                    ? 'bg-[#00a884] text-white'
                    : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
                }`}
              >
                Customers
              </button>
              <button
                type="button"
                onClick={() => setFilterType('STAFF')}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                  filterType === 'STAFF'
                    ? 'bg-[#00a884] text-white'
                    : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
                }`}
              >
                Staff
              </button>
              <button
                type="button"
                onClick={() => setFilterType('FAILED')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors flex items-center gap-1 ${
                  filterType === 'FAILED'
                    ? 'bg-[#ea0038] text-white'
                    : 'bg-[#fee2e2] text-[#b91c1c] hover:bg-[#fecaca]'
                }`}
              >
                <span>Failed</span>
                {threads.filter((t) => t.failedCount > 0).length > 0 && (
                  <span className="rounded-full bg-[#ea0038] text-white px-1.5 py-0.2 text-[10px] font-bold">
                    {threads.filter((t) => t.failedCount > 0).length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Conversation List (WhatsApp Style 72px rows) */}
          <div className="flex-1 overflow-y-auto bg-white divide-y divide-[#f0f2f5]">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-[#8696a0] gap-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#00a884] border-t-transparent" />
                <span className="text-xs">Loading chats...</span>
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-[#8696a0]">
                <span className="text-3xl mb-2">💬</span>
                <p className="text-sm font-semibold text-[#111b21]">No chats found</p>
                <p className="text-xs text-[#8696a0] mt-0.5">
                  {searchQuery ? 'Try a different search' : 'Dispatched notifications will appear here'}
                </p>
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isActive = thread.contactKey === activeContactKey;
                const status = thread.lastMessage.status;

                return (
                  <div
                    key={thread.contactKey}
                    onClick={() => {
                      setActiveContactKey(thread.contactKey);
                      onSelectContact?.(thread.phone);
                    }}
                    className={`flex items-center gap-3 px-4 py-3 h-[72px] cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-[#f0f2f5]'
                        : 'hover:bg-[#f5f6f6] bg-white'
                    }`}
                  >
                    {/* Contact Avatar (49px circular WhatsApp avatar) */}
                    <div
                      className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-semibold text-sm shadow-xs ${
                        thread.recipientType === 'STAFF'
                          ? 'bg-[#5c68ff] text-white'
                          : 'bg-[#00a884] text-white'
                      }`}
                    >
                      {getInitials(thread.name)}
                      {thread.failedCount > 0 && (
                        <span
                          title={`${thread.failedCount} failed message(s)`}
                          className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#ea0038] text-[10px] font-extrabold text-white ring-2 ring-white"
                        >
                          !
                        </span>
                      )}
                    </div>

                    {/* Chat Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex items-center justify-between mb-0.5">
                        <h4 className="text-[15px] font-normal text-[#111b21] truncate">
                          {thread.name}
                        </h4>
                        <span className="text-[11px] text-[#667781] shrink-0 font-normal">
                          {formatClockCompact(thread.lastMessage.createdAt)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-1">
                        {/* Snippet + Tick icon */}
                        <div className="flex items-center gap-1 text-[13px] text-[#667781] truncate min-w-0">
                          <WhatsAppDeliveryTick status={status} />
                          <span className="truncate">
                            {thread.lastMessage.message.replace(/\n/g, ' ')}
                          </span>
                        </div>

                        {/* Unread / Failed badge */}
                        {thread.failedCount > 0 ? (
                          <span className="flex h-5 items-center justify-center rounded-full bg-[#ea0038] text-white px-1.5 text-[10px] font-bold shrink-0">
                            {thread.failedCount}
                          </span>
                        ) : thread.pendingCount > 0 ? (
                          <span className="flex h-4 items-center justify-center rounded-full bg-[#00a884] text-white px-1.5 text-[9px] font-bold shrink-0">
                            {thread.pendingCount}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ==================================================================== */}
        {/* RIGHT COLUMN: ACTIVE CHAT CONVERSATION WINDOW */}
        {/* ==================================================================== */}
        {activeThread ? (
          <div className="flex flex-col flex-1 h-full min-w-0 bg-[#efeae2]">
            {/* WhatsApp Chat Header (60px) */}
            <div className="flex items-center justify-between h-[60px] px-4 bg-[#f0f2f5] border-b border-[#e9edef] shrink-0 z-10">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-semibold text-sm shadow-xs ${
                    activeThread.recipientType === 'STAFF'
                      ? 'bg-[#5c68ff] text-white'
                      : 'bg-[#00a884] text-white'
                  }`}
                >
                  {getInitials(activeThread.name)}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-normal text-[#111b21] truncate">
                      {activeThread.name}
                    </h3>
                    <span
                      className={`rounded px-1.5 py-0.2 text-[10px] font-semibold ${
                        activeThread.recipientType === 'STAFF'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {activeThread.recipientType}
                    </span>
                  </div>

                  <p className="text-[12px] text-[#667781] truncate">
                    {formatPhonePretty(activeThread.phone)} • {activeThread.messages.length} messages
                  </p>
                </div>
              </div>

              {/* Action Icons */}
              <div className="flex items-center gap-3 text-[#54656f]">
                {activeThread.failedCount > 0 && (
                  <button
                    type="button"
                    onClick={handleRetryThreadFailed}
                    className="flex items-center gap-1 rounded-full bg-[#ea0038] hover:bg-[#c90030] text-white px-3 py-1 text-xs font-bold shadow-xs transition-colors"
                  >
                    <span>↻</span>
                    <span>Retry All Failed ({activeThread.failedCount})</span>
                  </button>
                )}

                <a
                  href={`https://wa.me/${activeThread.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  title="Open in WhatsApp Web"
                  className="hover:text-[#00a884] transition-colors p-1"
                >
                  <WhatsAppDirectIcon />
                </a>

                <button
                  type="button"
                  onClick={() => setShowQuickTemplates((prev) => !prev)}
                  title="Quick reply templates"
                  className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                    showQuickTemplates
                      ? 'bg-[#00a884] text-white'
                      : 'hover:bg-slate-200/80 text-[#54656f]'
                  }`}
                >
                  <span>⚡ Templates</span>
                </button>

                <button
                  type="button"
                  title="Menu"
                  className="hover:text-[#111b21] transition-colors p-1"
                >
                  <WhatsAppMenuIcon />
                </button>
              </div>
            </div>

            {/* Quick Templates Drawer Dropdown */}
            {showQuickTemplates && (
              <div className="bg-[#f0f2f5] border-b border-[#e9edef] px-4 py-2.5 z-20 shadow-sm animate-fade-in">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#54656f]">
                    Select a Template to Insert:
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowQuickTemplates(false)}
                    className="text-xs text-[#8696a0] hover:text-[#111b21]"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {quickTemplates.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => handleSelectTemplate(t.text)}
                      className="rounded-full border border-[#d1d7db] bg-white px-3 py-1 text-xs font-medium text-[#111b21] hover:bg-[#e7fce3] hover:border-[#00a884] hover:text-[#008069] transition-colors shadow-2xs"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* WhatsApp Wallpaper Messages Stream */}
            <div
              className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5"
              style={{
                backgroundColor: '#efeae2',
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='360' height='360' viewBox='0 0 360 360' fill='none' stroke='%23000' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round' opacity='0.05'%3E%3Cpath d='M30 45h20l10 15h30l10-15h20v25h-90z'/%3E%3Ccircle cx='45' cy='70' r='8'/%3E%3Ccircle cx='105' cy='70' r='8'/%3E%3Ccircle cx='160' cy='50' r='12'/%3E%3Ccircle cx='180' cy='35' r='6'/%3E%3Cpath d='M230 40h25v20a12 12 0 0 1-12 12h-1a12 12 0 0 1-12-12zM255 46h6a5 5 0 0 1 0 10h-6'/%3E%3Ccircle cx='310' cy='55' r='16'/%3E%3Ccircle cx='304' cy='51' r='1.5' fill='%23000'/%3E%3Ccircle cx='316' cy='51' r='1.5' fill='%23000'/%3E%3Cpath d='M304 61a8 8 0 0 0 12 0'/%3E%3Cpath d='M60 140c0 10-8 18-18 18s-18-8-18-18c0-12 18-28 18-28s18 16 18 28z'/%3E%3Cpath d='M130 135a8 8 0 0 0-11 0l-4 4-4-4a8 8 0 0 0-11 11l15 15 15-15a8 8 0 0 0 0-11z'/%3E%3Crect x='190' y='125' width='22' height='38' rx='4'/%3E%3Ccircle cx='201' cy='155' r='2' fill='%23000'/%3E%3Cpath d='M275 125v25a7 7 0 1 1-5-6.5V128l20-5v22a7 7 0 1 1-5-6.5'/%3E%3Cpath d='M45 225l3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1z'/%3E%3Ccircle cx='120' cy='230' r='15'/%3E%3Cpath d='M120 220v10l6 4'/%3E%3Cpath d='M185 220h30a8 8 0 0 1 8 8v14a8 8 0 0 1-8 8h-18l-10 8v-8h-2a8 8 0 0 1-8-8v-14a8 8 0 0 1 8-8z'/%3E%3Cpath d='M280 235a16 16 0 0 0 32 0zM296 219v26a5 5 0 0 1-10 0'/%3E%3Ccircle cx='50' cy='315' r='14'/%3E%3Cpath d='M43 315l5 5 9-9'/%3E%3Crect x='115' y='305' width='28' height='20' rx='3'/%3E%3Ccircle cx='129' cy='315' r='5'/%3E%3Cpath d='M122 305l2-4h10l2 4'/%3E%3Cpath d='M200 325v-12a4 4 0 0 1 4-4h2l2-7a3 3 0 0 1 6 1v6h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4h-22z'/%3E%3Cpath d='M295 320a10 10 0 0 0 10-10v-6a10 10 0 0 0-20 0v6a10 10 0 0 0 10 10zM290 320h10M293 325a2 2 0 0 0 4 0'/%3E%3C/svg%3E\")",
                backgroundRepeat: 'repeat',
              }}
            >
              {/* WhatsApp Center Date Header */}
              <div className="flex justify-center my-2">
                <span className="rounded-lg bg-white/95 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-[#54656f] shadow-2xs border border-[#e9edef]">
                  {formatDateFull(activeThread.lastMessage.createdAt)}
                </span>
              </div>

              {/* Message Bubbles */}
              {activeThread.messages.map((msg) => {
                const isFailed = msg.status === 'FAILED';
                const isQueued = msg.status === 'QUEUED' || msg.status === 'PROCESSING';
                const isRetrying = retryingIds.has(msg.id);

                return (
                  <div key={msg.id} className="flex flex-col items-end my-1">
                    {/* Outgoing Message Bubble with WhatsApp Tail */}
                    <div
                      className={`relative max-w-lg sm:max-w-xl rounded-lg px-3 py-2 text-[#111b21] shadow-2xs transition-all ${
                        isFailed
                          ? 'bg-[#ffebee] border border-[#ffcdd2]'
                          : 'bg-[#d9fdd3] border border-[#d1f4cb]'
                      }`}
                      style={{
                        borderTopRightRadius: 0,
                      }}
                    >
                      {/* Tail shape */}
                      <span
                        className={`absolute -top-0 -right-2 w-2 h-3.5 ${
                          isFailed ? 'text-[#ffebee]' : 'text-[#d9fdd3]'
                        }`}
                        style={{
                          clipPath: 'polygon(0 0, 0 100%, 100% 0)',
                          backgroundColor: isFailed ? '#ffebee' : '#d9fdd3',
                        }}
                      />

                      {/* Event Tag Pill Header */}
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span
                          className={`rounded-full px-2 py-0.2 text-[10px] font-bold uppercase tracking-wider ${
                            isFailed
                              ? 'bg-rose-200 text-rose-900'
                              : 'bg-emerald-200/80 text-[#005c4b]'
                          }`}
                        >
                          {getEventBadge(msg.event)}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleCopyText(msg.id, msg.message)}
                          title="Copy message"
                          className="text-[10px] text-[#667781] hover:text-[#111b21]"
                        >
                          {copiedId === msg.id ? '✓ Copied' : '📋 Copy'}
                        </button>
                      </div>

                      {/* Optional Media Image (Wash photo, etc.) */}
                      {msg.mediaUrl && (
                        <div className="mb-2 overflow-hidden rounded-lg bg-black/5 border border-black/10">
                          <img
                            src={msg.mediaUrl}
                            alt="Attached wash photo"
                            onClick={() => setZoomedImage(msg.mediaUrl!)}
                            className="h-44 w-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
                          />
                          <p className="px-2 py-1 text-[10px] text-[#667781] italic">
                            Click photo to view full size
                          </p>
                        </div>
                      )}

                      {/* Message Content formatted with bold and newlines */}
                      <div className="text-[14.2px] leading-[19px] whitespace-pre-wrap font-normal select-text text-[#111b21]">
                        {renderFormattedMessage(msg.message)}
                      </div>

                      {/* Delivery Failure Diagnostic & In-Bubble Retry Button */}
                      {isFailed && (
                        <div className="mt-2 rounded-lg border border-[#ef9a9a] bg-[#ffcdd2]/80 p-2 text-xs text-[#b71c1c]">
                          <div className="flex items-start gap-1.5 mb-1.5">
                            <span className="text-sm">⚠️</span>
                            <div>
                              <p className="font-bold">Message Not Delivered</p>
                              <p className="text-[11px] text-[#c62828] mt-0.5">
                                {msg.error || 'Recipient number unverified or WhatsApp API network timeout.'}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRetryMessage(msg.id)}
                            disabled={isRetrying}
                            className="w-full flex items-center justify-center gap-1.5 rounded bg-[#d32f2f] hover:bg-[#b71c1c] text-white font-bold py-1 px-3 text-xs shadow-xs transition-colors disabled:opacity-50"
                          >
                            <span>↻</span>
                            <span>{isRetrying ? 'Re-queueing...' : 'Retry Message Now'}</span>
                          </button>
                        </div>
                      )}

                      {/* Bubble Bottom: Time + WhatsApp Signature Double Ticks */}
                      <div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-[#667781] leading-none">
                        {isQueued && (
                          <span className="text-[9px] font-semibold text-sky-800 bg-sky-100 rounded px-1 mr-0.5">
                            Queued
                          </span>
                        )}
                        <span>{formatTime(msg.sentAt || msg.createdAt)}</span>
                        <WhatsAppDeliveryTick status={msg.status} />
                      </div>
                    </div>
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>

            {/* WhatsApp Bottom Composer (Auto-growing height for multi-line messages) */}
            <div className="flex items-end gap-2 min-h-[62px] py-2.5 px-4 bg-[#f0f2f5] border-t border-[#e9edef] shrink-0">
              {/* Emoji Icon */}
              <button
                type="button"
                title="Emojis"
                onClick={() => {
                  setComposerText((prev) => `${prev} 👍`);
                  setTimeout(adjustTextareaHeight, 0);
                }}
                className="text-[#54656f] hover:text-[#111b21] transition-colors p-1.5 mb-1"
              >
                <WhatsAppEmojiIcon />
              </button>

              {/* Attachment Clip Icon */}
              <button
                type="button"
                title="Attach"
                onClick={() => setShowQuickTemplates((prev) => !prev)}
                className="text-[#54656f] hover:text-[#111b21] transition-colors p-1.5 mb-1"
              >
                <WhatsAppAttachIcon />
              </button>

              {/* Message Input Box (Single crisp border, zero double outline, auto-expanding) */}
              <div className="flex-1 bg-white rounded-lg px-3.5 py-2.5 flex items-center shadow-2xs border border-transparent transition-colors focus-within:border-[#00a884]">
                <textarea
                  ref={composerInputRef}
                  rows={1}
                  value={composerText}
                  onChange={(e) => {
                    setComposerText(e.target.value);
                    adjustTextareaHeight();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={`Type a message to ${activeThread.name}...`}
                  style={{
                    outline: 'none',
                    border: 'none',
                    boxShadow: 'none',
                    minHeight: '24px',
                    maxHeight: '180px',
                  }}
                  className="w-full resize-none border-none bg-transparent text-[14.5px] leading-[20px] text-[#111b21] placeholder-[#8696a0] focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 p-0 m-0 overflow-y-auto"
                />
              </div>

              {/* WhatsApp Green Send Button */}
              <button
                type="button"
                onClick={handleSendMessage}
                disabled={!composerText.trim() || isSending}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00a884] hover:bg-[#008f6f] text-white shadow-xs transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed mb-0.5"
                title="Send Message (Enter)"
              >
                {isSending ? (
                  <span className="inline-block animate-spin text-sm">↻</span>
                ) : (
                  <WhatsAppSendIcon />
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Empty State: No thread selected */
          <div className="flex flex-col flex-1 items-center justify-center p-8 bg-[#f0f2f5] text-center text-[#8696a0]">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#e9edef] text-[#00a884] text-4xl mb-4 shadow-xs">
              <WhatsAppLogoLarge />
            </div>
            <h3 className="text-xl font-light text-[#41525d]">
              WhatsApp Web for Carz
            </h3>
            <p className="text-sm text-[#8696a0] max-w-sm mt-2">
              Send direct WhatsApp messages to customers, track real-time delivery status, and retry failed messages.
            </p>
          </div>
        )}
      </div>

      {/* Image Lightbox Modal */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
        >
          <div className="relative max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-black">
            <img src={zoomedImage} alt="Zoomed preview" className="max-h-[80vh] w-auto object-contain" />
            <button
              type="button"
              onClick={() => setZoomedImage(null)}
              className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 font-bold text-slate-900"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// AUTHENTIC WHATSAPP ICONS & TICKS
// ============================================================================

function WhatsAppDeliveryTick({ status }: { status: WhatsAppJobStatus }) {
  if (status === 'SENT') {
    // Signature WhatsApp Blue Double Tick (#53bdeb)
    return (
      <span title="Delivered via WhatsApp" className="inline-flex items-center">
        <svg viewBox="0 0 16 11" width="16" height="11" fill="none" className="inline-block shrink-0">
          <path d="M11.07.93a.75.75 0 0 0-1.06 0L5.75 5.19 4.22 3.66a.75.75 0 0 0-1.06 1.06l2.06 2.06a.75.75 0 0 0 1.06 0l4.79-4.79a.75.75 0 0 0 0-1.06z" fill="#53bdeb"/>
          <path d="M15.07.93a.75.75 0 0 0-1.06 0L9.75 5.19l.78.78 4.54-4.54a.75.75 0 0 0 0-1.06z" fill="#53bdeb"/>
        </svg>
      </span>
    );
  }
  if (status === 'FAILED') {
    return (
      <span title="Delivery Failed" className="text-[#ea0038] font-bold text-xs leading-none">
        ⚠️
      </span>
    );
  }
  // Grey double ticks (Queued/Sent to server)
  return (
    <span title="Sent to WhatsApp" className="inline-flex items-center">
      <svg viewBox="0 0 16 11" width="16" height="11" fill="none" className="inline-block shrink-0">
        <path d="M11.07.93a.75.75 0 0 0-1.06 0L5.75 5.19 4.22 3.66a.75.75 0 0 0-1.06 1.06l2.06 2.06a.75.75 0 0 0 1.06 0l4.79-4.79a.75.75 0 0 0 0-1.06z" fill="#8696a0"/>
        <path d="M15.07.93a.75.75 0 0 0-1.06 0L9.75 5.19l.78.78 4.54-4.54a.75.75 0 0 0 0-1.06z" fill="#8696a0"/>
      </svg>
    </span>
  );
}

function WhatsAppLogo() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="white">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31c-.82-1.31-1.26-2.83-1.26-4.38 0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c.01 4.54-3.68 8.23-8.22 8.23zm4.51-6.17c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.84-.86 2.05 0 1.21.88 2.38 1.01 2.55.12.17 1.74 2.66 4.22 3.73.59.25 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.17-.48-.29z"/>
    </svg>
  );
}

function WhatsAppLogoLarge() {
  return (
    <svg viewBox="0 0 24 24" width="48" height="48" fill="#00a884">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31c-.82-1.31-1.26-2.83-1.26-4.38 0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.83c.01 4.54-3.68 8.23-8.22 8.23z"/>
    </svg>
  );
}

function WhatsAppStatusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M12 20.5a8.5 8.5 0 1 1 8.5-8.5 8.51 8.51 0 0 1-8.5 8.5zm0-18.5a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm-1 5.5v5.25l4.5 2.67.75-1.23-3.75-2.22V7.5z"/>
    </svg>
  );
}

function WhatsAppNewChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M19.005 3.175H4.674C3.642 3.175 2.8 4.017 2.8 5.05V15.7c0 1.033.842 1.875 1.874 1.875h1.86v3.25l3.585-3.25h8.886c1.032 0 1.874-.842 1.874-1.875V5.05c0-1.033-.842-1.875-1.874-1.875zm-3.33 7.825h-2.5v2.5h-1.67v-2.5h-2.5V9.33h2.5V6.83h1.67v2.5h2.5v1.67z"/>
    </svg>
  );
}

function WhatsAppMenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M12 7a2 2 0 1 0-.001-4.001A2 2 0 0 0 12 7zm0 7a2 2 0 1 0-.001-4.001A2 2 0 0 0 12 14zm0 7a2 2 0 1 0-.001-4.001A2 2 0 0 0 12 21z"/>
    </svg>
  );
}

function WhatsAppSearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function WhatsAppDirectIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function WhatsAppEmojiIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M9 10h.01M15 10h.01" strokeWidth="2.5" />
      <path d="M8 14.5c1 1.8 2.5 2.5 4 2.5s3-.7 4-2.5" />
    </svg>
  );
}

function WhatsAppAttachIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function WhatsAppSendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
    </svg>
  );
}

function getInitials(name: string): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatPhonePretty(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return phone;
}

function formatClockCompact(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    if (isToday) {
      return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    }

    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

function getEventBadge(event: string): string {
  const lower = event.toLowerCase();
  if (lower.includes('payment')) return '💳 Payment Approved';
  if (lower.includes('started')) return '🚿 Wash Started';
  if (lower.includes('completed')) return '✨ Wash Completed';
  if (lower.includes('today') || lower.includes('same')) return '☀️ Today 6 AM Reminder';
  if (lower.includes('advance') || lower.includes('day_before')) return '📅 Wash Reminder';
  if (lower.includes('missed') || lower.includes('skip')) return '⚠️ Missed Wash';
  if (lower.includes('invoice') || lower.includes('bill')) return '📄 Invoice Due';
  if (lower.includes('direct')) return '💬 Direct Message';
  return event || 'WhatsApp Alert';
}

function renderFormattedMessage(text: string) {
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    const parts = line.split(/(\*[^*]+\*)/g);
    return (
      <span key={lineIdx} className="block min-h-[1.1em]">
        {parts.map((part, partIdx) => {
          if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
            return (
              <strong key={partIdx} className="font-bold text-[#111b21]">
                {part.slice(1, -1)}
              </strong>
            );
          }
          if (/https?:\/\/[^\s]+/.test(part)) {
            return (
              <a
                key={partIdx}
                href={part}
                target="_blank"
                rel="noreferrer"
                className="text-[#027eb5] hover:underline font-medium break-all"
              >
                {part}
              </a>
            );
          }
          return part;
        })}
      </span>
    );
  });
}
