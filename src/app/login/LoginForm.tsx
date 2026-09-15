'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/primitives';

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    // Read from state; fall back to DOM value in case hydration timing left
    // state empty (e.g. autofill or demo-account fill that raced hydration).
    const emailVal = email || emailRef.current?.value || '';
    const passwordVal = password || passwordRef.current?.value || '';

    setPending(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailVal, password: passwordVal }),
      });
      const data = (await response.json()) as {
        error?: string;
        redirect?: string;
      };

      if (!response.ok) {
        setError(data.error ?? 'Could not sign you in.');
        return;
      }
      window.location.href = next || data.redirect || '/';
    } catch {
      setError('No connection. Check your network and try again.');
    } finally {
      setPending(false);
    }
  }

  /** Called by DemoAccounts to fill the form directly via React state. */
  function fillAccount(a: { email: string; password: string }) {
    setEmail(a.email);
    setPassword(a.password);
  }

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="field-label" htmlFor="email">
            Email or mobile number
          </label>
          <input
            ref={emailRef}
            id="email"
            name="email"
            className="field"
            autoComplete="username"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@carzz.app"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="password">
            Password
          </label>
          <div className="relative">
            <input
              ref={passwordRef}
              id="password"
              name="password"
              className="field pr-16"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute inset-y-0 right-2 px-2 text-xs font-bold text-navy-800"
            >
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-danger-300 bg-danger-50 px-3 py-2 text-sm font-semibold text-danger-600"
          >
            {error}
          </p>
        ) : null}

        <Button type="submit" block size="lg" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <DemoAccounts onFill={fillAccount} />
    </>
  );
}

const DEMO_ACCOUNTS = [
  { role: 'Super Admin', email: 'owner@carzz.app', password: 'owner123' },
  { role: 'Area Admin', email: 'areaadmin@carzz.app', password: 'area123' },
  { role: 'Manager', email: 'manager.wadi@carzz.app', password: 'manager123' },
  { role: 'Wash Staff', email: 'rahul1@carzz.app', password: 'staff123' },
  { role: 'Customer', email: 'customer@carzz.app', password: 'customer123' },
];

/** One-tap fill for the demo accounts — calls React state setters directly. */
function DemoAccounts({
  onFill,
}: {
  onFill: (a: { email: string; password: string }) => void;
}) {
  return (
    <div className="mt-6 rounded-card border border-navy-600 bg-navy-850 p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-navy-300">
        Demo sign-ins
      </p>
      <div className="space-y-1">
        {DEMO_ACCOUNTS.map((a) => (
          <button
            key={a.email}
            type="button"
            onClick={() => onFill(a)}
            className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-xs text-slate-300 hover:bg-navy-700"
          >
            <span className="font-bold text-white">{a.role}</span>
            <span className="truncate font-mono text-[11px] text-navy-300">
              {a.email}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
