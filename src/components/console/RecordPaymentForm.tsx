'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Note, Tag } from '@/components/ui/primitives';
import type { PaymentMode } from '@/lib/data/types';
import { PAYMENT_MODE_LABEL } from '@/lib/util/labels';
import { safeOfflineFetch } from '@/lib/util/offlineQueue';

export interface InvoiceInfo {
  id: string;
  cycle: string;
  amount: number;
  paidAmount: number;
  status: string;
  dueOn?: string;
}

export interface CarPaymentInfo {
  id: string;
  name: string;
  price: number;
  due: number;
}

export function RecordPaymentForm({
  customerId,
  suggested = 0,
  outstanding = 0,
  monthly = 0,
  invoices = [],
  cars = [],
}: {
  customerId: string;
  suggested?: number;
  outstanding?: number;
  monthly?: number;
  invoices?: InvoiceInfo[];
  cars?: CarPaymentInfo[];
}) {
  const router = useRouter();
  const hasDues = outstanding > 0;
  const [amount, setAmount] = useState(
    String(hasDues ? outstanding : monthly || suggested || ''),
  );
  const [mode, setMode] = useState<PaymentMode>('CASH');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<{
    receiptNo: string;
    amount: number;
    settledDues: number;
    advanceAdded: number;
  } | null>(null);
  const [state, setState] = useState<{ ok?: string; error?: string }>({});

  const openInvoices = invoices.filter(
    (inv) => inv.paidAmount < inv.amount && inv.status !== 'WRITTEN_OFF',
  );

  const numAmount = Number(amount) || 0;
  const duesCovered = hasDues ? Math.min(numAmount, outstanding) : 0;
  const surplusAdvance = Math.max(0, numAmount - duesCovered);
  const remainingDues = Math.max(0, outstanding - duesCovered);

  async function submit() {
    const value = Number(amount);
    if (!value || value <= 0) {
      setState({ error: 'Please enter a valid payment amount.' });
      return;
    }
    setPending(true);
    setState({});
    setLastReceipt(null);
    try {
      const result = await safeOfflineFetch<{
        ok?: boolean;
        message?: string;
        error?: string;
        receiptNo?: string;
      }>('/api/ops/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          action: 'record',
          customerId,
          amount: value,
          mode,
          kind: hasDues ? 'PACKAGE' : 'ADVANCE',
          reference: reference.trim() || undefined,
          note: note.trim() || undefined,
        },
        label: `Record Payment ₹${value} (${mode})`,
      });

      if (!result.ok) {
        setState({ error: result.error ?? 'Could not record payment.' });
        return;
      }

      if (result.queuedOffline) {
        setState({
          ok: 'Saved offline! Payment will sync automatically once online.',
        });
      } else {
        const receiptNo = result.data?.receiptNo || `RCP-${Date.now().toString().slice(-6)}`;
        setLastReceipt({
          receiptNo,
          amount: value,
          settledDues: duesCovered,
          advanceAdded: surplusAdvance,
        });
        setState({ ok: result.data?.message ?? 'Payment recorded.' });
        setReference('');
        setNote('');
      }

      router.refresh();
    } catch {
      setState({ error: 'Something unexpected happened.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Payment Receipt Banner if just paid */}
      {lastReceipt ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 shadow-xs">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <span>✓ Payment Recorded</span>
                <span className="font-mono text-[11px] font-semibold bg-emerald-200/70 text-emerald-900 px-1.5 py-0.5 rounded">
                  #{lastReceipt.receiptNo}
                </span>
              </p>
              <p className="text-[11px] text-emerald-800 mt-0.5">
                ₹{lastReceipt.amount.toLocaleString('en-IN')} received.
                {lastReceipt.settledDues > 0 ? ` Settled ₹${lastReceipt.settledDues.toLocaleString('en-IN')} towards dues.` : ''}
                {lastReceipt.advanceAdded > 0 ? ` ₹${lastReceipt.advanceAdded.toLocaleString('en-IN')} added to advance balance.` : ''}
              </p>
            </div>
            <Tag tone="ok">Recorded</Tag>
          </div>
        </div>
      ) : null}

      {/* Main Unified Payment Recording Form */}
      <div className="rounded-lg border border-line bg-slate-50/50 p-3 space-y-2.5">
        <div className="flex items-center justify-between border-b border-line/60 pb-2">
          <span className="text-xs font-bold text-ink">Record Payment</span>
          {hasDues ? (
            <span className="text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200/60">
              ₹{outstanding.toLocaleString('en-IN')} Outstanding
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
              No Dues (Fully Paid)
            </span>
          )}
        </div>

        {/* Target Invoices Breakdown if any dues exist */}
        {openInvoices.length > 0 && (
          <div className="text-[11px] text-slate-600 bg-white border border-slate-200/80 rounded px-2.5 py-1.5 flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-slate-800">Target Invoices:</span>
            {openInvoices.map((inv) => (
              <span key={inv.id} className="font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                [{inv.cycle}: ₹{(inv.amount - inv.paidAmount).toLocaleString('en-IN')} left]
              </span>
            ))}
          </div>
        )}

        {/* Quick Fill Buttons */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] uppercase font-bold text-slate-400">Quick set:</span>
          {hasDues && (
            <button
              type="button"
              onClick={() => setAmount(String(outstanding))}
              className="text-[11px] font-medium px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition-colors"
            >
              Exact Dues (₹{outstanding.toLocaleString('en-IN')})
            </button>
          )}
          {monthly > 0 && monthly !== outstanding && (
            <button
              type="button"
              onClick={() => setAmount(String(monthly))}
              className="text-[11px] font-medium px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition-colors"
            >
              1 Month (₹{monthly.toLocaleString('en-IN')})
            </button>
          )}
          {monthly > 0 && (
            <button
              type="button"
              onClick={() => setAmount(String((hasDues ? outstanding : 0) + monthly))}
              className="text-[11px] font-medium px-2 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition-colors"
            >
              {hasDues ? `Dues + 1 Mo (₹${(outstanding + monthly).toLocaleString('en-IN')})` : `2 Months (₹${(monthly * 2).toLocaleString('en-IN')})`}
            </button>
          )}
        </div>

        {/* Vehicle Selection (if customer has multiple cars) */}
        {cars.length > 1 && (
          <div className="rounded-md border border-slate-200/80 bg-white p-2 space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-500">Pay for specific vehicle:</span>
            <div className="flex flex-wrap gap-1.5">
              {cars.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setAmount(String(c.due > 0 ? c.due : c.price));
                    setNote(`Payment for ${c.name}`);
                  }}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 flex items-center gap-1.5 transition-colors shadow-2xs"
                >
                  <span>🚗 {c.name}</span>
                  <span
                    className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      c.due > 0
                        ? 'bg-amber-100 text-amber-900 border border-amber-200'
                        : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                    }`}
                  >
                    {c.due > 0 ? `₹${c.due.toLocaleString('en-IN')} due` : 'Paid'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Amount & Payment Mode Inputs */}
        <div className="flex gap-2">
          <input
            id="pay-amount"
            className="field flex-1 text-sm font-semibold"
            type="number"
            placeholder="Amount (₹)"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <select
            aria-label="Payment mode"
            className="field w-36 text-xs font-medium"
            value={mode}
            onChange={(e) => setMode(e.target.value as PaymentMode)}
          >
            {(['CASH', 'MANUAL_UPI', 'GATEWAY'] as PaymentMode[]).map((m) => (
              <option key={m} value={m}>
                {PAYMENT_MODE_LABEL[m]}
              </option>
            ))}
          </select>
        </div>

        {/* Live Payment Allocation Preview */}
        {numAmount > 0 && (
          <div className="rounded border border-blue-200/80 bg-blue-50/70 px-2.5 py-1.5 text-[11px] text-blue-900 space-y-0.5">
            {hasDues ? (
              numAmount <= outstanding ? (
                <div className="flex items-center justify-between">
                  <span>
                    Settles <strong>₹{numAmount.toLocaleString('en-IN')}</strong> towards open dues.
                  </span>
                  <span className="font-semibold text-rose-700">
                    ₹{remainingDues.toLocaleString('en-IN')} will remain due
                  </span>
                </div>
              ) : (
                <div>
                  <span>
                    ✓ Clears all <strong>₹{outstanding.toLocaleString('en-IN')}</strong> dues.{' '}
                  </span>
                  <span className="text-emerald-800 font-semibold">
                    +₹{surplusAdvance.toLocaleString('en-IN')} deposited into Advance balance.
                  </span>
                </div>
              )
            ) : (
              <div>
                <span>Account has no dues. </span>
                <span className="text-emerald-800 font-semibold">
                  Full ₹{numAmount.toLocaleString('en-IN')} deposited into Advance balance.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Reference and Note */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Ref # / UPI Txn / Receipt #"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="field text-xs"
          />
          <input
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="field text-xs"
          />
        </div>

        <Button
          block
          className="mt-1 font-semibold"
          disabled={pending || numAmount <= 0}
          onClick={submit}
        >
          {pending
            ? 'Recording…'
            : `Confirm & Record ₹${numAmount.toLocaleString('en-IN')}`}
        </Button>

        {state.error ? (
          <div className="mt-2">
            <Note tone="danger">{state.error}</Note>
          </div>
        ) : null}
      </div>
    </div>
  );
}
