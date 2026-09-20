import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HttpError, requireApiSession, type Session } from '@/lib/auth/server';
import { hashPassword } from '@/lib/auth/password';
import { ROLES, type Role } from '@/lib/data/types';
import { getStore } from '@/lib/data';
import { todayISO } from '@/lib/util/format';
import { uploadMedia } from '@/lib/storage';

/**
 * `user:manage`/`staff:create` say an Area Admin may reach this endpoint at
 * all — they say nothing about which region or which role. Without this, an
 * Area Admin (scoped to one region) could plant a Manager in someone else's
 * area, or worse, hand out an Area Admin or Super Admin account: the
 * permission check alone can't see the payload's role or area.
 *
 * Only a Super Admin may create, promote to, or edit a Super Admin or Area
 * Admin account. Anyone else acting on a Manager/Employee account must
 * outrank that role and the account's area must be inside their own scope.
 */
function assertCanActOnRole(session: Session, role: Role): void {
  if (role === 'SUPER_ADMIN' || role === 'AREA_ADMIN') {
    if (session.user.role !== 'SUPER_ADMIN') {
      throw new HttpError(403, 'Only the owner can create or edit that role.');
    }
    return;
  }
  const rank: Record<Role, number> = {
    SUPER_ADMIN: 0,
    AREA_ADMIN: 1,
    MANAGER: 2,
    EMPLOYEE: 3,
    CUSTOMER: 4,
  };
  if (rank[session.user.role] >= rank[role]) {
    throw new HttpError(403, 'You do not have permission to manage that role.');
  }
}

function assertAreaInScope(session: Session, areaId: string | null | undefined): void {
  if (!areaId) return;
  if (session.scope.areaIds === null) return;
  if (!session.scope.areaIds.includes(areaId)) {
    throw new HttpError(403, 'That area is outside the areas you manage.');
  }
}

function revalidateUserPages() {
  try {
    revalidatePath('/admin/users');
    revalidatePath('/admin/areas');
    revalidatePath('/admin/regions');
    for (const base of ['/admin', '/manager', '/area']) {
      revalidatePath(`${base}/staff`);
      revalidatePath(`${base}/schedule`);
      revalidatePath(`${base}/areas/[areaId]`, 'page');
    }
    revalidatePath('/area/managers');
  } catch {
    // ignore — running outside a request context
  }
}

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  role: z.enum(['ALL', ...ROLES]).default('ALL'),
  status: z.enum(['ALL', 'ACTIVE', 'DISABLED']).default('ALL'),
  search: z.string().default(''),
  sortBy: z.enum(['name', 'createdAt', 'role', 'email']).default('name'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
});

