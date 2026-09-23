import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Adds a before/after pair to the public gallery.
 *
 * These images become publicly visible, unlike wash photos, which are only
 * ever served to a signed-in account. That is a deliberate line: the owner
 * has to upload a picture here on purpose, rather than a customer's wash
 * photo leaking onto the internet because a flag was flipped somewhere.
 */
export async function POST(request: Request) {
  try {
    const session = await requireApiSession('settings:manage');
    const form = await request.formData();

    const before = form.get('before');
    const after = form.get('after');
    const caption = String(form.get('caption') ?? '').trim();
    const detail = String(form.get('detail') ?? '').trim();

    if (!(before instanceof File) || !(after instanceof File)) {
      throw new HttpError(400, 'Please choose both a before and an after photo.');
    }
    for (const file of [before, after]) {
      if (file.size > MAX_BYTES) {
        throw new HttpError(413, 'That image is too large — keep each under 8MB.');
      }
      if (!ALLOWED.includes(file.type)) {
        throw new HttpError(415, 'Only JPEG, PNG or WebP images can be used.');
      }
    }

    const store = await getStore();
    const id = `gal_${Date.now().toString(36)}`;

    const token =
      process.env.BLOB_READ_WRITE_TOKEN ||
      process.env.PRIVATE_BLOB_READ_WRITE_TOKEN;

    const beforeStored = await put(`gallery/public-${id}-before`, await before.arrayBuffer(), {
      access: 'public',
      contentType: before.type || 'image/jpeg',
      token,
      addRandomSuffix: false,
    });

    const afterStored = await put(`gallery/public-${id}-after`, await after.arrayBuffer(), {
      access: 'public',
      contentType: after.type || 'image/jpeg',
      token,
      addRandomSuffix: false,
    });

    const content = await store.getSiteContent();
    const saved = await store.saveSiteContent({
      gallery: [
        ...content.gallery,
        {
          id,
          beforeUrl: beforeStored.url || `/api/gallery/public-${id}-before`,
          afterUrl: afterStored.url || `/api/gallery/public-${id}-after`,
          caption,
          detail,
          visible: true,
          order: content.gallery.length,
        },
      ],
      updatedByUserId: session.user.id,
    });

    revalidatePath('/', 'layout');
    return NextResponse.json({
      ok: true,
      gallery: saved.gallery,
      message: 'Added to the gallery.',
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'Could not add those images.' },
      { status: 500 },
    );
  }
}

