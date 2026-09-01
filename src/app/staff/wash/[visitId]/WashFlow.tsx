'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button, Card, Note } from '@/components/ui/primitives';
import { IconCamera, IconCheck } from '@/components/shell/icons';
import { MISS_REASONS, type MissReason } from '@/lib/data/types';
import { MISS_REASON_LABEL } from '@/lib/util/labels';

interface Props {
  visitId: string;
  services: string[];
  initialBefore: string | null;
  initialAfter: string | null;
  requireBothPhotos: boolean;
  nextSlotDate: string;
}

/**
 * The wash, in as few taps as it can honestly be done.
 *
 * A normal wash is now: before photo, after photo, done. The work list starts
 * with the whole package already ticked, because doing the whole package is
 * the normal case — the boy unticks the exception rather than ticking the
 * rule. On a four-service package that alone saves three taps per car, and a
 * boy does this six times a day.
 *
 * The close button is disabled until both photos exist, and the server
 * refuses the same combination independently.
 */
export function WashFlow({
  visitId,
  services,
  initialBefore,
  initialAfter,
  requireBothPhotos,
  nextSlotDate,
}: Props) {
  const router = useRouter();
  const [before, setBefore] = useState<string | null>(initialBefore);
  const [after, setAfter] = useState<string | null>(initialAfter);
  const [done, setDone] = useState<string[]>(services);
  const [uploading, setUploading] = useState<'before' | 'after' | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missOpen, setMissOpen] = useState(false);

  const beforeInput = useRef<HTMLInputElement>(null);
  const afterInput = useRef<HTMLInputElement>(null);

  const ready = requireBothPhotos
    ? Boolean(before && after && done.length)
    : done.length > 0;

  async function upload(kind: 'before' | 'after', file: File) {
    setUploading(kind);
    setError(null);
    try {
      const body = new FormData();
      body.set('visitId', visitId);
      body.set('kind', kind);
      body.set('photo', file);

      const response = await fetch('/api/staff/photo', { method: 'POST', body });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        setError(data.error ?? 'Could not save that photo.');
        return;
      }
      if (kind === 'before') setBefore(data.url);
      else setAfter(data.url);
    } catch {
      setError('No signal. Move somewhere with network and tap again.');
    } finally {
      setUploading(null);
    }
  }

  async function closeWash() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/staff/wash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete', visitId, servicesDone: done }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? 'Could not close this wash.');
        return;
      }
      router.push('/staff');
      router.refresh();
    } catch {
      setError('No signal. Try again when you have network.');
    } finally {
      setPending(false);
    }
  }

  if (missOpen) {
    return (
      <MissWashForm
        visitId={visitId}
        nextSlotDate={nextSlotDate}
        onCancel={() => setMissOpen(false)}
      />
    );
  }

  return (
    <>
      {/* Everything for the wash in one panel — no step cards to scroll past. */}
      <Card className="p-4">
        <div className="grid grid-cols-2 gap-3">
          <input
            ref={beforeInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload('before', file);
            }}
          />
          <input
            ref={afterInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload('after', file);
            }}
          />

          <PhotoTile
            label="Before"
            url={before}
            busy={uploading === 'before'}
            onPick={() => beforeInput.current?.click()}
          />
          <PhotoTile
            label="After"
            url={after}
            busy={uploading === 'after'}
            disabled={!before}
            onPick={() => afterInput.current?.click()}
          />
        </div>

        <div className="mt-4">
          <p className="mb-1 text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">
            Work done
          </p>
          {services.map((service) => {
            const on = done.includes(service);
            return (
              <button
                key={service}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setDone((current) =>
                    on ? current.filter((s) => s !== service) : [...current, service],
                  )
                }
                className="flex w-full items-center gap-3 border-b border-line-soft py-3 text-left text-[15px] last:border-0"
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 ${
                    on
                      ? 'border-success-500 bg-success-500 text-white'
                      : 'border-line-strong'
                  }`}
                >
                  {on ? <IconCheck width={15} height={15} strokeWidth={3} /> : null}
                </span>
                <span className={on ? '' : 'text-ink-mute line-through'}>{service}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {error ? (
        <div className="mt-3">
          <Note tone="danger">{error}</Note>
        </div>
      ) : null}

      {/* The action sits at the thumb, always reachable without scrolling. */}
      <div className="sticky bottom-24 z-20 mt-3 space-y-2">
        <Button block size="lg" disabled={!ready || pending} onClick={closeWash}>
          {pending
            ? 'Saving…'
            : ready
              ? 'Wash done'
              : !before
                ? 'Take the before photo'
                : 'Take the after photo'}
        </Button>
        <Button block variant="secondary" onClick={() => setMissOpen(true)}>
          Could not do this wash
        </Button>
      </div>
    </>
  );
}

function PhotoTile({
  label,
  url,
  busy,
  disabled,
  onPick,
}: {
  label: string;
  url: string | null;
  busy: boolean;
  disabled?: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled || busy}
      className={`relative flex aspect-[4/3] w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-lg border-2 text-sm font-bold transition-colors ${
        url
          ? 'border-success-500 bg-success-50 text-success-600'
          : disabled
            ? 'border-dashed border-line-strong bg-surface-raised text-ink-faint'
            : 'border-dashed border-navy-400 bg-navy-50 text-navy-800'
      }`}
    >
      {url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`${label} photo`} className="h-full w-full object-cover" />
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-success-500 py-1 text-xs font-extrabold text-white">
            <IconCheck width={13} height={13} strokeWidth={3} />
            {label}
          </span>
        </>
      ) : (
        <>
          <IconCamera width={28} height={28} />
          {busy ? 'Saving…' : label}
        </>
      )}
    </button>
  );
}

function MissWashForm({
  visitId,
  nextSlotDate,
  onCancel,
}: {
  visitId: string;
  nextSlotDate: string;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<MissReason | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** One tap: choosing the reason is the submit. */
  async function submit(reason: MissReason) {
    setPending(reason);
    setError(null);
    try {
      const response = await fetch('/api/staff/wash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'miss',
          visitId,
          reason,
          rescheduleTo: nextSlotDate,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? 'Could not record that.');
        return;
      }
      router.push('/staff');
      router.refresh();
    } catch {
      setError('No signal. Try again when you have network.');
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <Card className="p-4">
        <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">
          Why not?
        </p>
        {MISS_REASONS.filter((r) => r !== 'STAFF_ABSENT').map((reason) => (
          <button
            key={reason}
            type="button"
            disabled={pending !== null}
            onClick={() => submit(reason)}
            className="flex w-full items-center justify-between border-b border-line-soft py-3.5 text-left text-[15px] font-semibold last:border-0 disabled:opacity-50"
          >
            {MISS_REASON_LABEL[reason]}
            {pending === reason ? (
              <span className="text-xs font-bold text-ink-mute">Saving…</span>
            ) : null}
          </button>
        ))}
      </Card>

      <div className="mt-3">
        <Note tone="brand">
          The wash goes back into the customer&rsquo;s count and is rescheduled.
          He does not lose it.
        </Note>
      </div>

      {error ? (
        <div className="mt-3">
          <Note tone="danger">{error}</Note>
        </div>
      ) : null}

      <Button block variant="secondary" className="mt-3" onClick={onCancel}>
        Back
      </Button>
    </>
  );
}
