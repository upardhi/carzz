'use client';

import { useCallback, useEffect, useState } from 'react';

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayOptions {
  key: string;
  amount: number; // in paise
  currency?: string;
  name?: string;
  description?: string;
  image?: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
    escape?: boolean;
    backdropclose?: boolean;
  };
  handler?: (response: RazorpaySuccessResponse) => void;
}

export interface RazorpayInstance {
  open: () => void;
  close: () => void;
  on: (event: string, handler: (response: unknown) => void) => void;
}

export interface OpenCheckoutParams {
  orderId: string;
  amount: number; // in rupees
  keyId?: string;
  name?: string;
  description?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  onSuccess: (res: RazorpaySuccessResponse) => void | Promise<void>;
  onDismiss?: () => void;
  onError?: (err: Error) => void;
}

export function useRazorpay() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.Razorpay) {
      setIsLoaded(true);
      return;
    }

    const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => setIsLoaded(true));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setIsLoaded(true);
    script.onerror = () => {
      setError('Could not load Razorpay checkout SDK.');
      setIsLoaded(false);
    };

    document.body.appendChild(script);
  }, []);

  const openRazorpayCheckout = useCallback(
    async ({
      orderId,
      amount,
      keyId,
      name = 'Carz Management',
      description = 'Car Wash Subscription Payment',
      prefill,
      notes,
      onSuccess,
      onDismiss,
      onError,
    }: OpenCheckoutParams) => {
      setError(null);
      setIsPaying(true);

      const activeKey =
        keyId ||
        process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
        'rzp_test_placeholder';

      const launch = () => {
        if (!window.Razorpay) {
          const err = new Error('Razorpay SDK is not available.');
          setError(err.message);
          setIsPaying(false);
          onError?.(err);
          return;
        }

        try {
          const options: RazorpayOptions = {
            key: activeKey,
            amount: Math.round(amount * 100), // convert rupees to paise
            currency: 'INR',
            name,
            description,
            order_id: orderId,
            prefill: {
              name: prefill?.name,
              email: prefill?.email,
              contact: prefill?.contact,
            },
            notes,
            theme: {
              color: '#0f2347', // Carz brand primary dark navy
            },
            modal: {
              ondismiss: () => {
                setIsPaying(false);
                onDismiss?.();
              },
            },
            handler: async (response: RazorpaySuccessResponse) => {
              try {
                await onSuccess(response);
              } catch (handlerErr) {
                onError?.(handlerErr instanceof Error ? handlerErr : new Error(String(handlerErr)));
              } finally {
                setIsPaying(false);
              }
            },
          };

          const rzp = new window.Razorpay(options);
          rzp.on('payment.failed', (failRes: unknown) => {
            setIsPaying(false);
            const err = new Error(
              typeof failRes === 'object' && failRes !== null && 'error' in failRes
                ? (failRes as { error: { description?: string } }).error.description ?? 'Payment failed.'
                : 'Payment failed.',
            );
            setError(err.message);
            onError?.(err);
          });

          rzp.open();
        } catch (initErr) {
          setIsPaying(false);
          const err = initErr instanceof Error ? initErr : new Error('Failed to initialize Razorpay modal.');
          setError(err.message);
          onError?.(err);
        }
      };

      if (window.Razorpay) {
        launch();
      } else {
        // Wait briefly for script load if it was just injected
        let attempts = 0;
        const interval = setInterval(() => {
          attempts++;
          if (window.Razorpay) {
            clearInterval(interval);
            setIsLoaded(true);
            launch();
          } else if (attempts > 20) {
            clearInterval(interval);
            setIsPaying(false);
            const err = new Error('Razorpay script timed out loading.');
            setError(err.message);
            onError?.(err);
          }
        }, 150);
      }
    },
    [],
  );

  return {
    isLoaded,
    isPaying,
    error,
    openRazorpayCheckout,
  };
}
