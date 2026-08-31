'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Button, Card, CardHeading, Note, Tag } from '@/components/ui/primitives';
import { IconCheck } from '@/components/shell/icons';
import type { ServicePackage, SiteContent } from '@/lib/data/types';
import { money } from '@/lib/util/format';

/**
 * Editing the website's words.
 *
 * Each section saves on its own so a small correction is a small action, and
 * every field says what it does on the page rather than naming the database
 * column it maps to.
 */
function useSave() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<{ ok?: string; error?: string }>({});

  async function save(patch: Record<string, unknown>) {
    setPending(true);
    setState({});
    try {
      const response = await fetch('/api/admin/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setState({ error: data.error ?? 'Could not save.' });
        return false;
      }
      setState({ ok: data.message ?? 'Saved.' });
      router.refresh();
      return true;
    } catch {
      setState({ error: 'No connection.' });
      return false;
    } finally {
      setPending(false);
    }
  }

  return { save, pending, state };
}

function Feedback({ state }: { state: { ok?: string; error?: string } }) {
  if (state.ok) return <div className="mt-2"><Note tone="success">{state.ok}</Note></div>;
  if (state.error) return <div className="mt-2"><Note tone="danger">{state.error}</Note></div>;
  return null;
}

function Field({
  label,
  hint,
  value,
  onChange,
  rows,
  max,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  max?: number;
}) {
  const over = max !== undefined && value.length > max;
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {rows ? (
        <textarea className="field" rows={rows} value={value}
          onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className="field" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      <span className="mt-1 flex items-center justify-between text-[11px]">
        {hint ? <span className="text-ink-mute">{hint}</span> : <span />}
        {max !== undefined ? (
          <span className={over ? 'font-bold text-danger-500' : 'text-ink-faint'}>
            {value.length}/{max}
          </span>
        ) : null}
      </span>
    </label>
  );
}

function Section({
  title,
  description,
  children,
  onSave,
  pending,
  state,
  disabled,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onSave: () => void;
  pending: boolean;
  state: { ok?: string; error?: string };
  disabled?: boolean;
}) {
  return (
    <Card className="p-5">
      <CardHeading>{title}</CardHeading>
      {description ? (
        <p className="-mt-1 mb-3 text-xs text-ink-mute">{description}</p>
      ) : null}
      <div className="space-y-3">{children}</div>
      <Button className="mt-4" disabled={pending || disabled} onClick={onSave}>
        {pending ? 'Saving…' : 'Save this section'}
      </Button>
      <Feedback state={state} />
    </Card>
  );
}

/* -------------------------------------------------------------------------- */

export function PublishToggle({ content }: { content: SiteContent }) {
  const { save, pending, state } = useSave();
  return (
    <Card tone={content.published ? 'success' : 'gold'} className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold">
            {content.published ? 'Your website is live' : 'Your website is hidden'}
          </h2>
          <p className="mt-0.5 text-xs text-ink-mute">
            {content.published
              ? 'Anyone can see it, and the booking form is accepting enquiries.'
              : 'Visitors see nothing and bookings are refused. Nothing has been deleted.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            target="_blank"
            className="rounded-lg border border-line-strong bg-white px-4 py-2 text-sm font-bold text-navy-800 hover:bg-surface-muted"
          >
            View site
          </Link>
          <Button
            variant={content.published ? 'secondary' : 'primary'}
            disabled={pending}
            onClick={() => save({ published: !content.published })}
          >
            {pending ? 'Working…' : content.published ? 'Take offline' : 'Publish'}
          </Button>
        </div>
      </div>
      <Feedback state={state} />
    </Card>
  );
}

export function BannerEditor({ content }: { content: SiteContent }) {
  const { save, pending, state } = useSave();
  const [v, setV] = useState({
    heroEyebrow: content.heroEyebrow,
    heroTitle: content.heroTitle,
    heroTitleAccent: content.heroTitleAccent,
    heroBody: content.heroBody,
    heroPrimaryCta: content.heroPrimaryCta,
    heroSecondaryCta: content.heroSecondaryCta,
  });
  const [stats, setStats] = useState(content.stats);
  const set = (k: keyof typeof v) => (value: string) => setV((s) => ({ ...s, [k]: value }));

  return (
    <Section
      title="Banner — the first thing visitors see"
      onSave={() => save({ ...v, stats })}
      pending={pending}
      state={state}
      disabled={!v.heroTitle.trim() || !v.heroPrimaryCta.trim()}
    >
      <Field label="Small label above the heading" value={v.heroEyebrow}
        onChange={set('heroEyebrow')} max={60} />
      <Field label="Heading" value={v.heroTitle} onChange={set('heroTitle')} max={120} />
      <Field label="Second line, shown in gold" hint="Leave empty for a one-line heading."
        value={v.heroTitleAccent} onChange={set('heroTitleAccent')} max={120} />
      <Field label="Paragraph under the heading" rows={3} value={v.heroBody}
        onChange={set('heroBody')} max={600} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Main button" value={v.heroPrimaryCta} onChange={set('heroPrimaryCta')} max={40} />
        <Field label="Second button" value={v.heroSecondaryCta} onChange={set('heroSecondaryCta')} max={40} />
      </div>

      <div>
        <span className="field-label">Three numbers under the banner</span>
        {stats.map((stat, index) => (
          <div key={index} className="mb-2 grid gap-2 sm:grid-cols-[1fr_2fr]">
            <input className="field" value={stat.value} placeholder="500+"
              onChange={(e) =>
                setStats((s) => s.map((x, i) => (i === index ? { ...x, value: e.target.value } : x)))
              } />
            <input className="field" value={stat.label} placeholder="Cars washed every week"
              onChange={(e) =>
                setStats((s) => s.map((x, i) => (i === index ? { ...x, label: e.target.value } : x)))
              } />
          </div>
        ))}
        <div className="flex gap-2">
          {stats.length < 4 ? (
            <Button size="sm" variant="secondary"
              onClick={() => setStats((s) => [...s, { value: '', label: '' }])}>
              + Add a number
            </Button>
          ) : null}
          {stats.length > 0 ? (
            <Button size="sm" variant="secondary" onClick={() => setStats((s) => s.slice(0, -1))}>
              Remove the last
            </Button>
          ) : null}
        </div>
      </div>
    </Section>
  );
}

export function SectionsEditor({ content }: { content: SiteContent }) {
  const { save, pending, state } = useSave();
  const [howTitle, setHowTitle] = useState(content.howTitle);
  const [howSteps, setHowSteps] = useState(content.howSteps);
  const [featuresTitle, setFeaturesTitle] = useState(content.featuresTitle);
  const [features, setFeatures] = useState(content.features);

  return (
    <Section
      title="How it works, and why people stay"
      description="Three steps, then the reasons customers give for staying with you."
      onSave={() => save({ howTitle, howSteps, featuresTitle, features })}
      pending={pending}
      state={state}
    >
      <Field label="“How it works” heading" value={howTitle} onChange={setHowTitle} max={120} />
      {howSteps.map((step, index) => (
        <div key={index} className="rounded-lg border border-line bg-surface-muted p-3">
          <span className="text-[11px] font-extrabold uppercase tracking-wide text-ink-soft">
            Step {index + 1}
          </span>
          <input className="field mt-1.5" value={step.title} placeholder="Short title"
            onChange={(e) =>
              setHowSteps((s) => s.map((x, i) => (i === index ? { ...x, title: e.target.value } : x)))
            } />
          <textarea className="field mt-2" rows={2} value={step.body} placeholder="One or two sentences"
            onChange={(e) =>
              setHowSteps((s) => s.map((x, i) => (i === index ? { ...x, body: e.target.value } : x)))
            } />
        </div>
      ))}

      <hr className="border-line" />

      <Field label="“Why people stay” heading" value={featuresTitle}
        onChange={setFeaturesTitle} max={120} />
      {features.map((feature, index) => (
        <div key={feature.id} className="rounded-lg border border-line bg-surface-muted p-3">
          <input className="field" value={feature.title} placeholder="Reason"
            onChange={(e) =>
              setFeatures((s) => s.map((x, i) => (i === index ? { ...x, title: e.target.value } : x)))
            } />
          <textarea className="field mt-2" rows={2} value={feature.body}
            onChange={(e) =>
              setFeatures((s) => s.map((x, i) => (i === index ? { ...x, body: e.target.value } : x)))
            } />
          <label className="mt-2 block">
            <span className="field-label">Icon</span>
            <select className="field" value={feature.icon}
              onChange={(e) =>
                setFeatures((s) => s.map((x, i) => (i === index ? { ...x, icon: e.target.value } : x)))
              }>
              {[
                ['camera', 'Camera — proof and photos'],
                ['check', 'Tick — a promise kept'],
                ['car', 'Car — vehicles and schedules'],
                ['rupee', 'Rupee — money and payment'],
                ['shield', 'Shield — trust and safety'],
              ].map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>
      ))}
    </Section>
  );
}

export function PackagesEditor({
  content,
  packages,
}: {
  content: SiteContent;
  packages: ServicePackage[];
}) {
  const { save, pending, state } = useSave();
  const [title, setTitle] = useState(content.packagesTitle);
  const [body, setBody] = useState(content.packagesBody);
  const [visible, setVisible] = useState<string[]>(content.visiblePackageIds);

  const showingAll = visible.length === 0;

  return (
    <Section
      title="Packages"
      description="Prices come from your Packages screen — change one there and the website follows. You only choose which to advertise."
      onSave={() => save({ packagesTitle: title, packagesBody: body, visiblePackageIds: visible })}
      pending={pending}
      state={state}
    >
      <Field label="Heading" value={title} onChange={setTitle} max={120} />
      <Field label="Paragraph" rows={3} value={body} onChange={setBody} max={600} />

      <div>
        <span className="field-label">Which packages to show</span>
        <button type="button" onClick={() => setVisible([])}
          className="flex w-full items-center gap-3 border-b border-line-soft py-2.5 text-left text-sm">
          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
            showingAll ? 'border-navy-800 bg-navy-800 text-white' : 'border-line-strong'}`}>
            {showingAll ? <IconCheck width={13} height={13} strokeWidth={3} /> : null}
          </span>
          <span>
            <b>Show every active package</b>
            <span className="block text-xs text-ink-mute">
              New packages appear on the site automatically.
            </span>
          </span>
        </button>

        {packages.map((pkg) => {
          const on = visible.includes(pkg.id);
          return (
            <button key={pkg.id} type="button"
              onClick={() =>
                setVisible((current) =>
                  on ? current.filter((id) => id !== pkg.id) : [...current, pkg.id],
                )
              }
              className="flex w-full items-center gap-3 border-b border-line-soft py-2.5 text-left text-sm last:border-0">
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 ${
                on ? 'border-navy-800 bg-navy-800 text-white' : 'border-line-strong'}`}>
                {on ? <IconCheck width={13} height={13} strokeWidth={3} /> : null}
              </span>
              <span className="flex-1">
                {pkg.name}
                <span className="ml-1 text-ink-mute">
                  — {pkg.washesPerMonth} washes — {money(pkg.price)}
                </span>
              </span>
              {!pkg.active ? <Tag tone="neutral">Retired</Tag> : null}
            </button>
          );
        })}

        {showingAll ? null : (
          <p className="mt-2 text-xs text-ink-mute">
            {visible.length} selected. Tick nothing to go back to showing them all.
          </p>
        )}
      </div>
    </Section>
  );
}

