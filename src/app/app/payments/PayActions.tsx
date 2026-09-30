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

export function PayActions({
  amount,
  modes,
}: {
  amount: number;
  modes: PaymentMode[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<PaymentMode | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { openRazorpayCheckout, isPaying } = useRazorpay();

  async function handleGatewayPay() {
    setPending('GATEWAY');
    setError(null);
    setMessage(null);

    try {
      // 1. Create Razorpay order on server
      const orderRes = await fetch('/api/customer/payments/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
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
            amount,
            razorpayOrderId: orderData.orderId,
            razorpayPaymentId: mockPaymentId,
            razorpaySignature: mockSignature,
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
        amount,
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
                amount,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
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
    setPending(mode);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch('/api/customer/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, mode }),
      });
      const data = (await response.json()) as {
        message?: string;
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? 'Could not record that payment.');
        return;
      }
      setMessage(data.message ?? 'Recorded.');
      router.refresh();
    } catch {
      setError('No connection. Try again when you are back online.');
    } finally {
      setPending(null);
    }
  }

  if (amount <= 0) {
    return (
      <Note tone="success">
        Nothing is due right now. You will get a reminder before the next due
        date.
      </Note>
    );
  }

  return (
    <div className="space-y-2">
      {modes.map((mode, index) => {
        const isCurrentPending = pending === mode || (mode === 'GATEWAY' && isPaying);
        return (
          <Button
            key={mode}
            block
            variant={index === 0 ? 'primary' : 'secondary'}
            disabled={pending !== null || isPaying}
            onClick={() => (mode === 'GATEWAY' ? handleGatewayPay() : handleOfflinePay(mode))}
          >
            {isCurrentPending
              ? mode === 'GATEWAY'
                ? 'Processing payment…'
                : 'Recording…'
              : mode === 'GATEWAY'
                ? `${LABELS[mode]} · ${money(amount)}`
                : LABELS[mode]}
          </Button>
        );
      })}

      {message ? (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 text-xs text-emerald-900 shadow-2xs space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <span>✅</span>
            <span>Payment Recorded</span>
          </div>
          <p className="leading-relaxed">{message}</p>
        </div>
      ) : null}

      {error ? <Note tone="danger">{error}</Note> : null}
    </div>
  );
}
