import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandLockup } from '@/components/shell/Brand';
import { getStore } from '@/lib/data';

/** SEO copy comes from the record the Super Admin edits, not from code. */
export async function generateMetadata(): Promise<Metadata> {
  const site = await (await getStore()).getSiteContent();
  return {
    // `absolute` so the app's "· Carz Management" template does not get
    // appended to a title written for search results.
    title: { absolute: site.seoTitle },
    description: site.seoDescription,
    openGraph: {
      title: site.seoTitle,
      description: site.seoDescription,
      type: 'website',
    },
    // An unpublished site should not be indexed while it is being written.
    robots: site.published ? undefined : { index: false, follow: false },
  };
}

const NAV = [
  { href: '#how', label: 'How it works' },
  { href: '#packages', label: 'Packages' },
  { href: '#work', label: 'Our work' },
  { href: '#reviews', label: 'Reviews' },
  { href: '#areas', label: 'Areas' },
  { href: '#book', label: 'Book' },
];

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const site = await (await getStore()).getSiteContent();

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white">
      <header className="sticky top-0 z-40 border-b border-navy-800/40 bg-navy-900/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-6 px-5 py-3">
          <Link href="/" aria-label="Carz home">
            <BrandLockup subtitle="Car wash" />
          </Link>

          <nav className="ml-auto hidden items-center gap-6 md:flex" aria-label="Site">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-semibold text-navy-200 transition-colors hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <Link
            href="/login"
            className="ml-auto rounded-lg border border-navy-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-navy-800 md:ml-0"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-navy-800 bg-navy-950 px-5 py-10 text-navy-200">
        <div className="mx-auto grid w-full max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <BrandLockup subtitle="Car wash" />
            <p className="mt-3 max-w-xs text-sm leading-relaxed">
              {site.seoDescription}
            </p>
          </div>

          <div>
            <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-gold-500">
              Talk to us
            </h2>
            <ul className="mt-2.5 space-y-1.5 text-sm">
              <li>
                <a className="hover:text-white" href={`tel:${site.phone.replace(/\s/g, '')}`}>
                  {site.phone}
                </a>
              </li>
              <li>
                <a
                  className="hover:text-white"
                  href={`https://wa.me/${site.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>
              </li>
              <li>
                <a className="hover:text-white" href={`mailto:${site.email}`}>
                  {site.email}
                </a>
              </li>
              <li>{site.addressLine}</li>
            </ul>
          </div>

          <div>
            <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-gold-500">
              The service
            </h2>
            <ul className="mt-2.5 space-y-1.5 text-sm">
              {NAV.map((item) => (
                <li key={item.href}>
                  <a className="hover:text-white" href={item.href}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-gold-500">
              Already a customer?
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed">
              Sign in to see your schedule, the photos of every wash, and your
              balance.
            </p>
            <Link
              href="/login"
              className="mt-3 inline-block rounded-lg bg-gold-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-gold-600"
            >
              Open my account
            </Link>
          </div>
        </div>

        <p className="mx-auto mt-8 w-full max-w-6xl border-t border-navy-800 pt-5 text-xs text-navy-400">
          © {new Date().getFullYear()} Carz. {site.addressLine}.
        </p>
      </footer>
    </div>
  );
}
