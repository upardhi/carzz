import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { getStore } from '@/lib/data';
import { EXPENSE_HEADS } from '@/lib/data/types';

const schema = z.object({
  head: z.enum(EXPENSE_HEADS),
  amount: z.number().int().positive(),
  cycle: z.string().regex(/^\d{4}-\d{2}$/),
  areaId: z.string().optional(),
  note: z.string().max(300).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireApiSession('expense:manage');
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Check the form.' },
        { status: 400 },
      );
    }

    const store = await getStore();
    await store.expenses.create({
      head: parsed.data.head,
      amount: parsed.data.amount,
      cycle: parsed.data.cycle,
      areaId: parsed.data.areaId || null,
      note: parsed.data.note ?? null,
      recordedByUserId: session.user.id,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true, message: 'Expense recorded.' });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'Could not record that expense.' },
      { status: 500 },
    );
  }
}
