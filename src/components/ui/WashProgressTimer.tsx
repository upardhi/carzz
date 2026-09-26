'use client';

import React, { useEffect, useState } from 'react';
import clsx from 'clsx';

export interface WashProgressTimerProps {
  startedAt?: string | null;
  variant?: 'badge' | 'pill' | 'card' | 'inline' | 'compact' | 'history-header';
  label?: string;
  className?: string;
  showIcon?: boolean;
}

export function formatElapsedClock(totalSeconds: number): string {
  if (totalSeconds < 0 || !Number.isFinite(totalSeconds)) return '00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  if (hours > 0) {
    const hh = String(hours).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

export function formatElapsedHuman(totalSeconds: number): string {
  if (totalSeconds < 0 || !Number.isFinite(totalSeconds)) return '0s';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function WashProgressTimer({
  startedAt,
  variant = 'badge',
  label,
  className,
  showIcon = true,
}: WashProgressTimerProps) {
  const [mounted, setMounted] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  useEffect(() => {
    setMounted(true);
    if (!startedAt) {
      setElapsedSeconds(0);
      return;
    }

    const startMs = new Date(startedAt).getTime();
    if (isNaN(startMs)) {
      setElapsedSeconds(0);
      return;
    }

    const update = () => {
      const diffMs = Date.now() - startMs;
      setElapsedSeconds(Math.max(0, Math.floor(diffMs / 1000)));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  const clockString = mounted ? formatElapsedClock(elapsedSeconds) : '00:00';
  const humanString = mounted ? formatElapsedHuman(elapsedSeconds) : '0s';

  // 1. Badge variant (Pulsing live badge with timer)
  if (variant === 'badge') {
    return (
      <span
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200/90 px-2.5 py-0.5 text-xs font-bold text-blue-800 shadow-2xs animate-in fade-in duration-200',
          className,
        )}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600" />
        </span>
        <span>{label || 'In Progress'}</span>
        <span className="text-blue-400">·</span>
        <span className="font-mono text-[11.5px] font-extrabold text-blue-900">{clockString}</span>
      </span>
    );
  }

  // 2. Pill variant (Minimalist status pill)
  if (variant === 'pill') {
    return (
      <div
        className={clsx(
          'inline-flex items-center gap-1.5 rounded-lg bg-blue-50/90 border border-blue-200 px-2.5 py-1 text-xs text-blue-900 font-semibold',
          className,
        )}
      >
        {showIcon && <span className="text-blue-600 animate-spin-slow">⏱️</span>}
        <span>{label || 'Elapsed'}:</span>
        <span className="font-mono font-bold text-blue-700">{humanString}</span>
      </div>
    );
  }

  // 3. Compact inline (e.g. within card headers or lists)
  if (variant === 'compact') {
    return (
      <span
        className={clsx(
          'inline-flex items-center gap-1 font-mono text-xs font-bold text-blue-700',
          className,
        )}
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
        <span>{clockString}</span>
      </span>
    );
  }

  // 4. History Header variant (used in Wash History card header)
  if (variant === 'history-header') {
    return (
      <div className={clsx('flex items-center gap-2', className)}>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 text-white px-2.5 py-0.5 text-[11px] font-bold shadow-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
          Wash In Progress
        </span>
        <div className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-bold text-blue-900 font-mono">
          <span>⏱️</span>
          <span>{clockString}</span>
        </div>
      </div>
    );
  }

  // 5. Card variant (prominent live progress display)
  return (
    <div
      className={clsx(
        'rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/90 via-sky-50/50 to-indigo-50/70 p-3.5 shadow-2xs',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-900">
            {label || 'Cleaning In Progress'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-white/90 border border-blue-200/80 rounded-lg px-2.5 py-1 text-xs font-bold text-blue-900 shadow-2xs">
          <span className="text-blue-600">⏱️</span>
          <span className="font-mono text-sm tracking-tight">{clockString}</span>
        </div>
      </div>
    </div>
  );
}