export async function GET(request: Request) {
  try {
    const session = await requireApiSession('user:manage');
    const url = new URL(request.url);

    const parseResult = querySchema.safeParse({
      page: url.searchParams.get('page') ?? undefined,
      pageSize: url.searchParams.get('pageSize') ?? undefined,
      role: url.searchParams.get('role') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
      search: url.searchParams.get('search') ?? undefined,
      sortBy: url.searchParams.get('sortBy') ?? undefined,
      sortDir: url.searchParams.get('sortDir') ?? undefined,
    });

    if (!parseResult.success) {
      return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 });
    }

    const { page, pageSize, role, status, search, sortBy, sortDir } = parseResult.data;
    const store = await getStore();

    // Base query for staff
    const queryWhere: Record<string, unknown> = {};

    if (role === 'ALL') {
      queryWhere.role = { ne: 'CUSTOMER' };
    } else {
      queryWhere.role = role;
    }

    if (status === 'ACTIVE') {
      queryWhere.active = true;
    } else if (status === 'DISABLED') {
      queryWhere.active = false;
    }

    const trimmedSearch = search.trim();
    if (trimmedSearch) {
      if (trimmedSearch.includes('@')) {
        queryWhere.email = { contains: trimmedSearch };
      } else if (/^\+?\d+$/.test(trimmedSearch)) {
        queryWhere.phone = { contains: trimmedSearch };
      } else {
        queryWhere.name = { contains: trimmedSearch };
      }
    }

    const offset = (page - 1) * pageSize;

    const [
      paginatedUsers,
      totalMatching,
      countSuperAdmin,
      countAreaAdmin,
      countManager,
      countEmployee,
      countCustomer,
      countAllStaff,
      countActiveStaff,
      countDisabledStaff,
      areas,
      regions,
    ] = await Promise.all([
      store.users.find({
        where: queryWhere as never,
        orderBy: [{ field: sortBy, dir: sortDir }],
        limit: pageSize,
        offset,
      }),
      store.users.count(queryWhere as never),
      store.users.count({ role: 'SUPER_ADMIN' }),
      store.users.count({ role: 'AREA_ADMIN' }),
      store.users.count({ role: 'MANAGER' }),
      store.users.count({ role: 'EMPLOYEE' }),
      store.users.count({ role: 'CUSTOMER' }),
      store.users.count({ role: { ne: 'CUSTOMER' } as never }),
      store.users.count({ role: { ne: 'CUSTOMER' } as never, active: true }),
      store.users.count({ role: { ne: 'CUSTOMER' } as never, active: false }),
      store.areas.find({ orderBy: [{ field: 'name' }] }),
      store.regions.find({ orderBy: [{ field: 'name' }] }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalMatching / pageSize));

    return NextResponse.json({
      ok: true,
      users: paginatedUsers,
      areas,
      regions,
      currentUserId: session.user.id,
      pagination: {
        page,
        pageSize,
        totalItems: totalMatching,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      kpiCounts: {
        SUPER_ADMIN: countSuperAdmin,
        AREA_ADMIN: countAreaAdmin,
        MANAGER: countManager,
        EMPLOYEE: countEmployee,
        CUSTOMER: countCustomer,
      },
      statusCounts: {
        all: countAllStaff,
        active: countActiveStaff,
        disabled: countDisabledStaff,
      },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Could not load users' }, { status: 500 });
  }
}


const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    name: z.string().trim().min(2),
    email: z.string().trim().email(),
    phone: z.string().trim().min(6),
    password: z.string().min(6, 'Use at least 6 characters'),
    role: z.enum(ROLES),
    regionId: z.string().nullable().optional(),
    areaId: z.string().nullable().optional(),
    aadharNumber: z.string().trim().nullable().optional(),
    aadharCardUrl: z.string().nullable().optional(),
    panNumber: z.string().trim().nullable().optional(),
    panCardUrl: z.string().nullable().optional(),
    address: z.string().trim().nullable().optional(),
    emergencyPhone: z.string().trim().nullable().optional(),
    emergencyContactName: z.string().trim().nullable().optional(),
    dob: z.string().trim().nullable().optional(),
    bankName: z.string().trim().nullable().optional(),
    accountNumber: z.string().trim().nullable().optional(),
    bankAccountNumber: z.string().trim().nullable().optional(),
    ifscCode: z.string().trim().nullable().optional(),
    bankIfsc: z.string().trim().nullable().optional(),
    upiId: z.string().trim().nullable().optional(),
  }),
  z.object({
    action: z.literal('setActive'),
    userId: z.string().min(1),
    active: z.boolean(),
  }),
  z.object({
    action: z.literal('update'),
    userId: z.string().min(1),
    name: z.string().trim().min(2).optional(),
    email: z.string().trim().email().optional(),
    phone: z.string().trim().min(6).optional(),
    role: z.enum(ROLES).optional(),
    regionId: z.string().nullable().optional(),
    areaId: z.string().nullable().optional(),
    password: z.string().min(6).nullable().optional(),
    aadharNumber: z.string().trim().nullable().optional(),
    aadharCardUrl: z.string().nullable().optional(),
    panNumber: z.string().trim().nullable().optional(),
    panCardUrl: z.string().nullable().optional(),
    address: z.string().trim().nullable().optional(),
    emergencyPhone: z.string().trim().nullable().optional(),
    emergencyContactName: z.string().trim().nullable().optional(),
    dob: z.string().trim().nullable().optional(),
    bankName: z.string().trim().nullable().optional(),
    accountNumber: z.string().trim().nullable().optional(),
    ifscCode: z.string().trim().nullable().optional(),
    upiId: z.string().trim().nullable().optional(),
  }),
]);

