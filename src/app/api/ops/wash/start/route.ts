import { NextResponse } from 'next/server';
import { getStore } from '@/lib/data';
import { notifyWashStarted, notifyWashCompleted } from '@/lib/services/whatsappNotifications';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const visitId = body.visitId || 'cmuny6wx10006dguf2ceghpt1';
    const action = body.action || 'start';

    const store = await getStore();
    const visit = await store.visits.get(visitId);
    if (!visit) {
      return NextResponse.json({ error: `Visit ${visitId} not found` }, { status: 404 });
    }

    if (action === 'start') {
      const startedAt = visit.startedAt || new Date().toISOString();
      const updated = await store.visits.update(visit.id, {
        status: 'IN_PROGRESS',
        startedAt,
        beforePhotoUrl: visit.beforePhotoUrl || '/demo/wash-before.jpg',
      });

      await notifyWashStarted(store, updated.id);

      return NextResponse.json({
        ok: true,
        message: `Wash started for visit ${visitId}! WhatsApp notification sent.`,
        visit: updated,
      });
    }

    if (action === 'complete') {
      const completedAt = new Date().toISOString();
      const updated = await store.visits.update(visit.id, {
        status: 'DONE',
        completedAt,
        afterPhotoUrl: visit.afterPhotoUrl || '/demo/wash-after.jpg',
        servicesDone: ['Exterior Foam Wash', 'Interior Vacuum', 'Tyre Polish'],
      });

      await notifyWashCompleted(store, updated.id);

      return NextResponse.json({
        ok: true,
        message: `Wash completed for visit ${visitId}! WhatsApp notification sent.`,
        visit: updated,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const visitId = searchParams.get('visitId') || 'cmuny6wx10006dguf2ceghpt1';
  const action = searchParams.get('action') || 'start';

  return POST(
    new Request('http://localhost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visitId, action }),
    }),
  );
}
