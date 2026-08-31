import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';

const testimonial = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  area: z.string().trim(),
  quote: z.string().trim().min(1),
  rating: z.number().int().min(1).max(5),
  visible: z.boolean(),
  order: z.number().int().min(0),
});

const feature = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  body: z.string().trim().min(1),
  icon: z.string().trim().min(1),
  order: z.number().int().min(0),
});

/**
 * Every field is optional: the editor saves one section at a time, so a
 * manager fixing a phone number never has to resubmit the whole page.
 */
const galleryItem = z.object({
  id: z.string().min(1),
  beforeUrl: z.string().min(1),
  afterUrl: z.string().min(1),
  caption: z.string().trim().max(120),
  detail: z.string().trim().max(120),
  visible: z.boolean(),
  order: z.number().int().min(0),
});

const schema = z.object({
  galleryTitle: z.string().trim().max(120).optional(),
  galleryBody: z.string().trim().max(600).optional(),
  gallery: z.array(galleryItem).max(60).optional(),
  showRealReviews: z.boolean().optional(),
  minReviewStars: z.number().int().min(1).max(5).optional(),
  mapTitle: z.string().trim().max(120).optional(),
  mapEmbedUrl: z.string().trim().max(600).optional(),
  heroEyebrow: z.string().trim().max(60).optional(),
  heroTitle: z.string().trim().min(1).max(120).optional(),
  heroTitleAccent: z.string().trim().max(120).optional(),
  heroBody: z.string().trim().max(600).optional(),
  heroPrimaryCta: z.string().trim().min(1).max(40).optional(),
  heroSecondaryCta: z.string().trim().max(40).optional(),
  stats: z.array(z.object({ label: z.string().trim(), value: z.string().trim() })).max(4).optional(),

  howTitle: z.string().trim().max(120).optional(),
  howSteps: z.array(z.object({ title: z.string().trim(), body: z.string().trim() })).max(6).optional(),

  featuresTitle: z.string().trim().max(120).optional(),
  features: z.array(feature).max(8).optional(),

  packagesTitle: z.string().trim().max(120).optional(),
  packagesBody: z.string().trim().max(600).optional(),
  visiblePackageIds: z.array(z.string()).optional(),

  areasTitle: z.string().trim().max(120).optional(),
  areasBody: z.string().trim().max(600).optional(),

  testimonialsTitle: z.string().trim().max(120).optional(),
  testimonials: z.array(testimonial).max(20).optional(),

  contactTitle: z.string().trim().max(120).optional(),
  contactBody: z.string().trim().max(600).optional(),

  phone: z.string().trim().max(30).optional(),
  whatsapp: z.string().trim().max(30).optional(),
  email: z.string().trim().max(120).optional(),
  addressLine: z.string().trim().max(160).optional(),

  seoTitle: z.string().trim().max(70).optional(),
  seoDescription: z.string().trim().max(180).optional(),

  published: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireApiSession('settings:manage');
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Check the values.' },
        { status: 400 },
      );
    }

    const store = await getStore();

    // Advertising a package that does not exist, or one that has been
    // retired, would put a price on the site nobody can actually buy.
    if (parsed.data.visiblePackageIds?.length) {
      const active = await store.packages.find({ where: { active: true } });
      const activeIds = new Set(active.map((p) => p.id));
      const unknown = parsed.data.visiblePackageIds.filter((id) => !activeIds.has(id));
      if (unknown.length) {
        throw new HttpError(
          400,
          'One of those packages is retired or does not exist any more.',
        );
      }
    }

    const saved = await store.saveSiteContent({
      ...parsed.data,
      updatedByUserId: session.user.id,
    });

    // The public site is prerendered, so without this the owner would save a
    // change and keep seeing the old page. 'layout' because the SEO metadata
    // lives in the site layout, not just the page.
    revalidatePath('/', 'layout');

    return NextResponse.json({
      ok: true,
      content: saved,
      message: saved.published
        ? 'Saved. The website is updated.'
        : 'Saved. The website is currently hidden from visitors.',
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'Could not save the website content.' },
      { status: 500 },
    );
  }
}
