'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button, Card, CardHeading, Note, Tag } from '@/components/ui/primitives';
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
 * The wash flow: before photo → work done → after photo → close.
 *
 * The close button stays disabled until both photos exist, and the server
 * refuses the same combination independently. That is the whole integrity
 * story in one screen — a paper register cannot enforce it, this can.
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
  const [done, setDone] = useState<string[]>(services.slice(0, 1));
  const [uploading, setUploading] = useState<'before' | 'after' | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missOpen, setMissOpen] = useState(false);

  const beforeInput = useRef<HTMLInputElement>(null);
  const afterInput = useRef<HTMLInputElement>(null);

  const canClose = requireBothPhotos
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
      setError('No connection. Move to where you have signal and try again.');
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
      setError('No connection. Try again when you have signal.');
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
    <div className="space-y-3">
      <ol className="flex gap-1.5" aria-label="Progress">
        {[Boolean(before), done.length > 0, Boolean(after)].map((complete, i) => (
          <li
            key={i}
            className={`h-1.5 flex-1 rounded-pill ${complete ? 'bg-teal-500' : 'bg-line-strong'}`}
          />
        ))}
      </ol>

      <Card className="p-4">
        <CardHeading>Step 1 — Before photo</CardHeading>
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
        <PhotoTile
          label="Before"
          url={before}
          busy={uploading === 'before'}
          onPick={() => beforeInput.current?.click()}
        />
      </Card>

      <Card className="p-4">
        <CardHeading>Step 2 — What you did</CardHeading>
        {services.map((service) => {
          const on = done.includes(service);
          return (
            <button
              key={service}
              type="button"
              aria-pressed={on}
              onClick={() =>
                setDone((current) =>
                  on
                    ? current.filter((s) => s !== service)
                    : [...current, service],
                )
              }
              className="flex w-full items-center gap-3 border-b border-line-soft py-2.5 text-left text-sm last:border-0"
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
                  on
                    ? 'border-teal-500 bg-teal-500 text-white'
                    : 'border-line-strong'
                }`}
              >
                {on ? <IconCheck width={13} height={13} strokeWidth={3} /> : null}
              </span>
              {service}
            </button>
          );
        })}
      </Card>

      <Card className="p-4">
        <CardHeading>Step 3 — After photo</CardHeading>
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
          label="After"
          url={after}
          busy={uploading === 'after'}
          disabled={!before}
          disabledHint="Take the before photo first"
          onPick={() => afterInput.current?.click()}
        />

        <div className="mt-3">
          {before && after ? (
            <Note tone="teal">
              Both photos saved. You can close this wash.
            </Note>
          ) : (
            <Note>
              Both photos are compulsory. The wash cannot be closed without them.
            </Note>
          )}
        </div>
      </Card>

      {error ? <Note tone="danger">{error}</Note> : null}

      <Button block size="lg" disabled={!canClose || pending} onClick={closeWash}>
        {pending ? 'Closing…' : 'Mark wash done'}
      </Button>

      <Button block variant="secondary" onClick={() => setMissOpen(true)}>
        Could not do this wash
      </Button>
    </div>
  );
}

function PhotoTile({
  label,
  url,
  busy,
  disabled,
  disabledHint,
  onPick,
}: {
  label: string;
  url: string | null;
  busy: boolean;
  disabled?: boolean;
  disabledHint?: string;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled || busy}
      className={`flex aspect-[4/3] w-full max-w-[220px] flex-col items-center justify-center gap-1.5 rounded-lg border-2 text-sm font-bold transition-colors ${
        url
          ? 'border-teal-500 bg-teal-50 text-teal-600'
          : disabled
            ? 'border-dashed border-line-strong bg-surface-raised text-ink-faint'
            : 'border-dashed border-line-strong bg-surface-raised text-ink-mute hover:border-teal-400'
      }`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={`${label} photo`}
          className="h-full w-full rounded-[6px] object-cover"
        />
      ) : (
        <>
          <IconCamera width={26} height={26} />
          {busy ? 'Saving…' : disabled ? disabledHint : `Tap to take ${label.toLowerCase()}`}
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
  const [reason, setReason] = useState<MissReason | null>(null);
  const [note, setNote] = useState('');
  const [rescheduleTo, setRescheduleTo] = useState(nextSlotDate);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason) {
      setError('Choose a reason — this cannot be skipped.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/staff/wash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'miss',
          visitId,
          reason,
          note: note || undefined,
          rescheduleTo,
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
      setError('No connection. Try again when you have signal.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="mb-2 flex items-center justify-between">
          <CardHeading>Reason</CardHeading>
          <Tag tone="bad">Compulsory</Tag>
        </div>
        {MISS_REASONS.filter((r) => r !== 'STAFF_ABSENT').map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={reason === r}
            onClick={() => setReason(r)}
            className="flex w-full items-center gap-3 border-b border-line-soft py-2.5 text-left text-sm last:border-0"
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                reason === r
                  ? 'border-teal-500 bg-teal-500 text-white'
                  : 'border-line-strong'
              }`}
            >
              {reason === r ? (
                <IconCheck width={12} height={12} strokeWidth={3} />
              ) : null}
            </span>
            {MISS_REASON_LABEL[r]}
          </button>
        ))}

        <label className="field-label mt-3" htmlFor="miss-note">
          Any detail (optional)
        </label>
        <textarea
          id="miss-note"
          className="field"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Card>

      <Card className="p-4">
        <CardHeading>Reschedule to</CardHeading>
        <input
          type="date"
          className="field"
          value={rescheduleTo}
          onChange={(e) => setRescheduleTo(e.target.value)}
        />
      </Card>

      <Note tone="teal">
        The wash goes <b>back into the customer’s count</b> — he does not lose
        it. The customer and your area manager are both told.
      </Note>

      {error ? <Note tone="danger">{error}</Note> : null}

      <Button block size="lg" disabled={pending} onClick={submit}>
        {pending ? 'Sending…' : 'Submit'}
      </Button>
      <Button block variant="secondary" onClick={onCancel}>
        Back to the wash
      </Button>
    </div>
  );
}
