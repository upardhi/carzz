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
    </>
  );
}

