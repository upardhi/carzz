import type { Area, Id, Role, User } from '../data/types';

/**
 * Role hierarchy, highest authority first.
 *
 *   SUPER_ADMIN  — the owner. Everything, every region.
 *   AREA_ADMIN   — one region. Manages its managers and their employees.
 *   MANAGER      — one area. Manages that area's wash boys and customers.
 *   EMPLOYEE     — a wash boy. Own jobs, own earnings, nothing else.
 *   CUSTOMER     — own account, own cars, own payments.
 *
 * CUSTOMER sits outside the staff chain: it is not "below" EMPLOYEE, it is a
 * separate audience, so `outranks` never returns true across that boundary.
 */
export const STAFF_CHAIN: Role[] = [
  'SUPER_ADMIN',
  'AREA_ADMIN',
  'MANAGER',
  'EMPLOYEE',
];

export function rank(role: Role): number {
  const i = STAFF_CHAIN.indexOf(role);
  return i === -1 ? Number.POSITIVE_INFINITY : i;
}

export function isStaffRole(role: Role): boolean {
  return STAFF_CHAIN.includes(role);
}

/** True when `actor` sits strictly above `target` in the staff chain. */
export function outranks(actor: Role, target: Role): boolean {
  if (!isStaffRole(actor) || !isStaffRole(target)) return false;
  return rank(actor) < rank(target);
}

export function atLeast(actor: Role, minimum: Role): boolean {
  if (!isStaffRole(actor) || !isStaffRole(minimum)) return actor === minimum;
  return rank(actor) <= rank(minimum);
}

/* -------------------------------------------------------------------------- */
/* Permissions                                                                */
/* -------------------------------------------------------------------------- */

export const PERMISSIONS = [
  // Operations
  'visit:view',
  'visit:complete',        // close a wash with photos
  'visit:assign',          // (re)assign a wash boy to a visit
  'visit:reschedule',
  // Customers
  'customer:view',
  'customer:create',
  'customer:edit',
  'customer:setStatus',
  // Staff
  'staff:view',
  'staff:create',
  'staff:discipline',      // warnings, penalties
  'pocket:request',
  'pocket:approve',
  // Money
  'payment:record',
  'payment:view',
  'invoice:view',
  'expense:manage',
  'payout:view',
  'payout:approve',
  'accounting:view',
  // Catalogue & config
  'package:manage',
  'area:manage',
  'user:manage',
  'settings:manage',
  // Support
  'complaint:view',
  'complaint:resolve',
  'complaint:escalate',
  // Inventory
  'inventory:view',
  'inventory:issue',
  'purchase:request',
  'purchase:approve',
  // Reporting
  'report:area',
  'report:business',
  // Customer-facing
  'self:cars',
  'self:payments',
  'self:feedback',
  // Employee-facing
  'self:jobs',
  'self:earnings',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const CUSTOMER_PERMISSIONS: Permission[] = [
  'self:cars',
  'self:payments',
  'self:feedback',
];

const EMPLOYEE_PERMISSIONS: Permission[] = [
  'self:jobs',
  'self:earnings',
  'visit:view',
  'visit:complete',
  'pocket:request',
];

const MANAGER_PERMISSIONS: Permission[] = [
  ...EMPLOYEE_PERMISSIONS.filter((p) => !p.startsWith('self:')),
  'visit:assign',
  'visit:reschedule',
  'customer:view',
  'customer:create',
  'customer:edit',
  'customer:setStatus',
  'staff:view',
  'staff:create',
  'staff:discipline',
  'pocket:approve',
  'payment:record',
  'payment:view',
  'invoice:view',
  'payout:view',
  'complaint:view',
  'complaint:resolve',
  'complaint:escalate',
  'inventory:view',
  'inventory:issue',
  'purchase:request',
  'report:area',
];

const AREA_ADMIN_PERMISSIONS: Permission[] = [
  ...MANAGER_PERMISSIONS,
  'user:manage',
  'expense:manage',
  'accounting:view',
];

const ALL_PERMISSIONS: Permission[] = [...PERMISSIONS];

const MATRIX: Record<Role, Permission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  AREA_ADMIN: AREA_ADMIN_PERMISSIONS,
  MANAGER: MANAGER_PERMISSIONS,
  EMPLOYEE: EMPLOYEE_PERMISSIONS,
  CUSTOMER: CUSTOMER_PERMISSIONS,
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role].includes(permission);
}

export function permissionsFor(role: Role): Permission[] {
  return [...MATRIX[role]];
}

/* -------------------------------------------------------------------------- */
/* Data scoping                                                               */
/* -------------------------------------------------------------------------- */

/**
 * The slice of the business a session may read.
 *
 * `areaIds === null` means "every area" (Super Admin only). Every list query
 * runs through {@link scopeAreaFilter}, so an Area Admin physically cannot
 * fetch another region's rows — this is enforcement, not a UI setting someone
 * can forget to apply.
 */
export interface AccessScope {
  role: Role;
  userId: Id;
  regionId: Id | null;
  areaIds: Id[] | null;
  customerId: Id | null;
  staffId: Id | null;
}

export function buildScope(user: User, areas: Area[]): AccessScope {
  const base = {
    role: user.role,
    userId: user.id,
    regionId: user.regionId,
    customerId: user.customerId,
    staffId: user.staffId,
  };

  switch (user.role) {
    case 'SUPER_ADMIN':
      return { ...base, areaIds: null };
    case 'AREA_ADMIN':
      return {
        ...base,
        areaIds: areas
          .filter((a) => a.regionId === user.regionId)
          .map((a) => a.id),
      };
    case 'MANAGER':
    case 'EMPLOYEE':
    case 'CUSTOMER':
    default:
      return { ...base, areaIds: user.areaId ? [user.areaId] : [] };
  }
}

/**
 * Turns a scope into a filter clause for any repository whose rows carry an
 * `areaId`. Returns `{}` for an unrestricted scope so it can be spread
 * unconditionally into a `where`.
 */
export function scopeAreaFilter(
  scope: AccessScope,
): { areaId?: { in: Id[] } } {
  if (scope.areaIds === null) return {};
  return { areaId: { in: scope.areaIds } };
}

export function canSeeArea(scope: AccessScope, areaId: Id): boolean {
  return scope.areaIds === null || scope.areaIds.includes(areaId);
}

/** Landing route for a role, used after sign-in and by the route guard. */
export function homeFor(role: Role): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/admin';
    case 'AREA_ADMIN':
      return '/area';
    case 'MANAGER':
      return '/manager';
    case 'EMPLOYEE':
      return '/staff';
    case 'CUSTOMER':
    default:
      return '/app';
  }
}

/** Which role sections a path belongs to, for the middleware guard. */
export const ROUTE_ROLES: { prefix: string; roles: Role[] }[] = [
  { prefix: '/admin', roles: ['SUPER_ADMIN'] },
  { prefix: '/area', roles: ['SUPER_ADMIN', 'AREA_ADMIN'] },
  { prefix: '/manager', roles: ['SUPER_ADMIN', 'AREA_ADMIN', 'MANAGER'] },
  { prefix: '/staff', roles: ['EMPLOYEE'] },
  { prefix: '/app', roles: ['CUSTOMER'] },
];

export function rolesForPath(pathname: string): Role[] | null {
  const match = ROUTE_ROLES.find(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`),
  );
  return match ? match.roles : null;
}