export function TestimonialsEditor({ content }: { content: SiteContent }) {
  const { save, pending, state } = useSave();
  const [title, setTitle] = useState(content.testimonialsTitle);
  const [items, setItems] = useState(content.testimonials);

  const update = (index: number, patch: Partial<(typeof items)[number]>) =>
    setItems((s) => s.map((x, i) => (i === index ? { ...x, ...patch } : x)));

  return (
    <Section
      title="What customers say"
      description="Use real words from real customers. Hide one rather than deleting it if you may want it back."
      onSave={() => save({ testimonialsTitle: title, testimonials: items })}
      pending={pending}
      state={state}
    >
      <Field label="Heading" value={title} onChange={setTitle} max={120} />

      {items.map((item, index) => (
        <div key={item.id} className="rounded-lg border border-line bg-surface-muted p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="field" value={item.name} placeholder="Customer name"
              onChange={(e) => update(index, { name: e.target.value })} />
            <input className="field" value={item.area} placeholder="Their area"
              onChange={(e) => update(index, { area: e.target.value })} />
          </div>
          <textarea className="field mt-2" rows={2} value={item.quote} placeholder="What they said"
            onChange={(e) => update(index, { quote: e.target.value })} />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-bold text-ink-soft">
              Stars
              <select className="rounded-lg border border-line-strong bg-white px-2 py-1 text-sm"
                value={item.rating}
                onChange={(e) => update(index, { rating: Number(e.target.value) })}>
                {[5, 4, 3].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <Button size="sm" variant="secondary"
              onClick={() => update(index, { visible: !item.visible })}>
              {item.visible ? 'Hide from site' : 'Show on site'}
            </Button>
            {item.visible ? <Tag tone="ok">On the site</Tag> : <Tag tone="neutral">Hidden</Tag>}
            <Button size="sm" variant="secondary"
              onClick={() => setItems((s) => s.filter((_, i) => i !== index))}>
              Delete
            </Button>
          </div>
        </div>
      ))}

      <Button size="sm" variant="secondary"
        onClick={() =>
          setItems((s) => [
            ...s,
            { id: `t_${Date.now()}`, name: '', area: '', quote: '', rating: 5, visible: true, order: s.length },
          ])
        }>
        + Add a customer quote
      </Button>
    </Section>
  );
}

export function ContactEditor({ content }: { content: SiteContent }) {
  const { save, pending, state } = useSave();
  const [v, setV] = useState({
    areasTitle: content.areasTitle,
    areasBody: content.areasBody,
    contactTitle: content.contactTitle,
    contactBody: content.contactBody,
    phone: content.phone,
    whatsapp: content.whatsapp,
    email: content.email,
    addressLine: content.addressLine,
  });
  const set = (k: keyof typeof v) => (value: string) => setV((s) => ({ ...s, [k]: value }));

  return (
    <Section
      title="Areas and contact details"
      description="Your areas are listed automatically from the areas you run. These are the words around them."
      onSave={() => save(v)}
      pending={pending}
      state={state}
    >
      <Field label="“Where we wash” heading" value={v.areasTitle} onChange={set('areasTitle')} max={120} />
      <Field label="Paragraph" rows={2} value={v.areasBody} onChange={set('areasBody')} max={600} />
      <hr className="border-line" />
      <Field label="Booking section heading" value={v.contactTitle} onChange={set('contactTitle')} max={120} />
      <Field label="Booking paragraph" rows={2} value={v.contactBody} onChange={set('contactBody')} max={600} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Phone" value={v.phone} onChange={set('phone')} />
        <Field label="WhatsApp" value={v.whatsapp} onChange={set('whatsapp')} />
        <Field label="Email" value={v.email} onChange={set('email')} />
        <Field label="City line" value={v.addressLine} onChange={set('addressLine')} />
      </div>
    </Section>
  );
}

export function SeoEditor({ content }: { content: SiteContent }) {
  const { save, pending, state } = useSave();
  const [seoTitle, setSeoTitle] = useState(content.seoTitle);
  const [seoDescription, setSeoDescription] = useState(content.seoDescription);

  return (
    <Section
      title="How you appear on Google"
      description="This is the blue link and grey text people see in search results."
      onSave={() => save({ seoTitle, seoDescription })}
      pending={pending}
      state={state}
    >
      <Field label="Title" hint="Around 60 characters shows without being cut off."
        value={seoTitle} onChange={setSeoTitle} max={70} />
      <Field label="Description" rows={3}
        hint="Around 155 characters shows without being cut off."
        value={seoDescription} onChange={setSeoDescription} max={180} />

      <div className="rounded-lg border border-line bg-white p-4">
        <span className="field-label">Preview</span>
        <p className="truncate text-[18px] leading-snug text-[#1a0dab]">
          {seoTitle || 'Your title appears here'}
        </p>
        <p className="text-[13px] text-[#006621]">carzz.app</p>
        <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-[#545454]">
          {seoDescription || 'Your description appears here.'}
        </p>
      </div>
    </Section>
  );
}
