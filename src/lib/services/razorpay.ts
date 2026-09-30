import 'server-only';
import crypto from 'node:crypto';

export interface RazorpayOrderInput {
  amount: number; // in rupees
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResult {
  orderId: string;
  amount: number; // in paise
  currency: string;
  keyId: string;
  isMock?: boolean;
}

export function getRazorpayKeys() {
  const keyId =
    process.env.RAZORPAY_KEY_ID ||
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
    '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  const isConfigured = Boolean(keyId && keySecret && !keyId.includes('placeholder'));

  return { keyId, keySecret, isConfigured };
}

/**
 * Creates a Razorpay order. If keys are not yet configured in local dev,
 * returns a safe mock order so the end-to-end flow can still be developed and tested.
 */
export async function createRazorpayOrder(
  input: RazorpayOrderInput,
): Promise<RazorpayOrderResult> {
  const { keyId, keySecret, isConfigured } = getRazorpayKeys();
  const amountInPaise = Math.round(input.amount * 100);
  const currency = input.currency || 'INR';

  if (!isConfigured) {
    // Development fallback mock order
    const mockOrderId = `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      orderId: mockOrderId,
      amount: amountInPaise,
      currency,
      keyId: keyId || 'rzp_test_placeholder',
      isMock: true,
    };
  }

  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: amountInPaise,
      currency,
      receipt: input.receipt || `rcpt_${Date.now()}`,
      notes: input.notes,
    }),
  });

  const data = (await response.json()) as { id?: string; error?: { description?: string } };
  if (!response.ok || !data.id) {
    throw new Error(data.error?.description || 'Could not create Razorpay order');
  }

  return {
    orderId: data.id,
    amount: amountInPaise,
    currency,
    keyId,
    isMock: false,
  };
}

/**
 * Validates the Razorpay payment signature using HMAC SHA256.
 */
export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
): boolean {
  const { keySecret, isConfigured } = getRazorpayKeys();

  if (!isConfigured) {
    // If running in development with mock orders, allow test signatures
    if (orderId.startsWith('order_mock_') || paymentId.startsWith('pay_mock_')) {
      return true;
    }
  }

  if (!keySecret) return false;

  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'utf-8'),
    Buffer.from(signature, 'utf-8'),
  );
}
