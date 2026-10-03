'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Note } from '@/components/ui/primitives';
import { useRazorpay } from '@/hooks/useRazorpay';
import type { PaymentMode } from '@/lib/data/types';
import { money } from '@/lib/util/format';

const LABELS: Record<PaymentMode, string> = {
  GATEWAY: 'Pay online (Razorpay)',
  MANUAL_UPI: 'Pay by UPI (manual)',
  CASH: 'I will pay cash',
};

export interface PendingOneTimePayItem {
  id: string;
  name: string;
  amount: number;
  date?: string;
  notes?: string;
}

export function PayActions({
  amount,
  modes,
  initialRequestId,
  initialDesc,
  pendingOneTimeRequests = [],
}: {
  amount: number;
  modes: PaymentMode[];
  initialRequestId?: string;
  initialDesc?: string;
  pendingOneTimeRequests?: PendingOneTimePayItem[];
}) {
  const router = useRouter();
  const [payAmount, setPayAmount] = useState<number>(() => {
    if (initialRequestId) {
      const match = pendingOneTimeRequests.find((r) => r.id === initialRequestId);
      if (match) return match.amount;
    }
    return amount > 0 ? amount : 500;
  });
  const [customInput, setCustomInput] = useState<string>(String(amount > 0 ? amount : 500));
  const [selectedRequestId, setSelectedRequestId] = useState<string | undefined>(initialRequestId);
  const [selectedDesc, setSelectedDesc] = useState<string | undefined>(initialDesc);
  const [upiReference, setUpiReference] = useState('');
  const [showUpiInput, setShowUpiInput] = useState(false);
  const [pending, setPending] = useState<PaymentMode | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { openRazorpayCheckout, isPaying } = useRazorpay();

  const effectiveAmount = payAmount > 0 ? payAmount : Number(customInput) || 0;

  function handleSelectTarget(targetAmount: number, reqId?: string, desc?: string) {
    setPayAmount(targetAmount);
    setCustomInput(String(targetAmount));
    setSelectedRequestId(reqId);
    setSelectedDesc(desc);
    setError(null);
    setMessage(null);
  }

  async function handleGatewayPay() {
    if (effectiveAmount <= 0) {
      setError('Please specify a valid payment amount.');
      return;
    }

    setPending('GATEWAY');
    setError(null);
    setMessage(null);

    try {
      // 1. Create Razorpay order on server
      const orderRes = await fetch('/api/customer/payments/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: effectiveAmount,
          requestId: selectedRequestId,
          description: selectedDesc,
        }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(orderData.error ?? 'Could not initiate online payment.');
      }

      // If mock test order and Razorpay SDK is not configured with real keys
      if (orderData.isMock && orderData.keyId === 'rzp_test_placeholder') {
        const mockPaymentId = `pay_mock_${Date.now()}`;
        const mockSignature = `sig_mock_${Date.now()}`;

        const verifyRes = await fetch('/api/customer/payments/razorpay/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: effectiveAmount,
            razorpayOrderId: orderData.orderId,
            razorpayPaymentId: mockPaymentId,
            razorpaySignature: mockSignature,
            requestId: selectedRequestId,
            description: selectedDesc,
          }),
        });
        const verifyData = await verifyRes.json();
        if (!verifyRes.ok) {
          throw new Error(verifyData.error ?? 'Payment verification failed.');
        }

        setMessage(verifyData.message ?? 'Payment captured. Awaiting manager/admin approval.');
        router.refresh();
        setPending(null);
        return;
      }

      // 2. Open official Razorpay modal checkout via hook
      await openRazorpayCheckout({
        orderId: orderData.orderId,
        amount: effectiveAmount,
        keyId: orderData.keyId,
        prefill: {
          name: orderData.customer?.name,
          contact: orderData.customer?.phone,
        },
        onSuccess: async (response) => {
          try {
            // 3. Verify signature and create pending payment
            const verifyRes = await fetch('/api/customer/payments/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                amount: effectiveAmount,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                requestId: selectedRequestId,
                description: selectedDesc,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) {
              throw new Error(verifyData.error ?? 'Verification failed.');
            }

            setMessage(verifyData.message ?? 'Payment captured. Awaiting manager/admin approval.');
            router.refresh();
          } catch (vErr) {
            setError(vErr instanceof Error ? vErr.message : 'Could not verify payment.');
          } finally {
            setPending(null);
          }
        },
        onDismiss: () => {
          setPending(null);
        },
        onError: (rzpErr) => {
          setError(rzpErr.message || 'Payment was cancelled or failed.');
          setPending(null);
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not process payment.');
      setPending(null);
    }
  }

  async function handleOfflinePay(mode: PaymentMode) {
    if (effectiveAmount <= 0) {
      setError('Please specify a valid payment amount.');
      return;
    }

    if (mode === 'MANUAL_UPI' && !showUpiInput) {
      setShowUpiInput(true);
      return;
    }

    setPending(mode);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/customer/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: effectiveAmount,
          mode,
          reference: upiReference.trim() || undefined,
          requestId: selectedRequestId,
          description: selectedDesc,
        }),
      });
      const data = (await response.json()) as {
        message?: string;
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? 'Could not record that payment.');
        return;
      }
      setMessage(data.message ?? 'Payment request submitted.');
      setShowUpiInput(false);
      setUpiReference('');
      router.refresh();
    } catch {
      setError('No connection. Try again when you are back online.');
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Target item indicator if paying for a specific request */}
      {selectedDesc && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-3 text-xs text-blue-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">🎯 Target Payment:</span>
            <span className="font-medium text-blue-800">{selectedDesc}</span>
          </div>
          <button
            type="button"
            onClick={() => handleSelectTarget(amount > 0 ? amount : 500, undefined, undefined)}
            className="text-[11px] text-blue-700 hover:text-blue-900 underline font-semibold cursor-pointer"
          >
            Clear
          </button>
        </div>
      )}

      {/* Pending One-Time Wash items quick select */}
      {pendingOneTimeRequests.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-2">
          <div className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
            <span>🚿</span>
            <span>Pending One-Time Washes &amp; Special Services</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {pendingOneTimeRequests.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => handleSelectTarget(item.amount, item.id, item.name)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-all cursor-pointer ${
                  selectedRequestId === item.id
                    ? 'border-blue-500 bg-blue-600 text-white shadow-2xs'
                    : 'border-amber-300 bg-white hover:bg-amber-100 text-amber-900'
                }`}
              >
                {item.name}: <strong>{money(item.amount)}</strong>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Amount selector & custom advance amount */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-700">Payment Amount (₹)</label>
          {amount > 0 && (
            <button
              type="button"
              onClick={() => handleSelectTarget(amount, undefined, undefined)}
              className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
            >
              Set Total Dues ({money(amount)})
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₹</span>
            <input
              type="number"
              min="1"
              step="1"
              value={customInput}
              onChange={(e) => {
                setCustomInput(e.target.value);
                setPayAmount(Number(e.target.value) || 0);
              }}
              placeholder="Enter amount in ₹"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-7 pr-3 text-sm font-bold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-1.5 shrink-0">
            {[500, 1000, 2000].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => handleSelectTarget(val, undefined, `Advance Wallet Credit ₹${val}`)}
                className="rounded-lg border border-slate-200 bg-white hover:bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
              >
                +₹{val}
              </button>
            ))}
          </div>
        </div>

        {amount <= 0 && effectiveAmount > 0 && (
          <p className="text-[11px] text-slate-500 font-medium">
            💡 Since you have no pending monthly dues, this payment of <strong>{money(effectiveAmount)}</strong> will be added to your <strong>Wallet Advance</strong> for future washes or services.
          </p>
        )}
      </div>

      {/* Manual UPI UTR field when selected */}
      {showUpiInput && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 space-y-2">
          <label className="text-xs font-bold text-blue-950 block">
            Enter UPI UTR / Transaction Reference (Optional)
          </label>
          <input
            type="text"
            value={upiReference}
            onChange={(e) => setUpiReference(e.target.value)}
            placeholder="e.g. 402819283719 or GPay / PhonePe Ref"
            className="w-full rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-mono text-slate-900 focus:border-blue-500 focus:outline-none"
          />
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowUpiInput(false)}
              className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1"
            >
              Cancel
            </button>
            <Button
              variant="primary"
              disabled={pending !== null}
              onClick={() => handleOfflinePay('MANUAL_UPI')}
            >
              Submit UPI Payment ({money(effectiveAmount)})
            </Button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-2">
        {modes.map((mode, index) => {
          const isCurrentPending = pending === mode || (mode === 'GATEWAY' && isPaying);
          return (
            <Button
              key={mode}
              block
              variant={index === 0 ? 'primary' : 'secondary'}
              disabled={pending !== null || isPaying || effectiveAmount <= 0}
              onClick={() => (mode === 'GATEWAY' ? handleGatewayPay() : handleOfflinePay(mode))}
            >
              {isCurrentPending
                ? mode === 'GATEWAY'
                  ? 'Processing payment…'
                  : 'Recording…'
                : mode === 'GATEWAY'
                  ? `${LABELS[mode]} · ${money(effectiveAmount)}`
                  : mode === 'MANUAL_UPI'
                    ? `${LABELS[mode]} · ${money(effectiveAmount)}`
                    : LABELS[mode]}
            </Button>
          );
        })}

        {message ? (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 text-xs text-emerald-900 shadow-2xs space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <span>✅</span>
              <span>Payment Request Recorded</span>
            </div>
            <p className="leading-relaxed">{message}</p>
          </div>
        ) : null}

        {error ? <Note tone="danger">{error}</Note> : null}
      </div>
    </div>
  );
}
