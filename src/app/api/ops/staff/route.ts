import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession } from '@/lib/auth/server';
import { hashPassword } from '@/lib/auth/password';
import { getStore } from '@/lib/data';
import { todayISO } from '@/lib/util/format';
import { assertInScope, opsError } from '../_guard';

function revalidateStaffPages() {
  try {
    for (const base of ['/admin', '/manager', '/area']) {
      revalidatePath(`${base}/users`);
      revalidatePath(`${base}/areas/[areaId]`, 'page');
      revalidatePath(`${base}/schedule`);
    }
  } catch {
    // ignore — running outside a request context
  }
}

const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    name: z.string().trim().min(2),
    phone: z.string().trim().min(6),
    email: z.string().trim().email(),
    password: z.string().min(6, 'Use at least 6 characters'),
    areaId: z.string().min(1),
    role: z.enum(['EMPLOYEE', 'MANAGER']).default('EMPLOYEE'),
    referredByStaffId: z.string().optional(),
    documentUrl: z.string().optional(),
    documentType: z.string().optional(),
    aadharNumber: z.string().trim().optional(),
    aadharCardUrl: z.string().optional(),
    panNumber: z.string().trim().optional(),
    panCardUrl: z.string().optional(),
    address: z.string().trim().optional(),
    emergencyPhone: z.string().trim().optional(),
    emergencyContactName: z.string().trim().optional(),
    bankName: z.string().trim().optional(),
    bankAccountNumber: z.string().trim().optional(),
    bankIfsc: z.string().trim().optional(),
    upiId: z.string().trim().optional(),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
  z.object({
    action: z.literal('setActive'),
    staffId: z.string().min(1),
    active: z.boolean(),
  }),
  z.object({
    action: z.literal('markAttendance'),
    staffId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: z.enum(['PRESENT', 'ABSENT', 'OFF', 'OFF_UNINFORMED']),
  }),
]);

import { uploadMedia } from '@/lib/storage';

