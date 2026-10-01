'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, CardHeading } from '@/components/ui/primitives';
import { useConfirm } from '@/components/ui/ConfirmProvider';
import { useToast } from '@/components/ui/ToastProvider';
import { money } from '@/lib/util/format';
import { PAYMENT_MODE_LABEL } from '@/lib/util/labels';
import type { Payment } from '@/lib/data/types';

export function PendingPaymentsSection({
  payments,
  customerMap,
  variant = 'customer',
}: {
  payments: Payment[];
  customerMap?: Record<string, { id: string; name: string }>;
  variant?: 'customer' | 'accounting';
}) {
  const router = useRouter();
  const showConfirm = useConfirm();
  const { toast } = useToast();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [busyMap, setBusyMap] = useState<Record<string, 'reject' | 'confirm'>>({});

  const visiblePayments = payments.filter(
    (p) => p.status === 'PENDING' && !dismissedIds.has(p.id),
  );

  if (visiblePayments.length === 0) {
    return null;
  }

  async function handleAction(payment: Payment, action: 'reject' | 'confirm') {
    const isReject = action === 'reject';
    const customer = customerMap?.[payment.customerId];
    const customerName = customer?.name || 'this customer';

    const ok = await showConfirm({
      title: isReject ? 'Reject Payment' : 'Approve Payment',
      message: isReject
        ? variant === 'accounting'
          ? `Are you sure you want to reject this ${money(payment.amount)} payment from ${customerName}?`
          : `Are you sure you want to reject this ${money(payment.amount)} payment? No credit will be added to the customer's account.`
        : variant === 'accounting'
          ? `Confirm and approve ${money(payment.amount)} for ${customerName}? This will settle their invoices and credit their balance.`
          : `Confirm that ${money(payment.amount)} via ${payment.mode === 'GATEWAY' ? 'Razorpay' : payment.mode} has been received? This will settle open invoices and credit the customer's account.`,
      tone: isReject ? 'danger' : 'primary',
      confirmText: isReject ? 'Reject' : 'Approve & Credit',
    });

    if (!ok) return;

    setBusyMap((prev) => ({ ...prev, [payment.id]: action }));

    try {
      const res = await fetch('/api/ops/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, paymentId: payment.id }),
      });

      let data: { message?: string; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        data = {
          error:
            res.status === 401
              ? 'Session expired. Please sign in again.'
              : res.statusText || 'That did not work.',
        };
      }

      if (!res.ok) {
        toast.error(data.error ?? `Failed to ${isReject ? 'reject' : 'approve'} payment.`);
        setBusyMap((prev) => {
          const next = { ...prev };
          delete next[payment.id];
          return next;
        });
        return;
      }

      if (data.message) {
        toast.success(data.message);
      }

      // Immediately remove the payment from the visible list so it disappears instantly
      setDismissedIds((prev) => new Set(prev).add(payment.id));
      setBusyMap((prev) => {
        const next = { ...prev };
        delete next[payment.id];
        return next;
      });

      // Refresh server state in the background
      router.refresh();
    } catch {
      toast.error('No connection. Try again.');
      setBusyMap((prev) => {
        const next = { ...prev };
        delete next[payment.id];
        return next;
      });
    }
  }

  function renderModeBadge(mode: Payment['mode']) {
    return (
      <span
        className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
          mode === 'GATEWAY'
            ? 'bg-blue-100 text-blue-800 border border-blue-200'
            : mode === 'MANUAL_UPI'
              ? 'bg-purple-100 text-purple-800 border border-purple-200'
              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
        }`}
      >
        {mode === 'GATEWAY' ? '⚡ Online Razorpay' : PAYMENT_MODE_LABEL[mode] || mode}
      </span>
    );
  }

  if (variant === 'accounting') {
    return (
      <Card accent="gold" className="p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <CardHeading>Pending Payment Approvals</CardHeading>
            <p className="text-xs text-slate-500 mt-0.5">
              Online gateway and customer-declared payments awaiting admin or manager approval before being credited.
            </p>
          </div>
          <span className="rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-extrabold px-2.5 py-0.5 text-xs">
            {visiblePayments.length} pending
          </span>
        </div>
        <div className="space-y-2.5">
          {visiblePayments.map((p) => {
            const customer = customerMap?.[p.customerId];
            const busy = busyMap[p.id];
            const isBusy = Boolean(busy);

            return (
              <div
                key={p.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 transition-all duration-200"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-extrabold text-slate-900">
                      {money(p.amount)}
                    </span>
                    {customer && (
                      <Link
                        href={`/admin/customers/${p.customerId}`}
                        className="text-xs font-bold text-blue-700 hover:underline truncate max-w-[200px]"
                      >
                        {customer.name}
                      </Link>
                    )}
                    {renderModeBadge(p.mode)}
                  </div>

                  <p className="text-xs font-mono text-slate-600 select-all">
                    Payment ID: <strong className="text-slate-800">{p.reference || p.id}</strong>
                  </p>
                  {p.note && (
                    <p className="text-xs text-slate-500 italic truncate max-w-md">
                      {p.note}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => handleAction(p, 'reject')}
                  >
                    {busy === 'reject' ? 'Rejecting…' : 'Reject'}
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => handleAction(p, 'confirm')}
                  >
                    {busy === 'confirm' ? 'Approving…' : 'Approve & Credit'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
        <span className="text-sm">⏳</span>
        <span>Pending Payments Awaiting Approval:</span>
      </div>
      {visiblePayments.map((payment) => {
        const busy = busyMap[payment.id];
        const isBusy = Boolean(busy);

        return (
          <div
            key={payment.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 shadow-2xs transition-all duration-200"
          >
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-extrabold text-slate-900">
                  {money(payment.amount)}
                </span>
                {renderModeBadge(payment.mode)}
                <span className="text-[11px] text-slate-500 font-mono">
                  {payment.createdAt
                    ? new Date(payment.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : ''}
                </span>
              </div>

              <p className="text-xs text-slate-600 font-mono select-all">
                Payment ID: <strong className="text-slate-800">{payment.reference || payment.id}</strong>
              </p>
              {payment.note && (
                <p className="text-xs text-slate-500 italic line-clamp-1">
                  {payment.note}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="danger"
                size="sm"
                disabled={isBusy}
                onClick={() => handleAction(payment, 'reject')}
              >
                {busy === 'reject' ? 'Rejecting…' : 'Reject'}
              </Button>

              <Button
                variant="primary"
                size="sm"
                disabled={isBusy}
                onClick={() => handleAction(payment, 'confirm')}
              >
                {busy === 'confirm' ? 'Approving…' : 'Approve & Credit'}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
