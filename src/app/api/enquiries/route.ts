import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStore } from '@/lib/data';

const schema = z.object({
  name: z.string().trim().min(2, 'Please tell us your name'),
  phone: z.string().trim().min(8, 'Please give a number we can call'),
  email: z.string().trim().email().optional().or(z.literal('')),
  areaId: z.string().optional(),
  locality: z.string().trim().max(200).optional(),
  carCount: z.number().int().min(1).max(20).default(1),
  packageId: z.string().optional(),
  message: z.string().trim().max(1000).optional(),
});

/**
 * A booking enquiry from the public website.
 *
 * This is the one endpoint anybody on the internet can reach, so it takes
 * nothing on trust: the status is fixed at NEW here rather than accepted from
 * the caller, and the area and package are checked against real records so a
 * crafted payload cannot plant an enquiry pointing at something that does not
 * exist.
 */
export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Please check the form.' },
        { status: 400 },
      );
    }

    const store = await getStore();
    const site = await store.getSiteContent();
    if (!site.published) {
      return NextResponse.json(
        { error: 'Bookings are closed at the moment. Please call us instead.' },
        { status: 503 },
      );
    }

    const data = parsed.data;
    const area = data.areaId ? await store.areas.get(data.areaId) : null;
    const servicePackage = data.packageId
      ? await store.packages.get(data.packageId)
      : null;

    const enquiry = await store.enquiries.create({
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      areaId: area?.id ?? null,
      locality: data.locality || null,
      carCount: data.carCount,
      packageId: servicePackage?.id ?? null,
      message: data.message || null,
      status: 'NEW',
      convertedCustomerId: null,
      handledByUserId: null,
      createdAt: new Date().toISOString(),
      handledAt: null,
    });

    return NextResponse.json({
      ok: true,
      enquiryId: enquiry.id,
      message: `Thank you, ${data.name.split(' ')[0]}. We will call you on ${data.phone} today with the slots free in your area.`,
    });
  } catch {
    return NextResponse.json(
      { error: 'Could not send that just now. Please try again, or call us.' },
      { status: 500 },
    );
  }
}
