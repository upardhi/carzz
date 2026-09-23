import { NextResponse } from 'next/server';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { uploadMedia } from '@/lib/storage';

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
];

/**
 * Securely uploads a staff verification document (Aadhaar, Driving License, PAN, etc.)
 * Only authenticated Managers and Admins can upload.
 */
export async function POST(request: Request) {
  try {
    await requireApiSession('staff:create');

    const form = await request.formData();
    const docType = String(form.get('docType') ?? 'other').trim();
    const file = form.get('file');

    if (!(file instanceof File)) {
      throw new HttpError(400, 'No document file was attached.');
    }
    if (file.size > MAX_BYTES) {
      throw new HttpError(413, 'Document file must be under 10MB.');
    }
    if (!ALLOWED.includes(file.type)) {
      throw new HttpError(415, 'Only PDF, JPEG, PNG, or WebP files are supported.');
    }

    const ext = file.name.split('.').pop() || 'pdf';
    const key = `doc_${docType}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;

    const stored = await uploadMedia(file, {
      key,
      folder: 'staff-docs',
      contentType: file.type || 'application/octet-stream',
    });

    return NextResponse.json({
      ok: true,
      url: stored.url,
      key: stored.key,
      name: file.name,
      bytes: stored.bytes,
      docType,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'Could not upload that document.' },
      { status: 500 },
    );
  }
}
