import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  IconCamera,
  IconCar,
  IconCheck,
  IconRupee,
  IconShield,
  IconStar,
} from '@/components/shell/icons';
import { getStore } from '@/lib/data';
import { publicReviews } from '@/lib/services/reviews';
import { EnquiryForm } from './EnquiryForm';
import type { SiteFeature } from '@/lib/data/types';
import { money } from '@/lib/util/format';

/** Icons the Super Admin can pick per feature, by name. */
const FEATURE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  camera: IconCamera,
  check: IconCheck,
  car: IconCar,
  rupee: IconRupee,
  shield: IconShield,
};

export default async function HomePage() {
  const store = await getStore();
  const site = await store.getSiteContent();
  const [allPackages, areas, reviews] = await Promise.all([
    store.packages.find({ where: { active: true } }),
    store.areas.find({ orderBy: [{ field: 'name' }] }),
    // Genuine ratings from completed washes — more persuasive than written
    // quotes, and they keep themselves current without anyone maintaining them.
    site.showRealReviews
      ? publicReviews(store, { minStars: site.minReviewStars, limit: 6 })
      : Promise.resolve({ average: 0, count: 0, reviews: [] }),
  ]);

  // Taken off the site entirely rather than shown half-finished.
  if (!site.published) notFound();

  // Prices come from the same records that bill the customer, so what is
  // advertised here and what appears on an invoice cannot drift apart.
  const packages = site.visiblePackageIds.length
    ? allPackages.filter((p) => site.visiblePackageIds.includes(p.id))
    : allPackages;

  const features = [...site.features].sort((a, b) => a.order - b.order);
  const testimonials = site.testimonials
    .filter((t) => t.visible)
    .sort((a, b) => a.order - b.order);
  const gallery = site.gallery
    .filter((g) => g.visible)
    .sort((a, b) => a.order - b.order);

  return (
    <>
      {/* ---------------------------------------------------------------- */}
      <section className="relative overflow-hidden bg-gradient-to-br from-navy-800 via-navy-900 to-navy-950 px-5 py-20 sm:py-28">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-navy-grid bg-grid opacity-70"
        />
        <div className="relative mx-auto w-full max-w-6xl">
          <span className="inline-flex items-center rounded-pill border border-gold-500/50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-gold-500">
            {site.heroEyebrow}
          </span>

          <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
            {site.heroTitle}
            <br />
            <span className="text-gold-500">{site.heroTitleAccent}</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300">
            {site.heroBody}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#book"
              className="rounded-lg bg-gold-500 px-6 py-3 text-[15px] font-extrabold text-white transition-colors hover:bg-gold-600"
            >
              {site.heroPrimaryCta}
            </a>
            <a
              href="#packages"
              className="rounded-lg border border-navy-600 px-6 py-3 text-[15px] font-extrabold text-white transition-colors hover:bg-navy-800"
            >
              {site.heroSecondaryCta}
            </a>
          </div>

          {site.stats.length ? (
            <dl className="mt-14 grid max-w-2xl grid-cols-2 gap-6 border-t border-navy-700 pt-8 sm:grid-cols-3">
              {site.stats.map((stat) => (
                <div key={stat.label}>
                  <dt className="text-2xl font-extrabold text-white">{stat.value}</dt>
                  <dd className="mt-0.5 text-[11px] uppercase tracking-wide text-navy-300">
                    {stat.label}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section id="how" className="scroll-mt-20 bg-white px-5 py-20">
        <div className="mx-auto w-full max-w-6xl">
          <h2 className="text-3xl font-extrabold tracking-tight text-ink">
            {site.howTitle}
          </h2>

          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {site.howSteps.map((step, index) => (
              <li key={step.title}>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-800 text-base font-extrabold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-lg font-extrabold text-ink">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="bg-surface-muted px-5 py-20">
        <div className="mx-auto w-full max-w-6xl">
          <h2 className="text-3xl font-extrabold tracking-tight text-ink">
            {site.featuresTitle}
          </h2>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature: SiteFeature) => {
              const Icon = FEATURE_ICONS[feature.icon] ?? IconCheck;
              return (
                <div
                  key={feature.id}
                  className="rounded-card border border-line bg-white p-5 shadow-card"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-navy-50 text-navy-800">
                    <Icon />
                  </span>
                  <h3 className="mt-4 text-base font-extrabold text-ink">
                    {feature.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                    {feature.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section id="packages" className="scroll-mt-20 bg-white px-5 py-20">
        <div className="mx-auto w-full max-w-6xl">
          <h2 className="text-3xl font-extrabold tracking-tight text-ink">
            {site.packagesTitle}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
            {site.packagesBody}
          </p>

          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {packages.map((pkg, index) => {
              const featured = index === 1 && packages.length > 2;
              return (
                <div
                  key={pkg.id}
                  className={`relative flex flex-col rounded-card border p-6 ${
                    featured
                      ? 'border-navy-800 bg-navy-900 text-white shadow-raised'
                      : 'border-line bg-white shadow-card'
                  }`}
                >
                  {featured ? (
                    <span className="absolute -top-3 left-6 rounded-pill bg-gold-500 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white">
                      Most popular
                    </span>
                  ) : null}

                  <h3
                    className={`text-lg font-extrabold ${featured ? 'text-white' : 'text-ink'}`}
                  >
                    {pkg.name}
                  </h3>

                  <p className="mt-4 flex items-baseline gap-1.5">
                    <span
                      className={`text-4xl font-extrabold tracking-tight ${
                        featured ? 'text-gold-500' : 'text-navy-800'
                      }`}
                    >
                      {money(pkg.price)}
                    </span>
                    <span
                      className={`text-sm ${featured ? 'text-navy-200' : 'text-ink-mute'}`}
                    >
                      / month
                    </span>
                  </p>
                  <p
                    className={`mt-1 text-sm ${featured ? 'text-navy-200' : 'text-ink-mute'}`}
                  >
                    {pkg.washesPerMonth} washes ·{' '}
                    {money(Math.round(pkg.price / Math.max(1, pkg.washesPerMonth)))} each
                  </p>

                  <ul className="mt-5 flex-1 space-y-2">
                    {pkg.services.map((service) => (
                      <li
                        key={service}
                        className={`flex items-start gap-2 text-sm ${
                          featured ? 'text-slate-200' : 'text-ink-soft'
                        }`}
                      >
                        <IconCheck
                          width={16}
                          height={16}
                          strokeWidth={2.5}
                          className={`mt-0.5 shrink-0 ${
                            featured ? 'text-gold-500' : 'text-success-500'
                          }`}
                        />
                        {service}
                      </li>
                    ))}
                  </ul>

                  <a
                    href="#book"
                    className={`mt-6 rounded-lg py-2.5 text-center text-sm font-extrabold transition-colors ${
                      featured
                        ? 'bg-gold-500 text-white hover:bg-gold-600'
                        : 'bg-navy-800 text-white hover:bg-navy-700'
                    }`}
                  >
                    Choose {pkg.name}
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section id="areas" className="scroll-mt-20 bg-surface-muted px-5 py-20">
        <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-ink">
              {site.areasTitle}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              {site.areasBody}
            </p>
          </div>

          <div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {areas.map((area) => (
                <li
                  key={area.id}
                  className="rounded-card border border-line bg-white p-4 shadow-card"
                >
                  <h3 className="text-base font-extrabold text-ink">{area.name}</h3>
                  <p className="text-sm text-ink-mute">{area.city}</p>
                </li>
              ))}
            </ul>

            {site.mapEmbedUrl ? (
              <div className="mt-4 overflow-hidden rounded-card border border-line shadow-card">
                <iframe
                  src={site.mapEmbedUrl}
                  title={site.mapTitle}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  className="h-72 w-full border-0"
                />
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {testimonials.length ? (
        <section className="bg-white px-5 py-20">
          <div className="mx-auto w-full max-w-6xl">
            <h2 className="text-3xl font-extrabold tracking-tight text-ink">
              {site.testimonialsTitle}
            </h2>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {testimonials.map((testimonial) => (
                <figure
                  key={testimonial.id}
                  className="rounded-card border border-line bg-surface-muted p-6"
                >
                  <div className="flex gap-0.5 text-gold-500" aria-label={`${testimonial.rating} out of 5`}>
                    {Array.from({ length: testimonial.rating }).map((_, i) => (
                      <IconStar key={i} width={16} height={16} fill="currentColor" />
                    ))}
                  </div>
                  <blockquote className="mt-3 text-sm leading-relaxed text-ink-soft">
                    “{testimonial.quote}”
                  </blockquote>
                  <figcaption className="mt-4 text-sm font-extrabold text-ink">
                    {testimonial.name}
                    <span className="ml-1 font-semibold text-ink-mute">
                      · {testimonial.area}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      ) : null}


      {/* ---------------------------------------------------------------- */}
      {gallery.length ? (
        <section id="work" className="scroll-mt-20 bg-white px-5 py-20">
          <div className="mx-auto w-full max-w-6xl">
            <h2 className="text-3xl font-extrabold tracking-tight text-ink">
              {site.galleryTitle}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
              {site.galleryBody}
            </p>

            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {gallery.map((item) => (
                <figure
                  key={item.id}
                  className="overflow-hidden rounded-card border border-line bg-white shadow-card"
                >
                  <div className="grid grid-cols-2">
                    {([['Before', item.beforeUrl], ['After', item.afterUrl]] as const).map(
                      ([label, url]) => (
                        <div key={label} className="relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`${label} — ${item.caption || 'car wash'}`}
                            loading="lazy"
                            className="aspect-[4/3] w-full object-cover"
                          />
                          <span className="absolute left-2 top-2 rounded-pill bg-navy-950/80 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                            {label}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                  {item.caption || item.detail ? (
                    <figcaption className="p-4">
                      {item.caption ? (
                        <p className="text-sm font-bold text-ink">{item.caption}</p>
                      ) : null}
                      {item.detail ? (
                        <p className="text-xs text-ink-mute">{item.detail}</p>
                      ) : null}
                    </figcaption>
                  ) : null}
                </figure>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      {reviews.reviews.length ? (
        <section id="reviews" className="scroll-mt-20 bg-surface-muted px-5 py-20">
          <div className="mx-auto w-full max-w-6xl">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="text-3xl font-extrabold tracking-tight text-ink">
                Rated by the people we wash for
              </h2>
              <p className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-navy-800">
                  {reviews.average.toFixed(1)}
                </span>
                <span className="text-sm text-ink-mute">
                  from {reviews.count.toLocaleString('en-IN')} rated washes
                </span>
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {reviews.reviews.map((review) => (
                <figure
                  key={review.id}
                  className="rounded-card border border-line bg-white p-5 shadow-card"
                >
                  <div
                    className="flex gap-0.5 text-gold-500"
                    aria-label={`${review.rating} out of 5`}
                  >
                    {Array.from({ length: review.rating }).map((_, i) => (
                      <IconStar key={i} width={15} height={15} fill="currentColor" />
                    ))}
                  </div>
                  {review.comment ? (
                    <blockquote className="mt-3 text-sm leading-relaxed text-ink-soft">
                      “{review.comment}”
                    </blockquote>
                  ) : (
                    <p className="mt-3 text-sm leading-relaxed text-ink-mute">
                      Rated {review.rating} out of 5 for a {review.service.toLowerCase()}.
                    </p>
                  )}
                  <figcaption className="mt-4 text-sm font-extrabold text-ink">
                    {review.name}
                    <span className="ml-1 font-semibold text-ink-mute">
                      · {review.area}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>

            <p className="mt-6 text-xs text-ink-mute">
              These are real ratings left by customers on washes we actually
              did. We show first names and areas only.
            </p>
          </div>
        </section>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      <section id="book" className="scroll-mt-20 bg-navy-900 px-5 py-20">
        <div className="mx-auto grid w-full max-w-6xl gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white">
              {site.contactTitle}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              {site.contactBody}
            </p>

            <div className="mt-8 space-y-3 text-sm">
              <a
                href={`tel:${site.phone.replace(/\s/g, '')}`}
                className="flex items-center gap-3 text-white hover:text-gold-500"
              >
                <span className="text-navy-300">Call</span>
                <span className="font-extrabold">{site.phone}</span>
              </a>
              <a
                href={`https://wa.me/${site.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 text-white hover:text-gold-500"
              >
                <span className="text-navy-300">WhatsApp</span>
                <span className="font-extrabold">{site.whatsapp}</span>
              </a>
            </div>

            <p className="mt-8 text-sm text-navy-300">
              Already with us?{' '}
              <Link href="/login" className="font-bold text-gold-500 hover:underline">
                Sign in to your account
              </Link>
            </p>
          </div>

          <div className="rounded-card bg-white p-6 shadow-raised sm:p-8">
            <EnquiryForm
              areas={areas.map((a) => ({ id: a.id, label: `${a.name}, ${a.city}` }))}
              packages={packages.map((p) => ({
                id: p.id,
                label: `${p.name} — ${p.washesPerMonth} washes — ${money(p.price)}`,
              }))}
            />
          </div>
        </div>
      </section>
    </>
  );
}
