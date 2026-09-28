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

export function RecordPaymentForm({
  customerId,
  suggested = 0,
  outstanding = 0,
  monthly = 0,
  invoices = [],
}: {
  customerId: string;
  suggested?: number;
  outstanding?: number;
  monthly?: number;
  invoices?: InvoiceInfo[];
}) {
  const router = useRouter();
  const hasDues = outstanding > 0;
  const [paymentType, setPaymentType] = useState<'INVOICE' | 'ADVANCE'>(
    hasDues ? 'INVOICE' : 'ADVANCE',
  );
  const [showAdvanceForm, setShowAdvanceForm] = useState(hasDues);
  const [amount, setAmount] = useState(
    String(hasDues ? outstanding || suggested : monthly || suggested || ''),
  );
  const [mode, setMode] = useState<PaymentMode>('CASH');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<{
    receiptNo: string;
    amount: number;
    kind: string;
    message: string;
  } | null>(null);
  const [state, setState] = useState<{ ok?: string; error?: string }>({});

  const openInvoices = invoices.filter(
    (inv) => inv.paidAmount < inv.amount && inv.status !== 'WRITTEN_OFF',
  );

  function handleTypeChange(type: 'INVOICE' | 'ADVANCE') {
    setPaymentType(type);
    setState({});
    if (type === 'INVOICE') {
      setAmount(String(outstanding || suggested || ''));
    } else {
      setAmount(String(monthly || ''));
    }
  }

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
      const kind = paymentType === 'ADVANCE' ? 'ADVANCE' : 'PACKAGE';
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
          kind,
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
          kind: paymentType === 'ADVANCE' ? 'Advance Deposit' : 'Invoice Payment',
          message: result.data?.message ?? 'Payment recorded successfully.',
        });
        setState({ ok: result.data?.message ?? 'Payment recorded.' });
        setReference('');
        setNote('');
        if (!hasDues) {
          setShowAdvanceForm(false);
        }
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
      {/* If customer has 0 dues and form is not expanded */}
      {!hasDues && !showAdvanceForm ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white shadow-xs">
                ✓
              </span>
              <div>
                <p className="text-xs font-bold text-emerald-950">
                  Account is fully paid
                </p>
                <p className="text-[11px] text-emerald-700">
                  No outstanding dues for this customer.
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              className="text-xs shrink-0 bg-white border-emerald-300 text-emerald-900 hover:bg-emerald-100/50"
              onClick={() => {
                setShowAdvanceForm(true);
                setPaymentType('ADVANCE');
                setAmount(String(monthly || ''));
              }}
            >
              + Record Advance Payment
            </Button>
          </div>
        </div>
      ) : null}

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
                ₹{lastReceipt.amount.toLocaleString('en-IN')} logged as{' '}
                {lastReceipt.kind}. Recorded in payment history.
              </p>
            </div>
            <Tag tone="ok">Recorded</Tag>
          </div>
        </div>
      ) : null}

      {/* Main Payment Recording Form */}
      {(hasDues || showAdvanceForm) && (
        <div className="rounded-lg border border-line bg-slate-50/50 p-3 space-y-2.5">
          <div className="flex items-center justify-between border-b border-line/60 pb-2">
            <span className="text-xs font-bold text-ink">
              {hasDues ? 'Record Payment / Settle Invoice' : 'Record Advance Payment'}
            </span>
            {!hasDues && (
              <button
                type="button"
                onClick={() => setShowAdvanceForm(false)}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 underline"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Type Selector (Invoice Settlement vs Advance) */}
          <div className="flex gap-1.5 p-0.5 bg-slate-200/60 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => handleTypeChange('INVOICE')}
              className={`flex-1 py-1 px-2 rounded-md font-medium text-center transition-all ${
                paymentType === 'INVOICE'
                  ? 'bg-white shadow-xs text-ink font-bold'
                  : 'text-slate-600 hover:text-ink'
              }`}
            >
              Invoice Payment {hasDues ? `(₹${outstanding} due)` : ''}
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('ADVANCE')}
              className={`flex-1 py-1 px-2 rounded-md font-medium text-center transition-all ${
                paymentType === 'ADVANCE'
                  ? 'bg-white shadow-xs text-ink font-bold'
                  : 'text-slate-600 hover:text-ink'
              }`}
            >
              Advance Deposit
            </button>
          </div>

          {/* Context Notice */}
          {paymentType === 'INVOICE' && openInvoices.length > 0 && (
            <div className="text-[11px] text-slate-600 bg-white border border-slate-200/80 rounded px-2.5 py-1.5">
              <span className="font-semibold text-slate-800">Target Invoices: </span>
              {openInvoices.map((inv) => (
                <span key={inv.id} className="font-mono text-slate-700 mr-2">
                  [{inv.cycle}: ₹{inv.amount - inv.paidAmount} left]
                </span>
              ))}
            </div>
          )}

          {paymentType === 'ADVANCE' && (
            <p className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200/60 rounded px-2.5 py-1.5">
              💡 Advance payment will be deposited into the customer&apos;s account balance and automatically applied to future invoices.
            </p>
          )}

          {/* Amount & Mode */}
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
            disabled={pending}
            onClick={submit}
          >
            {pending
              ? 'Recording…'
              : `Confirm & Record ₹${Number(amount) || 0} (${
                  paymentType === 'ADVANCE' ? 'Advance' : 'Invoice'
                })`}
          </Button>

          {state.error ? (
            <div className="mt-2">
              <Note tone="danger">{state.error}</Note>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
