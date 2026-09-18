import { notFound } from 'next/navigation';
import {
  IconCamera,
  IconCar,
  IconCheck,
  IconStar,
} from '@/components/shell/icons';
import { getStore } from '@/lib/data';
import { EnquiryForm } from './EnquiryForm';
import { money } from '@/lib/util/format';

export default async function HomePage() {
  const store = await getStore();
  const site = await store.getSiteContent();

  if (!site.published) {
    notFound();
  }

  const [allPackages, areas] = await Promise.all([
    store.packages.find({ where: { active: true } }),
    store.areas.find({ orderBy: [{ field: 'name' }] }),
  ]);

  const packagesList = allPackages.length > 0 ? allPackages : [
    {
      id: 'p-bucket',
      name: 'Bucket Wash',
      price: 1600,
      washesPerMonth: 8,
      services: ['Exterior wash', 'Interior vacuum', 'Tyre dressing'],
    },
    {
      id: 'p-detail',
      name: 'Detailing',
      price: 3200,
      washesPerMonth: 4,
      services: ['Pressure wash', 'Interior vacuum', 'Polish / wax', 'Tyre dressing'],
    },
    {
      id: 'p-pressure',
      name: 'Pressure Wash',
      price: 2000,
      washesPerMonth: 8,
      services: ['Pressure wash', 'Interior vacuum', 'Tyre dressing'],
    },
  ];

  const packages = [...packagesList].sort((a, b) => {
    const order: Record<string, number> = { 'bucket wash': 1, 'detailing': 2, 'pressure wash': 3 };
    const aOrder = order[a.name.toLowerCase()] ?? 2;
    const bOrder = order[b.name.toLowerCase()] ?? 2;
    return aOrder - bOrder;
  });

  const areasList = areas.length > 0 ? areas : [
    { id: 'a1', name: 'Bajaj Nagar', city: 'Nagpur' },
    { id: 'a2', name: 'Civil Lines', city: 'Nagpur' },
    { id: 'a3', name: 'Wadi', city: 'Nagpur' },
  ];

  return (
    <div className="flex flex-col bg-white text-slate-900 selection:bg-amber-400 selection:text-[#081429]">

      {/* ===================================================================== */}
      {/* 1. HERO                                                               */}
      {/* ===================================================================== */}
      <section className="relative overflow-hidden bg-[#071739] text-white" style={{ minHeight: '640px' }}>
        {/* Atmospheric glow blobs */}
        <div className="pointer-events-none absolute -top-40 left-1/4 h-[600px] w-[500px] rounded-full bg-blue-700/10 blur-[140px]" />
        <div className="pointer-events-none absolute -bottom-20 right-1/4 h-[400px] w-[400px] rounded-full bg-amber-500/8 blur-[120px]" />

        {/* Full-bleed image — right 66%, multi-stop gradient left edge */}
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden lg:block" style={{ width: '66%' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/hero-car-wash.jpg"
            alt="Doorstep Car Wash Service"
            className="h-full w-full object-cover object-center"
          />
          {/* Multi-stop left fade — no hard edge */}
          <div
            className="absolute inset-y-0 left-0"
            style={{
              width: '72%',
              background: 'linear-gradient(to right, #071739 0%, #071739 28%, rgba(7,23,57,0.94) 42%, rgba(7,23,57,0.78) 56%, rgba(7,23,57,0.48) 70%, rgba(7,23,57,0.18) 85%, transparent 100%)',
            }}
          />
          {/* Top + bottom fades */}
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#071739] via-[#071739]/55 to-transparent" />
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#071739]/60 to-transparent" />
        </div>

        {/* Floating badge — Before & After */}
        <div className="absolute hidden lg:flex items-center gap-2.5 rounded-2xl border border-white/25 bg-white/95 px-4 py-2.5 text-[#071739] shadow-2xl backdrop-blur-sm" style={{ top: '12%', right: '26%', zIndex: 20 }}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white flex-shrink-0">
            <IconCamera width={16} height={16} strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-xs font-bold leading-tight">Before &amp; After</p>
            <p className="text-[10px] font-semibold text-slate-500 leading-tight">photos for every wash</p>
          </div>
        </div>

        {/* Floating badge — Same Day Service */}
        <div className="absolute hidden lg:flex items-center gap-3" style={{ bottom: '11%', right: '3%', zIndex: 20 }}>
          <div className="hidden xl:block text-left select-none">
            <span className="block text-[15px] font-bold italic text-amber-300 leading-snug drop-shadow" style={{ fontFamily: 'Georgia, serif' }}>We wash.</span>
            <span className="block text-[15px] font-bold italic text-amber-300 leading-snug border-b-2 border-amber-400 drop-shadow" style={{ fontFamily: 'Georgia, serif' }}>You relax.</span>
          </div>
          <div className="flex items-center gap-2.5 rounded-2xl border-2 border-amber-400/70 bg-[#071739]/90 px-4 py-3 text-white shadow-2xl backdrop-blur-md">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300 font-bold text-lg flex-shrink-0">⚡</span>
            <div className="text-left">
              <p className="text-sm font-bold leading-tight text-white">Same Day</p>
              <p className="text-[11px] font-bold text-amber-400 leading-tight">Service</p>
            </div>
          </div>
        </div>

        {/* Foreground content */}
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-12 pb-14 lg:pt-16 lg:pb-24">
          <div className="max-w-[560px]">
            {/* Gold pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/50 bg-amber-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-400 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
              </span>
              DOORSTEP CAR WASH · NAGPUR
            </div>

            {/* Headline */}
            <h1 className="mt-5 text-[44px] sm:text-5xl lg:text-[62px] font-bold leading-[1.06] tracking-tight text-white">
              {site.heroTitle || 'Clean Car.'}<br />
              <span className="text-[#f59e0b]">{site.heroTitleAccent || 'Happier Days.'}</span>
            </h1>

            {/* Subheading */}
            <p className="mt-5 max-w-md text-sm sm:text-base leading-relaxed text-slate-300/90">
              We come to your location, clean your car, and share before &amp; after photos.
              No calls, no chasing, no hassle.
            </p>

            {/* Feature chips */}
            <div className="mt-7 flex flex-wrap gap-2">
              {[
                { icon: '👨‍🔧', label: 'Trained Wash Boys' },
                { icon: '📷', label: 'Photo Proof Every Wash' },
                { icon: '₹', label: 'Multiple Payment Options' },
                { icon: '🛡️', label: 'Safe & Reliable' },
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-3.5 py-2 backdrop-blur-sm">
                  <span className="text-amber-300 text-sm">{icon}</span>
                  <span className="text-[11.5px] sm:text-xs font-semibold text-slate-200">{label}</span>
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <a
                href="#book"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#f59e0b] hover:bg-[#e08900] px-7 py-4 text-sm sm:text-base font-semibold text-[#071739] shadow-lg shadow-amber-500/30 hover:scale-[1.03] active:scale-[0.97] transition-all"
              >
                <span>Book a Wash</span>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </a>
              <a
                href="#packages"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/8 hover:bg-white/15 px-7 py-4 text-sm sm:text-base font-bold text-white backdrop-blur-sm transition-all"
              >
                View Packages
              </a>
            </div>

            {/* Stats */}
            <div className="mt-11 grid grid-cols-3 gap-0 border-t border-white/10 pt-7">
              <div className="pr-4">
                <div className="text-3xl sm:text-4xl font-bold text-white tracking-tight">500+</div>
                <p className="mt-1 text-[11px] font-medium text-slate-400 leading-snug">Cars Washed<br />Every Week</p>
              </div>
              <div className="border-x border-white/10 px-4">
                <div className="flex items-center gap-1.5 text-3xl sm:text-4xl font-bold text-white tracking-tight">
                  <span>4.6</span>
                  <span className="text-amber-400 text-2xl">★</span>
                </div>
                <p className="mt-1 text-[11px] font-medium text-slate-400 leading-snug">Average<br />Customer Rating</p>
              </div>
              <div className="pl-4">
                <div className="text-3xl sm:text-4xl font-bold text-white tracking-tight">3</div>
                <p className="mt-1 text-[11px] font-medium text-slate-400 leading-snug">Areas Across<br />Nagpur</p>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile image strip */}
        <div className="relative block lg:hidden overflow-hidden" style={{ height: '220px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/hero-car-wash.jpg"
            alt="Car wash service"
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#071739] to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-white to-transparent" />
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 2. HOW IT WORKS                                                       */}
      {/* ===================================================================== */}
      <section id="how" className="scroll-mt-16 bg-[#f0f5fb] px-4 sm:px-6 lg:px-8 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <span className="inline-block rounded-full bg-blue-600/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-blue-700">
              SIMPLE. CONVENIENT. RELIABLE.
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
              How it works
            </h2>
            <p className="mt-2 text-sm text-slate-500 max-w-sm mx-auto">
              A sparkling clean car in 3 easy steps. We handle everything.
            </p>
          </div>

          {/* 3 Step Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {/* Dotted connector line — desktop only */}
            <div className="hidden md:block absolute top-12 left-[calc(33.33%+12px)] right-[calc(33.33%+12px)] border-t-2 border-dashed border-blue-200 z-0" />

            {[
              {
                num: '1',
                icon: (
                  <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                ),
                title: 'Tell us where you park',
                desc: 'Your building, your slot, your time. We fit the service entirely around your schedule.',
                accent: 'border-t-blue-500',
              },
              {
                num: '2',
                icon: <IconCar className="w-5 h-5" />,
                title: 'We come to you',
                desc: 'Our trained wash boy arrives right on time. No calls, no chasing, no waiting around.',
                accent: 'border-t-amber-500',
              },
              {
                num: '3',
                icon: <IconCamera width={22} height={22} strokeWidth={2} />,
                title: 'You see the proof',
                desc: 'Receive before & after photos of every wash so you always know what you paid for.',
                accent: 'border-t-green-500',
              },
            ].map(({ num, icon, title, desc, accent }) => (
              <div key={num} className={`relative z-10 flex flex-col rounded-2xl border-t-4 border border-slate-200 bg-white p-7 shadow-sm hover:shadow-md transition-shadow ${accent}`}>
                <div className="flex items-start justify-between mb-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#071739] text-sm font-bold text-white shadow-sm">
                    {num}
                  </span>
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    {icon}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* Bottom CTA */}
          <div className="mt-10 text-center">
            <a
              href="#book"
              className="inline-flex items-center gap-2 rounded-xl bg-[#071739] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0d2557] transition-colors shadow-sm"
            >
              Book your first wash
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 3. PACKAGES & SERVICE AREAS                                           */}
      {/* ===================================================================== */}
      <section id="packages" className="scroll-mt-16 bg-white px-4 sm:px-6 lg:px-8 py-20 border-t border-slate-100">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-[1.8fr_1fr] gap-12 items-start">

            {/* Left: Packages */}
            <div>
              <div className="mb-10">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">
                  TRANSPARENT PRICING
                </span>
                <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
                  Our Packages
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Pick the package that fits your car. Nothing is added later — the price you see is what you pay.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                {packages.map((pkg) => {
                  const isDetailing = pkg.name.toLowerCase().includes('detail');
                  const icon = pkg.name.toLowerCase().includes('bucket') ? '🪣' : isDetailing ? '✨' : '🚿';

                  return (
                    <div
                      key={pkg.id}
                      className={`relative flex flex-col rounded-2xl p-6 transition-all ${
                        isDetailing
                          ? 'border-2 border-amber-400 bg-gradient-to-b from-amber-50/60 to-white shadow-xl shadow-amber-100'
                          : 'border border-slate-200 bg-white shadow-sm hover:shadow-md hover:border-slate-300'
                      }`}
                    >
                      {isDetailing && (
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#f59e0b] px-3.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#071739] shadow-md">
                            ⭐ Most Popular
                          </span>
                        </div>
                      )}

                      {/* Icon & name */}
                      <div className="flex items-center justify-between">
                        <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-base ${isDetailing ? 'bg-amber-100' : 'bg-blue-50'}`}>
                          {icon}
                        </span>
                        {!isDetailing && (
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {pkg.washesPerMonth}× / mo
                          </span>
                        )}
                      </div>
                      <h3 className="mt-3 text-sm font-bold text-slate-900">{pkg.name}</h3>

                      {/* Price */}
                      <div className="mt-4 pb-4 border-b border-slate-100">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold tracking-tight text-slate-900">
                            {money(pkg.price)}
                          </span>
                          <span className="text-xs font-bold text-slate-400">/ month</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500 font-semibold">
                          {pkg.washesPerMonth} washes · {money(Math.round(pkg.price / Math.max(1, pkg.washesPerMonth)))} each
                        </p>
                      </div>

                      {/* Services */}
                      <ul className="mt-4 space-y-2.5 flex-1">
                        {pkg.services.map((service) => (
                          <li key={service} className="flex items-center gap-2.5">
                            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${isDetailing ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                              <IconCheck width={10} height={10} strokeWidth={3.5} />
                            </span>
                            <span className="text-[12px] font-semibold text-slate-600">{service}</span>
                          </li>
                        ))}
                      </ul>

                      {/* CTA */}
                      <a
                        href="#book"
                        className={`mt-6 block w-full rounded-xl py-3 text-center text-xs font-semibold transition-all ${
                          isDetailing
                            ? 'bg-[#f59e0b] text-[#071739] hover:bg-[#e08900] shadow-md shadow-amber-200'
                            : 'border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-400'
                        }`}
                      >
                        Choose {pkg.name}
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Service Areas */}
            <div>
              <div className="mb-6">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">
                  WHERE WE OPERATE
                </span>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Service Areas</h2>
                <p className="mt-1 text-sm text-slate-500">Currently serving these areas in Nagpur.</p>
              </div>

              {/* Area chips */}
              <div className="flex flex-col gap-3">
                {areasList.map((area, i) => (
                  <div
                    key={area.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:border-blue-300 hover:shadow transition-all"
                  >
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg text-white text-xs font-bold flex-shrink-0 ${
                      i === 0 ? 'bg-blue-600' : i === 1 ? 'bg-[#071739]' : 'bg-blue-800'
                    }`}>
                      {area.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{area.name}</p>
                      <p className="text-[10px] text-slate-500">{area.city}</p>
                    </div>
                    <span className="text-blue-600 text-sm">📍</span>
                  </div>
                ))}
              </div>

              {/* Expand card */}
              <div className="mt-5 rounded-2xl border border-slate-200 bg-[#f8fafc] p-5 shadow-sm overflow-hidden">
                <div className="relative aspect-[16/7] w-full overflow-hidden rounded-xl bg-blue-50 mb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/city-skyline.png" alt="Nagpur City" className="h-full w-full object-cover" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Don&apos;t see your area?</h3>
                <p className="text-xs text-slate-500 mt-0.5">We&apos;re expanding fast across Nagpur!</p>
                <a
                  href="#book"
                  className="mt-3.5 flex items-center justify-center gap-1.5 w-full rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-50 hover:border-slate-400 transition-colors shadow-sm"
                >
                  Request your area →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 4. WHY CHOOSE US (NEW SECTION)                                        */}
      {/* ===================================================================== */}
      <section id="why" className="scroll-mt-16 bg-[#071739] px-4 sm:px-6 lg:px-8 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <span className="inline-block rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-400">
              WHY CHOOSE CARZ
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-white">
              We do it better
            </h2>
            <p className="mt-2 text-sm text-slate-400 max-w-sm mx-auto">
              Every feature is built so you never have to worry about your car again.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                icon: '📷',
                title: 'Photo Proof',
                desc: 'Before & after photos sent for every single wash. No photos? The wash is free.',
                accent: 'bg-blue-600/15 text-blue-300',
              },
              {
                icon: '🗓️',
                title: 'Flexible Schedule',
                desc: 'Pick your days and time. We adjust around your parking and work hours.',
                accent: 'bg-amber-500/15 text-amber-300',
              },
              {
                icon: '🛡️',
                title: 'Verified Staff',
                desc: 'Background-checked, trained wash boys. The same person shows up every week.',
                accent: 'bg-green-600/15 text-green-300',
              },
              {
                icon: '💳',
                title: 'Easy Payment',
                desc: 'Pay monthly by UPI, cash, or card. No advance, no hidden charges.',
                accent: 'bg-purple-600/15 text-purple-300',
              },
            ].map(({ icon, title, desc, accent }) => (
              <div key={title} className="group rounded-2xl border border-white/8 bg-white/5 p-6 hover:bg-white/8 hover:border-white/15 transition-all">
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl text-2xl mb-4 ${accent}`}>
                  {icon}
                </div>
                <h3 className="text-base font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 5. MID-PAGE CALLOUT BANNER                                            */}
      {/* ===================================================================== */}
      <section className="relative overflow-hidden bg-gradient-to-r from-[#061122] via-[#0a1e48] to-[#071739] px-4 sm:px-6 lg:px-8 py-12 border-y border-white/8 text-white">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_50%,rgba(245,158,11,0.06),transparent_60%)]" />
        <div className="relative mx-auto max-w-7xl flex flex-col lg:flex-row items-center justify-between gap-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Ready for a cleaner car?
            </h2>
            <p className="mt-1.5 text-sm text-slate-300">
              Book now and get professional car wash delivered right to your parking spot.
            </p>
            {/* Trust pills */}
            <div className="mt-4 flex flex-wrap gap-2">
              {['📅 Flexible scheduling', '🛡️ Verified staff', '📷 Photo proof', '💳 Any payment'].map((item) => (
                <span key={item} className="inline-flex items-center rounded-full border border-white/12 bg-white/5 px-3 py-1 text-[11px] font-medium text-slate-300">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <a
            href="#book"
            className="flex-shrink-0 inline-flex items-center gap-2.5 rounded-2xl bg-[#f59e0b] hover:bg-[#e08900] px-8 py-4 text-sm font-semibold text-[#071739] shadow-2xl shadow-amber-500/25 hover:scale-[1.03] active:scale-[0.97] transition-all"
          >
            <span>Book a Wash Now</span>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
            </svg>
          </a>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 6. REVIEWS                                                            */}
      {/* ===================================================================== */}
      <section id="reviews" className="scroll-mt-16 bg-[#f4f7fb] px-4 sm:px-6 lg:px-8 py-20">
        <div className="mx-auto max-w-7xl">

          {/* Header row */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8 mb-10">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">
                REAL PEOPLE. REAL CARS.
              </span>
              <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
                What our customers say
              </h2>
              <p className="mt-2 text-sm text-slate-500 max-w-sm">
                Thousands of car owners trust us for a cleaner, hassle-free experience every week.
              </p>
            </div>

            {/* Rating card */}
            <div className="flex-shrink-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-md min-w-[260px]">
              <div className="flex items-end gap-3">
                <div className="text-5xl font-bold text-slate-900 leading-none">4.1</div>
                <div className="pb-1">
                  <div className="flex gap-0.5 text-amber-400">
                    {[1, 2, 3, 4].map((i) => (
                      <IconStar key={i} width={18} height={18} fill="currentColor" />
                    ))}
                    <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <defs>
                        <linearGradient id="halfStar2">
                          <stop offset="50%" stopColor="#f59e0b" />
                          <stop offset="50%" stopColor="#e2e8f0" />
                        </linearGradient>
                      </defs>
                      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" fill="url(#halfStar2)" />
                    </svg>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-500">from 970 rated washes</p>
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="text-[11.5px] text-slate-500 italic leading-relaxed">
                  &ldquo;Consistent quality — that is what our customers say.&rdquo;
                </p>
              </div>
            </div>
          </div>

          {/* Testimonial cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { initials: 'SP', name: 'Shyam Patil', location: 'Wadi', time: '2 weeks ago', quote: '"Two cars, one bill, and I stopped phoning anyone to ask when the wash is. The photos settle everything."', color: 'bg-blue-600', border: 'border-l-blue-500' },
              { initials: 'KD', name: 'Kavita Deshmukh', location: 'Green Park', time: '1 month ago', quote: '"They missed a wash in the rain and it came back into my count automatically. I did not have to argue for it."', color: 'bg-purple-600', border: 'border-l-purple-500' },
              { initials: 'NB', name: 'Nitin Bhosale', location: 'Bajaj Nagar', time: '3 weeks ago', quote: '"Same boy every week, same time. My car is clean before I leave for work."', color: 'bg-emerald-600', border: 'border-l-emerald-500' },
            ].map(({ initials, name, location, time, quote, color, border }) => (
              <div key={name} className={`rounded-2xl border border-slate-200 border-l-4 bg-white p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between ${border}`}>
                <div>
                  {/* Big quote mark */}
                  <span className="text-5xl font-bold text-slate-100 leading-none select-none block -mb-2">&ldquo;</span>
                  {/* Stars */}
                  <div className="flex gap-0.5 text-amber-400 mt-1 mb-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <IconStar key={i} width={14} height={14} fill="currentColor" />
                    ))}
                  </div>
                  <blockquote className="text-sm leading-relaxed text-slate-700">
                    {quote}
                  </blockquote>
                </div>
                {/* Author */}
                <div className="mt-5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full ${color} text-xs font-semibold text-white flex-shrink-0`}>
                      {initials}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900">{name}</p>
                      <p className="text-[10px] font-medium text-slate-500">{location}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">{time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* 7. BOOKING FORM                                                       */}
      {/* ===================================================================== */}
      <section id="book" className="scroll-mt-16 bg-[#f4f7fb] px-4 sm:px-6 lg:px-8 py-20">
        <div className="mx-auto max-w-7xl">

          {/* Section heading */}
          <div className="text-center mb-10">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">
              GET STARTED TODAY
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">
              Book your doorstep car wash
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              No advance payment. We confirm available slots same day.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-6 items-start">

            {/* LEFT: Form Card */}
            <div className="rounded-3xl border border-slate-200 bg-white p-7 sm:p-9 shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <span className="inline-block rounded-full border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                  ✅ NO ADVANCE PAYMENT
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                Fill in your details
              </h3>
              <p className="mt-1.5 text-sm text-slate-500">
                Enter your details below — we will confirm available slots today.
              </p>

              <div className="mt-6">
                <EnquiryForm
                  areas={areasList.map((a) => ({ id: a.id, label: `${a.name}, ${a.city}` }))}
                  packages={packages.map((p) => ({
                    id: p.id,
                    label: `${p.name} — ${p.washesPerMonth} washes — ${money(p.price)}`,
                    washesPerMonth: p.washesPerMonth,
                    services: p.services,
                  }))}
                />
              </div>
            </div>

            {/* RIGHT: Car card + Service Areas */}
            <div className="flex flex-col gap-5">

              {/* Car visual card */}
              <div className="relative rounded-3xl overflow-hidden border border-slate-200 bg-[#0a1f4e] shadow-lg" style={{ minHeight: '360px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/hero-car-wash.jpg"
                  alt="A cleaner car"
                  className="absolute right-0 top-0 h-full w-3/5 object-cover object-left"
                />
                {/* Dark overlay gradient */}
                <div className="absolute inset-0" style={{
                  background: 'linear-gradient(to right, #0a1f4e 38%, rgba(10,31,78,0.88) 55%, rgba(10,31,78,0.50) 72%, transparent 100%)',
                }} />

                {/* Floating Before & After badge */}
                <div className="absolute top-4 right-4 flex items-center gap-2 rounded-xl border border-white/25 bg-white/95 px-3 py-2 text-[#071739] shadow-xl z-10 backdrop-blur-sm">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-white flex-shrink-0">
                    <IconCamera width={12} height={12} strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold leading-tight">Before &amp; After</p>
                    <p className="text-[9px] text-slate-500 leading-tight">photos every wash</p>
                  </div>
                </div>

                {/* Content */}
                <div className="relative z-10 p-7 flex flex-col justify-between h-full">
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-blue-300">WE COME TO YOU</span>
                    <h3 className="mt-2 text-2xl sm:text-3xl font-bold leading-tight text-white">
                      A cleaner car,<br />happier you
                    </h3>
                    <ul className="mt-6 space-y-3">
                      {[
                        { color: 'bg-green-500', label: 'Same-day callback' },
                        { color: 'bg-blue-500', label: 'Before & after photos' },
                        { color: 'bg-indigo-600', label: 'Trusted & verified staff' },
                        { color: 'bg-amber-500', label: 'Multiple payment options' },
                      ].map(({ color, label }) => (
                        <li key={label} className="flex items-center gap-3 text-sm font-semibold text-white">
                          <span className={`flex h-5 w-5 items-center justify-center rounded-full ${color} flex-shrink-0 shadow-sm`}>
                            <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </span>
                          {label}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Service Areas card */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-blue-600 text-base">📍</span>
                  <h3 className="text-sm font-bold text-slate-900">Service Areas</h3>
                </div>

                <div className="flex flex-col gap-2.5 mb-5">
                  {areasList.map((area, i) => (
                    <div key={area.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${i === 0 ? 'bg-blue-500' : i === 1 ? 'bg-purple-500' : 'bg-emerald-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{area.name}</p>
                        <p className="text-[10px] text-slate-500">{area.city}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Map + don't see your area */}
                <div className="flex flex-col gap-3">
                  <div className="rounded-2xl overflow-hidden border border-slate-200 bg-[#e8f0f8] aspect-[2/1]">
                    <svg viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                      <rect width="200" height="120" fill="#e8f0f8" />
                      <line x1="0" y1="60" x2="200" y2="60" stroke="#c8d8e8" strokeWidth="4" />
                      <line x1="100" y1="0" x2="100" y2="120" stroke="#c8d8e8" strokeWidth="4" />
                      <line x1="0" y1="30" x2="200" y2="30" stroke="#d8e4ee" strokeWidth="2" />
                      <line x1="0" y1="90" x2="200" y2="90" stroke="#d8e4ee" strokeWidth="2" />
                      <line x1="50" y1="0" x2="50" y2="120" stroke="#d8e4ee" strokeWidth="2" />
                      <line x1="150" y1="0" x2="150" y2="120" stroke="#d8e4ee" strokeWidth="2" />
                      <rect x="10" y="10" width="30" height="15" fill="#d4e2ef" rx="2" />
                      <rect x="55" y="10" width="35" height="15" fill="#d4e2ef" rx="2" />
                      <rect x="155" y="10" width="30" height="15" fill="#d4e2ef" rx="2" />
                      <rect x="10" y="38" width="30" height="18" fill="#d4e2ef" rx="2" />
                      <rect x="155" y="38" width="30" height="18" fill="#d4e2ef" rx="2" />
                      <rect x="10" y="68" width="30" height="18" fill="#d4e2ef" rx="2" />
                      <rect x="55" y="68" width="35" height="18" fill="#d4e2ef" rx="2" />
                      <rect x="155" y="68" width="30" height="18" fill="#d4e2ef" rx="2" />
                      <circle cx="100" cy="55" r="12" fill="#2563eb" opacity="0.15" />
                      <circle cx="100" cy="55" r="7" fill="#2563eb" />
                      <circle cx="100" cy="55" r="3" fill="white" />
                      <text x="100" y="92" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#1e40af" fontFamily="sans-serif">Nagpur</text>
                    </svg>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex flex-row items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-slate-900">Don&apos;t see your area?</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">We&apos;re expanding fast!</p>
                    </div>
                    <a
                      href="#book"
                      className="flex-shrink-0 rounded-lg border border-slate-300 bg-white px-4 py-2 text-center text-[10px] font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                    >
                      Request area →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