export async function POST(request: Request) {
  try {
    const session = await requireApiSession('staff:create');
    const contentType = request.headers.get('content-type') || '';
    let raw: unknown = null;
    let formData: FormData | null = null;

    if (contentType.includes('multipart/form-data')) {
      formData = await request.formData();
      const dataStr = formData.get('data');
      if (typeof dataStr === 'string') {
        raw = JSON.parse(dataStr);
      }
    } else {
      raw = await request.json().catch(() => null);
    }

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Check the form.' },
        { status: 400 },
      );
    }
    const store = await getStore();

    async function handleUpload(file: unknown, docType: string) {
      if (!(file instanceof File)) return undefined;
      const MAX_BYTES = 10 * 1024 * 1024;
      if (file.size > MAX_BYTES) throw new HttpError(413, 'Document file must be under 10MB.');
      const ext = file.name.split('.').pop() || 'pdf';
      const key = `doc_${docType}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const stored = await uploadMedia(file, {
        key,
        folder: 'staff-docs',
        contentType: file.type || 'application/octet-stream',
        access: 'public',
      });
      return stored.url;
    }

    if (parsed.data.action === 'create') {
      const {
        name,
        phone,
        email,
        password,
        areaId,
        role,
        referredByStaffId,
        documentUrl,
        documentType,
        aadharNumber,
        aadharCardUrl,
        panNumber,
        panCardUrl,
        address,
        emergencyPhone,
        emergencyContactName,
        bankName,
        bankAccountNumber,
        bankIfsc,
        upiId,
        dob,
      } = parsed.data;
      assertInScope(session, areaId);

      if (role === 'MANAGER' && session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'AREA_ADMIN') {
        throw new HttpError(403, 'Only administrators can create area managers.');
      }

      const existing = await store.users.findOne({
        where: { email: email.toLowerCase() },
      });
      if (existing) {
        throw new HttpError(409, 'Someone already uses that email.');
      }

      let finalAadharUrl = aadharCardUrl;
      let finalPanUrl = panCardUrl;
      let finalOtherDocUrl = documentUrl;
      let finalDocType = documentType;

      if (formData) {
         const aadharUrl = await handleUpload(formData.get('aadharFile'), 'aadhar');
         if (aadharUrl) finalAadharUrl = aadharUrl;
         const panUrl = await handleUpload(formData.get('panFile'), 'pan');
         if (panUrl) finalPanUrl = panUrl;
         const otherUrl = await handleUpload(formData.get('otherDocFile'), 'other');
         if (otherUrl) {
           finalOtherDocUrl = otherUrl;
           finalDocType = 'other';
         } else if (aadharUrl) {
           finalDocType = 'aadhaar';
         } else if (panUrl) {
           finalDocType = 'pan';
         }
      }

      const staff = await store.staff.create({
        userId: '',
        name,
        phone,
        areaId,
        role,
        joinedOn: todayISO(),
        referredByStaffId: referredByStaffId || null,
        active: true,
        documentUrl: finalOtherDocUrl || finalAadharUrl || finalPanUrl || null,
        documentType: finalDocType || (finalAadharUrl ? 'aadhaar' : finalPanUrl ? 'pan' : null),
        aadharNumber: aadharNumber || null,
        aadharCardUrl: finalAadharUrl || null,
        panNumber: panNumber || null,
        panCardUrl: finalPanUrl || null,
        address: address || null,
        emergencyPhone: emergencyPhone || null,
        emergencyContactName: emergencyContactName || null,
        bankName: bankName || null,
        bankAccountNumber: bankAccountNumber || null,
        bankIfsc: bankIfsc || null,
        upiId: upiId || null,
        dob: dob || null,
      });

      const area = await store.areas.get(areaId);
      const user = await store.users.create({
        name,
        email: email.toLowerCase(),
        phone,
        role,
        regionId: area?.regionId ?? session.user.regionId ?? null,
        areaId,
        customerId: null,
        staffId: staff.id,
        language: role === 'EMPLOYEE' ? 'mr' : 'en',
        active: true,
        createdAt: new Date().toISOString(),
        aadharNumber: aadharNumber || null,
        aadharCardUrl: aadharCardUrl || null,
        panNumber: panNumber || null,
        panCardUrl: panCardUrl || null,
        address: address || null,
        emergencyPhone: emergencyPhone || null,
        emergencyContactName: emergencyContactName || null,
      });

      await store.staff.update(staff.id, { userId: user.id });
      if (role === 'MANAGER') {
        await store.areas.update(areaId, { managerId: staff.id });
      }

      await store.setCredential(user.id, await hashPassword(password));

      revalidateStaffPages();
      return NextResponse.json({
        ok: true,
        staff,
        user,
        message: role === 'MANAGER'
          ? `Manager ${name} created and assigned to ${area?.name ?? 'the area'}.`
          : (referredByStaffId
              ? 'Staff added. The referral bonus is queued for the referrer.'
              : 'Staff added. They can sign in with the email and password you set.'),
      });
    }

    if (parsed.data.action === 'setActive') {
      const staff = await store.staff.get(parsed.data.staffId);
      if (!staff) throw new HttpError(404, 'Staff member not found.');
      assertInScope(session, staff.areaId);

      await store.staff.update(staff.id, { active: parsed.data.active });
      // Deactivating the staff record must also close the login, or a
      // dismissed wash boy keeps a working app.
      await store.users.update(staff.userId, { active: parsed.data.active });

      if (!parsed.data.active) {
        await store.visits.updateMany(
          {
            staffId: staff.id,
            status: 'PENDING',
            scheduledDate: { gte: todayISO() },
          } as never,
          { staffId: null },
        );
        // Also clear any car's standing default assignment to this staff
        // member — otherwise the next auto-scheduled visit for that car
        // quietly re-assigns itself right back to him.
        await store.cars.updateMany(
          { assignedStaffId: staff.id } as never,
          { assignedStaffId: null },
        );
      }

      revalidateStaffPages();
      return NextResponse.json({
        ok: true,
        message: parsed.data.active
          ? 'Reactivated.'
          : 'Deactivated. Their upcoming cars are now unassigned.',
      });
    }

    const staff = await store.staff.get(parsed.data.staffId);
    if (!staff) throw new HttpError(404, 'Staff member not found.');
    assertInScope(session, staff.areaId);

    const existing = await store.attendance.findOne({
      where: { staffId: staff.id, date: parsed.data.date },
    });

    const attendance = existing
      ? await store.attendance.update(existing.id, { status: parsed.data.status })
      : await store.attendance.create({
          staffId: staff.id,
          date: parsed.data.date,
          loginAt: null,
          status: parsed.data.status,
          note: null,
        });

    revalidateStaffPages();
    return NextResponse.json({ ok: true, attendance, message: 'Attendance updated.' });
  } catch (error) {
    return opsError(error);
  }
}
