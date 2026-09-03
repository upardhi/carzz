'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/primitives';

/**
 * `next` arrives from the query string, so it is whatever the link said. Only a
 * path on this site is allowed through — `//evil.example` and `https://…` are
 * both absolute URLs to a browser, and would turn sign-in into an open redirect.
 */
function safeNext(value: string | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

export function LoginForm({ next }: { next?: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as {
        error?: string;
        redirect?: string;
      };

      if (!response.ok) {
        setError(data.error ?? 'Could not sign you in.');
        return;
      }
      // Full navigation ensures the new session cookie is sent cleanly
      // and immediately displays the destination layout/skeleton without
      // racing an unnecessary re-render of /login.
      window.location.href = next || data.redirect || '/';
    } catch {
      setError('No connection. Check your network and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="field-label" htmlFor="email">
          Email or mobile number
        </label>
        <input
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
  );
}

/** One-tap fill for the demo accounts, so a walkthrough needs no typing. */
export function DemoAccounts() {
  const accounts = [
    { role: 'Super Admin', email: 'owner@carzz.app', password: 'owner123' },
    { role: 'Area Admin', email: 'areaadmin@carzz.app', password: 'area123' },
    { role: 'Manager', email: 'manager.wadi@carzz.app', password: 'manager123' },
    { role: 'Wash Staff', email: 'rahul1@carzz.app', password: 'staff123' },
    { role: 'Customer', email: 'customer@carzz.app', password: 'customer123' },
  ];

  return (
    <div className="mt-6 rounded-card border border-navy-600 bg-navy-850 p-3">
      <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-navy-300">
        Demo sign-ins
      </p>
      <div className="space-y-1">
        {accounts.map((a) => (
          <button
            key={a.email}
            type="button"
            onClick={() => {
              const form = document.querySelector('form');
              const email = form?.querySelector<HTMLInputElement>('#email');
              const password = form?.querySelector<HTMLInputElement>('#password');
              if (!email || !password) return;
              // Set through the native setter so React registers the change.
              setNativeValue(email, a.email);
              setNativeValue(password, a.password);
            }}
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

function setNativeValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
