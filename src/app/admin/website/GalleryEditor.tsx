'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button, Card, CardHeading, Note, Tag } from '@/components/ui/primitives';
import { toast } from '@/components/ui/ToastProvider';
import { IconClose } from '@/components/shell/icons';
import type { SiteContent } from '@/lib/data/types';

/**
 * The before/after gallery.
 *
 * Note the deliberate separation from wash photos: those are only ever served
 * to a signed-in account, because they are pictures of customers' vehicles
 * outside their homes. Anything here becomes public, so it has to be uploaded
 * on purpose.
 */
export function GalleryEditor({ content }: { content: SiteContent }) {
  const router = useRouter();
  const [items, setItems] = useState(content.gallery);
  const [caption, setCaption] = useState('');
  const [detail, setDetail] = useState('');
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<{ ok?: string; error?: string }>({});

  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);
  const [beforeName, setBeforeName] = useState('');
  const [afterName, setAfterName] = useState('');
  const [beforePreview, setBeforePreview] = useState<string | null>(null);
  const [afterPreview, setAfterPreview] = useState<string | null>(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (beforePreview) URL.revokeObjectURL(beforePreview);
      if (afterPreview) URL.revokeObjectURL(afterPreview);
    };
  }, [beforePreview, afterPreview]);

  function handleFile(type: 'before' | 'after', file?: File) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (type === 'before') {
      if (beforePreview) URL.revokeObjectURL(beforePreview);
      setBeforePreview(url);
      setBeforeName(file.name);
    } else {
      if (afterPreview) URL.revokeObjectURL(afterPreview);
      setAfterPreview(url);
      setAfterName(file.name);
    }
  }

  function removeFile(type: 'before' | 'after') {
    if (type === 'before') {
      if (beforePreview) URL.revokeObjectURL(beforePreview);
      setBeforePreview(null);
      setBeforeName('');
      if (beforeRef.current) beforeRef.current.value = '';
    } else {
      if (afterPreview) URL.revokeObjectURL(afterPreview);
      setAfterPreview(null);
      setAfterName('');
      if (afterRef.current) afterRef.current.value = '';
    }
  }

  async function upload() {
    const before = beforeRef.current?.files?.[0];
    const after = afterRef.current?.files?.[0];
    if (!before || !after) {
      const err = 'Choose both a before and an after photo.';
      setState({ error: err });
      toast.error(err);
      return;
    }
    setPending(true);
    setState({});
    try {
      const body = new FormData();
      body.set('before', before);
      body.set('after', after);
      body.set('caption', caption);
      body.set('detail', detail);

      const response = await fetch('/api/admin/gallery', { method: 'POST', body });
      const data = (await response.json()) as {
        gallery?: SiteContent['gallery'];
        message?: string;
        error?: string;
      };
      if (!response.ok || !data.gallery) {
        const err = data.error ?? 'Could not add those images.';
        setState({ error: err });
        toast.error(err);
        return;
      }
      setItems(data.gallery);
      const msg = data.message ?? 'Added to gallery.';
      setState({ ok: msg });
      toast.success(msg);
      setCaption('');
      setDetail('');
      removeFile('before');
      removeFile('after');
      router.refresh();
    } catch {
      setState({ error: 'No connection.' });
      toast.error('No connection.');
    } finally {
      setPending(false);
    }
  }

  async function saveItems(next: SiteContent['gallery']) {
    setItems(next);
    await fetch('/api/admin/website', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gallery: next }),
    });
    router.refresh();
  }

  return (
    <Card className="p-5">
      <CardHeading>Our work — before and after</CardHeading>
      <p className="-mt-1 mb-3 text-xs text-ink-mute">
        Pictures you upload here are <b>public</b>. Customers&rsquo; own wash
        photos are never shown on the website — only what you add below.
      </p>

      <div className="rounded-lg border border-line bg-surface-muted p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ['Before photo', 'before', beforeRef, beforeName, beforePreview],
              ['After photo', 'after', afterRef, afterName, afterPreview],
            ] as const
          ).map(([label, type, ref, name, preview]) => (
            <div key={label}>
              <div className="mb-1 flex items-center justify-between">
                <span className="field-label mb-0">{label}</span>
                {preview ? (
                  <button
                    type="button"
                    onClick={() => removeFile(type)}
                    className="text-[11px] font-semibold text-danger-500 hover:text-danger-600"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <input
                ref={ref}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => handleFile(type, e.target.files?.[0])}
              />
              {preview ? (
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-line-strong bg-navy-950 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview}
                    alt={label}
                    className="h-full w-full object-cover transition-transform duration-200 hover:scale-105"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2.5 text-white">
                    <span className="max-w-[170px] truncate text-xs font-semibold text-slate-100">
                      {name}
                    </span>
                    <button
                      type="button"
                      onClick={() => ref.current?.click()}
                      className="rounded bg-white/20 px-2 py-1 text-[11px] font-bold text-white backdrop-blur-sm transition-colors hover:bg-white/30"
                    >
                      Change
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => ref.current?.click()}
                  className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-line-strong bg-white p-4 text-center transition-colors hover:border-navy-400 hover:bg-navy-50/50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-50 text-navy-600">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                    </svg>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-navy-800">
                      Click to choose photo
                    </span>
                    <span className="block text-[11px] text-ink-mute">
                      PNG, JPG, WEBP up to 10MB
                    </span>
                  </div>
                </button>
              )}
            </div>
          ))}
        </div>

        <label className="mt-3 block">
          <span className="field-label">Caption</span>
          <input
            className="field"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Weekly pressure wash"
          />
        </label>
        <label className="mt-2 block">
          <span className="field-label">Small detail underneath</span>
          <input
            className="field"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Hyundai i20 · Bajaj Nagar"
          />
          <span className="mt-1 block text-[11px] text-ink-mute">
            Do not include a number plate or an address.
          </span>
        </label>

        <Button className="mt-3" disabled={pending} onClick={upload}>
          {pending ? 'Uploading…' : 'Add to gallery'}
        </Button>
      </div>

      {state.ok ? <div className="mt-2"><Note tone="success">{state.ok}</Note></div> : null}
      {state.error ? <div className="mt-2"><Note tone="danger">{state.error}</Note></div> : null}

      {items.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {items.map((item, index) => (
            <div key={item.id} className="rounded-lg border border-line bg-white p-2">
              <div className="grid grid-cols-2 gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.beforeUrl} alt="Before" className="aspect-[4/3] w-full rounded object-cover" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.afterUrl} alt="After" className="aspect-[4/3] w-full rounded object-cover" />
              </div>
              <p className="mt-2 text-sm font-bold text-ink">{item.caption || 'Untitled'}</p>
              <p className="text-xs text-ink-mute">{item.detail}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {item.visible ? <Tag tone="ok">On the site</Tag> : <Tag tone="neutral">Hidden</Tag>}
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    saveItems(
                      items.map((x, i) => (i === index ? { ...x, visible: !x.visible } : x)),
                    )
                  }
                >
                  {item.visible ? 'Hide' : 'Show'}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => saveItems(items.filter((_, i) => i !== index))}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg border border-dashed border-line-strong p-6 text-center text-sm text-ink-mute">
          No pictures yet. The section stays off the website until you add one.
        </p>
      )}
    </Card>
  );
}

