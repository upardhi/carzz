'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Note } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/ToastProvider';

interface CustomerLoginActionProps {
  customerId: string;
  customerName: string;
  hasLogin: boolean;
  userEmail?: string;
}

export function CustomerLoginAction({
  customerId,
  customerName,
  hasLogin,
  userEmail,
}: CustomerLoginActionProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(userEmail || '');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!email.trim() || !/.+@.+\..+/.test(email)) {
      setError('Please provide a valid email.');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/ops/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createLogin',
          customerId,
          email: email.trim(),
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not create app login');
      }
      toast.success(data.message || 'App login created successfully');
      setOpen(false);
      setPassword('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
      >
        {hasLogin ? 'Update App Login' : '+ Create App Login'}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-lg font-bold text-ink">
                {hasLogin ? `Update App Login for ${customerName}` : `Create App Login for ${customerName}`}
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-ink-mute hover:bg-surface-elevated hover:text-ink transition-colors"
              >
                ✕
              </button>
            </div>

            {error && <Note tone="danger">{error}</Note>}

            <div className="space-y-3 text-sm">
              <div>
                <label className="field-label" htmlFor="cus-email">Login Email</label>
                <input
                  id="cus-email"
                  type="email"
                  className="field"
                  placeholder="e.g. customer@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="field-label" htmlFor="cus-pass">Password</label>
                <input
                  id="cus-pass"
                  type="password"
                  className="field"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
              <Button
                variant="secondary"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={pending || !email.trim() || password.length < 6}
              >
                {pending ? 'Saving…' : (hasLogin ? 'Update Login' : 'Create Login')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
