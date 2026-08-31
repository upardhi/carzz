import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiSession, HttpError } from '@/lib/auth/server';
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
} from '@/lib/auth/session';
import { getStore } from '@/lib/data';

const schema = z.object({ language: z.enum(['en', 'hi', 'mr']) });

/** Most wash staff read Marathi or Hindi, so language is a first-class setting. */
export async function POST(request: Request) {
  try {
    const session = await requireApiSession();
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Unknown language' }, { status: 400 });
    }

    const store = await getStore();
    const user = await store.users.update(session.user.id, {
      language: parsed.data.language,
    });

    // Reissue the cookie so the claim stays in step with the stored user.
    const jar = await cookies();
    jar.set(
      SESSION_COOKIE,
      await signSession({ ...session.claims, language: user.language }),
      sessionCookieOptions,
    );

    return NextResponse.json({ ok: true, language: user.language });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'Could not change the language.' },
      { status: 500 },
    );
  }
}