/** The owner owns the org chart: who exists, and what they can reach. */
export async function POST(request: Request) {
  try {
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

    const session = await requireApiSession(
      parsed.data.action === 'create' && (parsed.data.role === 'EMPLOYEE' || parsed.data.role === 'MANAGER')
        ? 'staff:create'
        : 'user:manage'
    );
    const store = await getStore();

    const ALLOWED_DOC_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

    async function handleUpload(file: unknown, docType: string) {
      if (!(file instanceof File)) return undefined;
      const MAX_BYTES = 10 * 1024 * 1024;
      if (file.size > MAX_BYTES) throw new HttpError(413, 'Document file must be under 10MB.');
      if (!ALLOWED_DOC_TYPES.includes(file.type)) {
        throw new HttpError(415, 'Only PDF, PNG, JPG, or WebP files can be uploaded.');
      }
      const ext = file.name.split('.').pop() || 'pdf';
      const key = `doc_${docType}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const stored = await uploadMedia(file, {
        key,
        folder: 'staff-docs',
        contentType: file.type || 'application/octet-stream',
        // Aadhaar/PAN scans are government ID — stored private, viewable only
        // through the authenticated doc-preview proxy (getSafeDocumentUrl).
        access: 'private',
      });
      return stored.url;
    }

    if (parsed.data.action === 'setActive') {
      if (parsed.data.userId === session.user.id && !parsed.data.active) {
        throw new HttpError(400, 'You cannot deactivate your own account.');
      }
      const user = await store.users.get(parsed.data.userId);
      if (!user) throw new HttpError(404, 'User not found.');
      assertCanActOnRole(session, user.role);
      assertAreaInScope(session, user.areaId);

      await store.users.update(user.id, { active: parsed.data.active });
      // Keep the staff record in step, or a deactivated manager still shows as
      // running an area.
      if (user.staffId) {
        await store.staff.update(user.staffId, { active: parsed.data.active });
      }

      // A dismissed wash boy must not keep collecting work: clear him off any
      // upcoming pending visit, and off any car's standing default assignment
      // — otherwise the next auto-scheduled visit for that car quietly
      // re-assigns itself right back to someone who can no longer log in.
      if (!parsed.data.active && user.staffId) {
        await store.visits.updateMany(
          {
            staffId: user.staffId,
            status: 'PENDING',
            scheduledDate: { gte: todayISO() },
          } as never,
          { staffId: null },
        );
        await store.cars.updateMany(
          { assignedStaffId: user.staffId } as never,
          { assignedStaffId: null },
        );
      }

      revalidateUserPages();
      return NextResponse.json({
        ok: true,
        message: parsed.data.active
          ? 'Reactivated.'
          : 'Deactivated — their login no longer works. Their upcoming cars are now unassigned.',
      });
    }

    if (parsed.data.action === 'update') {
      const data = parsed.data;
      const user = await store.users.get(data.userId);
      if (!user) throw new HttpError(404, 'User not found.');
      // Both the account's current role/area and whatever it's being changed
      // to must be within what this caller is allowed to touch — otherwise an
      // Area Admin could "update" their way around the create-time checks.
      assertCanActOnRole(session, user.role);
      assertAreaInScope(session, user.areaId);
      if (data.role) assertCanActOnRole(session, data.role);
      if (data.areaId !== undefined) assertAreaInScope(session, data.areaId);

      if (data.email && data.email.toLowerCase() !== user.email.toLowerCase()) {
        const existing = await store.users.findOne({
          where: { email: data.email.toLowerCase() },
        });
        if (existing && existing.id !== user.id) {
          throw new HttpError(409, 'Someone else is already using that email.');
        }
      }

      const nextRole = data.role ?? user.role;
      const nextRegionId = data.regionId !== undefined ? data.regionId : user.regionId;
      const nextAreaId = data.areaId !== undefined ? data.areaId : user.areaId;

      if (formData) {
         const aadharUrl = await handleUpload(formData.get('aadharFile'), 'aadhar');
         if (aadharUrl) data.aadharCardUrl = aadharUrl;
         const panUrl = await handleUpload(formData.get('panFile'), 'pan');
         if (panUrl) data.panCardUrl = panUrl;
      }

      const userUpdates: Partial<typeof user> = {};
      if (data.name) userUpdates.name = data.name;
      if (data.email) userUpdates.email = data.email.toLowerCase();
      if (data.phone) userUpdates.phone = data.phone;
      if (data.role) userUpdates.role = data.role;
      if (data.regionId !== undefined) userUpdates.regionId = nextRegionId;
      if (data.areaId !== undefined) userUpdates.areaId = nextAreaId;
      if (data.aadharNumber !== undefined) userUpdates.aadharNumber = data.aadharNumber || null;
      if (data.aadharCardUrl !== undefined) userUpdates.aadharCardUrl = data.aadharCardUrl || null;
      if (data.panNumber !== undefined) userUpdates.panNumber = data.panNumber || null;
      if (data.panCardUrl !== undefined) userUpdates.panCardUrl = data.panCardUrl || null;
      if (data.address !== undefined) userUpdates.address = data.address || null;
      if (data.emergencyPhone !== undefined) userUpdates.emergencyPhone = data.emergencyPhone || null;
      if (data.emergencyContactName !== undefined) userUpdates.emergencyContactName = data.emergencyContactName || null;
      if (data.dob !== undefined) userUpdates.dob = data.dob || null;
      if (data.bankName !== undefined) userUpdates.bankName = data.bankName || null;
      if (data.accountNumber !== undefined) userUpdates.accountNumber = data.accountNumber || null;
      if (data.ifscCode !== undefined) userUpdates.ifscCode = data.ifscCode || null;
      if (data.upiId !== undefined) userUpdates.upiId = data.upiId || null;

      await store.users.update(user.id, userUpdates);

      if (user.staffId) {
        const staffUpdates: Record<string, unknown> = {};
        if (data.name) staffUpdates.name = data.name;
        if (data.phone) staffUpdates.phone = data.phone;
        if (nextAreaId) staffUpdates.areaId = nextAreaId;
        if (nextRole === 'MANAGER' || nextRole === 'EMPLOYEE') {
          staffUpdates.role = nextRole;
        }
        if (data.aadharNumber !== undefined) staffUpdates.aadharNumber = data.aadharNumber || null;
        if (data.aadharCardUrl !== undefined) staffUpdates.aadharCardUrl = data.aadharCardUrl || null;
        if (data.panNumber !== undefined) staffUpdates.panNumber = data.panNumber || null;
        if (data.panCardUrl !== undefined) staffUpdates.panCardUrl = data.panCardUrl || null;
        if (data.address !== undefined) staffUpdates.address = data.address || null;
        if (data.emergencyPhone !== undefined) staffUpdates.emergencyPhone = data.emergencyPhone || null;
        if (data.emergencyContactName !== undefined) staffUpdates.emergencyContactName = data.emergencyContactName || null;
        if (data.dob !== undefined) staffUpdates.dob = data.dob || null;
        if (data.bankName !== undefined) staffUpdates.bankName = data.bankName || null;
        if (data.accountNumber !== undefined) staffUpdates.bankAccountNumber = data.accountNumber || null;
        if (data.ifscCode !== undefined) staffUpdates.bankIfsc = data.ifscCode || null;
        if (data.upiId !== undefined) staffUpdates.upiId = data.upiId || null;
        await store.staff.update(user.staffId, staffUpdates as never);
      }

      if (nextRole === 'MANAGER' && nextAreaId) {
        await store.areas.update(nextAreaId, { managerId: user.staffId || user.id });
      }

      if (nextRole === 'AREA_ADMIN' && nextRegionId) {
        // A region keeps a denormalized `areaAdminId` for display. Moving this
        // admin to a new region must clear it off any OTHER region still
        // pointing at them — otherwise that old region keeps showing an admin
        // who no longer runs it.
        await store.regions.updateMany(
          { areaAdminId: user.id, id: { ne: nextRegionId } } as never,
          { areaAdminId: null },
        );
        await store.regions.update(nextRegionId, { areaAdminId: user.id });
      }

      if (data.password) {
        await store.setCredential(user.id, await hashPassword(data.password));
      }

      const updatedUser = await store.users.get(user.id);
      revalidateUserPages();
      return NextResponse.json({
        ok: true,
        user: updatedUser,
        message: `${updatedUser?.name ?? 'User'} updated successfully.`,
      });
    }

    const data = parsed.data;
    assertCanActOnRole(session, data.role);
    assertAreaInScope(session, data.areaId);

    const existing = await store.users.findOne({
      where: { email: data.email.toLowerCase() },
    });
    if (existing) throw new HttpError(409, 'Someone already uses that email.');

    if (formData) {
       const aadharUrl = await handleUpload(formData.get('aadharFile'), 'aadhar');
       if (aadharUrl) data.aadharCardUrl = aadharUrl;
       const panUrl = await handleUpload(formData.get('panFile'), 'pan');
       if (panUrl) data.panCardUrl = panUrl;
    }

    if ((data.role === 'MANAGER' || data.role === 'EMPLOYEE') && !data.areaId) {
      throw new HttpError(400, 'A manager or wash boy must be given an area.');
    }
    if (data.role === 'AREA_ADMIN' && !data.regionId) {
      throw new HttpError(400, 'An area admin must be given a region.');
    }

    // Manager and employee logins are backed by a staff record, so they appear
    // in rosters, payouts and schedules like anyone else.
    let staffId: string | null = null;
    if (data.role === 'MANAGER' || data.role === 'EMPLOYEE') {
      const staff = await store.staff.create({
        userId: '',
        name: data.name,
        phone: data.phone,
        areaId: data.areaId!,
        role: data.role,
        joinedOn: todayISO(),
        referredByStaffId: null,
        active: true,
        aadharNumber: data.aadharNumber || null,
        aadharCardUrl: data.aadharCardUrl || null,
        panNumber: data.panNumber || null,
        panCardUrl: data.panCardUrl || null,
        address: data.address || null,
        emergencyPhone: data.emergencyPhone || null,
        emergencyContactName: data.emergencyContactName || null,
        dob: data.dob || null,
        bankName: data.bankName || null,
        bankAccountNumber: data.accountNumber || data.bankAccountNumber || null,
        bankIfsc: data.ifscCode || data.bankIfsc || null,
        upiId: data.upiId || null,
        documentUrl: data.aadharCardUrl || data.panCardUrl || null,
        documentType: data.aadharCardUrl ? 'aadhaar' : data.panCardUrl ? 'pan' : null,
      });
      staffId = staff.id;
    }

    const user = await store.users.create({
      name: data.name,
      email: data.email.toLowerCase(),
      phone: data.phone,
      role: data.role,
      regionId: data.regionId ?? null,
      areaId: data.areaId ?? null,
      customerId: null,
      staffId,
      language: data.role === 'EMPLOYEE' ? 'mr' : 'en',
      active: true,
      createdAt: new Date().toISOString(),
      aadharNumber: data.aadharNumber || null,
      aadharCardUrl: data.aadharCardUrl || null,
      panNumber: data.panNumber || null,
      panCardUrl: data.panCardUrl || null,
      address: data.address || null,
      emergencyPhone: data.emergencyPhone || null,
      emergencyContactName: data.emergencyContactName || null,
      dob: data.dob || null,
      bankName: data.bankName || null,
      accountNumber: data.accountNumber || data.bankAccountNumber || null,
      ifscCode: data.ifscCode || data.bankIfsc || null,
      upiId: data.upiId || null,
    });

    if (staffId) await store.staff.update(staffId, { userId: user.id });
    if (data.role === 'MANAGER' && data.areaId) {
      await store.areas.update(data.areaId, { managerId: staffId });
    }
    if (data.role === 'AREA_ADMIN' && data.regionId) {
      await store.regions.update(data.regionId, { areaAdminId: user.id });
    }

    await store.setCredential(user.id, await hashPassword(data.password));

    revalidateUserPages();
    return NextResponse.json({
      ok: true,
      user,
      message: `${user.name} can now sign in with ${user.email}.`,
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: 'Could not save that person.' },
      { status: 500 },
    );
  }
}
