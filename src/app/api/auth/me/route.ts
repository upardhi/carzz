import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        phone: session.user.phone,
        role: session.user.role,
        customerId: session.user.customerId,
        staffId: session.user.staffId,
        areaId: session.user.areaId,
        language: session.user.language,
      },
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json(
      { ok: false, error: 'Could not fetch session' },
      { status: 500 },
    );
  }
}
