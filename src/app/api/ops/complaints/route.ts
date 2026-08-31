import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { assertInScope, opsError } from '../_guard';

const schema = z.object({
  complaintId: z.string().min(1),
  action: z.enum(['resolve', 'escalate']),
  resolution: z.string().max(500).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireApiSession('complaint:view');
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const store = await getStore();
    const complaint = await store.complaints.get(parsed.data.complaintId);
    if (!complaint) throw new HttpError(404, 'Complaint not found.');
    assertInScope(session, complaint.areaId);

    if (parsed.data.action === 'escalate') {
      const updated = await store.complaints.update(complaint.id, {
        status: 'ESCALATED',
      });
      return NextResponse.json({
        ok: true,
        complaint: updated,
        message: 'Escalated to the owner.',
      });
    }

    if (!parsed.data.resolution?.trim()) {
      throw new HttpError(400, 'Say what you did before closing this.');
    }

    const updated = await store.complaints.update(complaint.id, {
      status: 'RESOLVED',
      resolution: parsed.data.resolution.trim(),
      resolvedAt: new Date().toISOString(),
      handledByUserId: session.user.id,
    });

    return NextResponse.json({
      ok: true,
      complaint: updated,
      message: 'Closed and the customer has been told.',
    });
  } catch (error) {
    return opsError(error);
  }
}