/** Real customer ratings, and the map. */
export function ReviewsAndMapEditor({ content }: { content: SiteContent }) {
  const router = useRouter();
  const [showRealReviews, setShow] = useState(content.showRealReviews);
  const [minReviewStars, setMin] = useState(content.minReviewStars);
  const [mapTitle, setMapTitle] = useState(content.mapTitle);
  const [mapEmbedUrl, setMapUrl] = useState(content.mapEmbedUrl);
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<{ ok?: string; error?: string }>({});

  async function save() {
    setPending(true);
    setState({});
    try {
      const response = await fetch('/api/admin/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showRealReviews, minReviewStars, mapTitle, mapEmbedUrl }),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setState({ error: data.error ?? 'Could not save.' });
        return;
      }
      setState({ ok: data.message ?? 'Saved.' });
      router.refresh();
    } catch {
      setState({ error: 'No connection.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-5">
      <CardHeading>Customer ratings and the map</CardHeading>

      <button
        type="button"
        role="switch"
        aria-checked={showRealReviews}
        onClick={() => setShow((v) => !v)}
        className="flex w-full items-start gap-3 border-b border-line-soft py-3 text-left"
      >
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 text-white ${
            showRealReviews ? 'border-navy-800 bg-navy-800' : 'border-line-strong'
          }`}
        >
          {showRealReviews ? '✓' : ''}
        </span>
        <span>
          <span className="block text-sm font-semibold">
            Show real ratings from completed washes
          </span>
          <span className="block text-xs text-ink-mute">
            Pulled straight from what customers rated. Only first names and
            areas are shown — never a full name, address or number plate.
          </span>
        </span>
      </button>

      <label className="mt-3 block">
        <span className="field-label">Only show ratings of at least</span>
        <select
          className="field"
          value={minReviewStars}
          onChange={(e) => setMin(Number(e.target.value))}
        >
          {[5, 4, 3].map((n) => (
            <option key={n} value={n}>
              {n} stars and above
            </option>
          ))}
        </select>
        <span className="mt-1 block text-[11px] text-ink-mute">
          The average shown on the site is always over <b>every</b> rating, not
          only the ones displayed.
        </span>
      </label>

      <hr className="my-4 border-line" />

      <label className="block">
        <span className="field-label">Map heading</span>
        <input className="field" value={mapTitle} onChange={(e) => setMapTitle(e.target.value)} />
      </label>

      <label className="mt-3 block">
        <span className="field-label">Map embed link</span>
        <input
          className="field"
          value={mapEmbedUrl}
          onChange={(e) => setMapUrl(e.target.value)}
          placeholder="https://www.openstreetmap.org/export/embed.html?bbox=…"
        />
        <span className="mt-1 block text-[11px] text-ink-mute">
          On Google Maps: Share → Embed a map → copy the link inside{' '}
          <code>src=&quot;…&quot;</code>. Leave empty to show only the list of
          areas.
        </span>
      </label>

      <Button className="mt-4" disabled={pending} onClick={save}>
        {pending ? 'Saving…' : 'Save this section'}
      </Button>

      {state.ok ? <div className="mt-2"><Note tone="success">{state.ok}</Note></div> : null}
      {state.error ? <div className="mt-2"><Note tone="danger">{state.error}</Note></div> : null}
    </Card>
  );
}
