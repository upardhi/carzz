#!/usr/bin/env node
/**
 * End-to-end smoke test.
 *
 *   npm run build && npm run smoke
 *
 * Starts the production server on a scratch port, runs four suites against it,
 * and reports what passed. Each suite gets a freshly started server, because
 * the default in-memory provider is seeded per process and the suites mutate
 * state — a wash closed by one suite is not available to the next.
 *
 * Pass --base=https://... to run the API and page suites against a deployed
 * environment instead (the server is then not started or stopped here).
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { setTimeout as sleep } from 'node:timers/promises';

// The server is started as `node <next>/bin/next start` rather than through
// `npm run start`. On Windows npm is `npm.cmd`, which `spawn` cannot execute
// without a shell — and a shell would then swallow the kill signal below,
// leaving the port held and every later suite talking to a stale server.
const nextBin = createRequire(import.meta.url).resolve('next/dist/bin/next');

const arg = (name, fallback) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback;

const externalBase = arg('base', null);
const PORT = Number(arg('port', 3311));
const BASE = externalBase ?? `http://localhost:${PORT}`;

const STAFF_LOGINS = [
  'rahul1', 'sunil2', 'ajay3', 'prakash4', 'ganesh5', 'vinod6', 'sagar7',
  'arun8', 'mahesh9', 'kiran10', 'amit11', 'rohit12', 'farhan13', 'nitin14',
];

/* -------------------------------------------------------------------------- */
/* Harness                                                                    */
/* -------------------------------------------------------------------------- */

let suiteName = '';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ suite: suiteName, name, ok, detail });
  process.stdout.write(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}\n`);
  return ok;
};

async function startServer() {
  if (externalBase) return null;
  const server = spawn(process.execPath, [nextBin, 'start', '--port', String(PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(PORT) },
  });
  for (let i = 0; i < 60; i += 1) {
    try {
      const r = await fetch(`${BASE}/login`);
      if (r.ok) return server;
    } catch {
      /* not listening yet */
    }
    await sleep(500);
  }
  server.kill('SIGKILL');
  throw new Error('server did not start');
}

async function stopServer(server) {
  if (!server) return;
  server.kill('SIGKILL');
  await sleep(400);
}

async function login(email, password) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return {
    ok: r.ok,
    status: r.status,
    body: await r.json().catch(() => ({})),
    cookie: r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; '),
  };
}

const post = async (path, body, cookie) => {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
  return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
};

const html = async (path, cookie) =>
  (await fetch(BASE + path, { headers: cookie ? { cookie } : {} })).text();

/** The first wash boy who still has an open car today. */
async function findStaffWithPendingWash() {
  for (const name of STAFF_LOGINS) {
    const { ok, cookie } = await login(`${name}@carzz.app`, 'staff123');
    if (!ok) continue;
    const body = await html('/staff', cookie);
    const visitId = body.match(/\/staff\/wash\/([A-Za-z0-9_-]+)/)?.[1];
    if (visitId) return { email: `${name}@carzz.app`, cookie, visitId };
  }
  return null;
}

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function uploadPhoto(visitId, kind, cookie) {
  const form = new FormData();
  form.set('visitId', visitId);
  form.set('kind', kind);
  form.set('photo', new Blob([TINY_PNG], { type: 'image/png' }), `${kind}.png`);
  const r = await fetch(`${BASE}/api/staff/photo`, {
    method: 'POST',
    headers: { cookie },
    body: form,
  });
  return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) };
}

/* -------------------------------------------------------------------------- */
/* Suite 1 — every route, for every role                                      */
/* -------------------------------------------------------------------------- */

const ADMIN_ROUTES = ['/admin', '/admin/areas', '/admin/reports', '/admin/sources',
  '/admin/payout', '/admin/accounting', '/admin/packages', '/admin/inventory',
  '/admin/complaints', '/admin/users', '/admin/settings'];
const AREA_ROUTES = ['/area', '/area/schedule', '/area/customers', '/area/customers/new',
  '/area/staff', '/area/alerts', '/area/complaints', '/area/inventory', '/area/areas',
  '/area/managers', '/area/reports'];
const MANAGER_ROUTES = ['/manager', '/manager/schedule', '/manager/customers',
  '/manager/customers/new', '/manager/staff', '/manager/alerts', '/manager/complaints',
  '/manager/inventory'];
const STAFF_ROUTES = ['/staff', '/staff/earnings', '/staff/pocket', '/staff/profile'];
const CUSTOMER_ROUTES = ['/app', '/app/cars', '/app/payments', '/app/help'];

async function suiteAccess() {
  suiteName = 'access';
  const cookies = {
    owner: (await login('owner@carzz.app', 'owner123')).cookie,
    areaAdmin: (await login('areaadmin@carzz.app', 'area123')).cookie,
    manager: (await login('manager.wadi@carzz.app', 'manager123')).cookie,
    staff: (await login('rahul1@carzz.app', 'staff123')).cookie,
    customer: (await login('customer@carzz.app', 'customer123')).cookie,
  };

  const matrix = {
    owner: { allow: [...ADMIN_ROUTES, ...AREA_ROUTES, ...MANAGER_ROUTES], deny: [...STAFF_ROUTES, ...CUSTOMER_ROUTES] },
    areaAdmin: { allow: [...AREA_ROUTES, ...MANAGER_ROUTES], deny: [...ADMIN_ROUTES, ...STAFF_ROUTES, ...CUSTOMER_ROUTES] },
    manager: { allow: [...MANAGER_ROUTES], deny: [...ADMIN_ROUTES, ...AREA_ROUTES, ...STAFF_ROUTES, ...CUSTOMER_ROUTES] },
    staff: { allow: [...STAFF_ROUTES], deny: [...ADMIN_ROUTES, ...AREA_ROUTES, ...MANAGER_ROUTES, ...CUSTOMER_ROUTES] },
    customer: { allow: [...CUSTOMER_ROUTES], deny: [...ADMIN_ROUTES, ...AREA_ROUTES, ...MANAGER_ROUTES, ...STAFF_ROUTES] },
  };

  let allowed = 0; let denied = 0; const problems = [];
  for (const [role, cookie] of Object.entries(cookies)) {
    for (const path of matrix[role].allow) {
      const r = await fetch(BASE + path, { headers: { cookie }, redirect: 'manual' });
      if (r.status === 200) allowed += 1;
      else problems.push(`${role} blocked from ${path} (${r.status})`);
    }
    for (const path of matrix[role].deny) {
      const r = await fetch(BASE + path, { headers: { cookie }, redirect: 'manual' });
      if (r.status === 307 || r.status === 308) denied += 1;
      else problems.push(`${role} reached ${path} (${r.status})`);
    }
  }
  check(`every role reaches its own ${allowed} pages`, problems.length === 0, problems[0] ?? '');
  check(`every role is turned away from ${denied} pages it must not see`, problems.length === 0);

  let anon = 0;
  const everything = [...ADMIN_ROUTES, ...AREA_ROUTES, ...MANAGER_ROUTES, ...STAFF_ROUTES, ...CUSTOMER_ROUTES];
  for (const path of everything) {
    const r = await fetch(BASE + path, { redirect: 'manual' });
    if ((r.status === 307 || r.status === 308) && (r.headers.get('location') ?? '').includes('/login')) anon += 1;
  }
  check(`signed-out visitors are sent to login from all ${everything.length} pages`, anon === everything.length, `${anon}/${everything.length}`);
}

/* -------------------------------------------------------------------------- */
/* Suite 2 — sign-in                                                          */
/* -------------------------------------------------------------------------- */

async function suiteAuth() {
  suiteName = 'auth';
  const wrong = await login('owner@carzz.app', 'not-the-password');
  check('a wrong password is refused', wrong.status === 401);
  const unknown = await login('nobody@carzz.app', 'whatever');
  check('an unknown account gives the same answer, so accounts cannot be enumerated',
    unknown.status === 401 && unknown.body.error === wrong.body.error);
  check('a mobile number signs in as well as an email', (await login('9800000001', 'owner123')).ok);
  const anon = await post('/api/staff/wash', { action: 'complete', visitId: 'x', servicesDone: ['a'] });
  check('an unauthenticated write is refused', anon.status === 401);
}

/* -------------------------------------------------------------------------- */
/* Suite 3 — the wash, which is the heart of the product                      */
/* -------------------------------------------------------------------------- */

async function suiteWash() {
  suiteName = 'wash';
  const found = await findStaffWithPendingWash();
  if (!check('a wash boy has an open car today', Boolean(found), found?.email ?? '')) return;
  const { cookie, visitId } = found;

  check('opening the app records attendance', (await post('/api/staff/attendance', {}, cookie)).ok);
  check('opening it again does not double-count', (await post('/api/staff/attendance', {}, cookie)).ok);

  const noPhotos = await post('/api/staff/wash', { action: 'complete', visitId, servicesDone: ['Exterior wash'] }, cookie);
  check('a wash cannot be closed with no photos', noPhotos.status === 400, noPhotos.body.error);

  check('the before photo uploads', (await uploadPhoto(visitId, 'before', cookie)).ok);
  const onlyBefore = await post('/api/staff/wash', { action: 'complete', visitId, servicesDone: ['Exterior wash'] }, cookie);
  check('one photo is still not enough', onlyBefore.status === 400);

  check('the after photo uploads', (await uploadPhoto(visitId, 'after', cookie)).ok);
  const noWork = await post('/api/staff/wash', { action: 'complete', visitId, servicesDone: [] }, cookie);
  check('the work done must be ticked', noWork.status === 400);

  const closed = await post('/api/staff/wash', { action: 'complete', visitId, servicesDone: ['Exterior wash'] }, cookie);
  check('with both photos the wash closes', closed.ok, closed.body.message);

  // Deliberately a different boy from the one the wash belongs to.
  const otherName = STAFF_LOGINS.find((n) => `${n}@carzz.app` !== found.email);
  const other = (await login(`${otherName}@carzz.app`, 'staff123')).cookie;
  const foreign = await post('/api/staff/wash', { action: 'complete', visitId, servicesDone: ['Exterior wash'] }, other);
  check('a wash boy cannot touch another boy’s car', foreign.status === 403, `as ${otherName}`);

  const customer = (await login('customer@carzz.app', 'customer123')).cookie;
  const asCustomer = await post('/api/staff/wash', { action: 'complete', visitId, servicesDone: ['Exterior wash'] }, customer);
  check('a customer cannot close a wash', asCustomer.status === 403);

  const photo = await fetch(`${BASE}/api/photos/${visitId}-before`);
  check('wash photos are not readable without signing in', photo.status === 401);

  // The make-good, on a different car.
  const next = await findStaffWithPendingWash();
  if (next) {
    const noReason = await post('/api/staff/wash', { action: 'miss', visitId: next.visitId }, next.cookie);
    check('a missed wash needs a reason', noReason.status === 400);
    const missed = await post('/api/staff/wash',
      { action: 'miss', visitId: next.visitId, reason: 'CAR_NOT_AVAILABLE' }, next.cookie);
    check('a missed wash is recorded', missed.ok, missed.body.message);
    check('and the make-good visit is generated', Boolean(missed.body.replacement?.id), missed.body.replacement?.scheduledDate);
    check('the make-good stays in the same billing cycle', missed.body.replacement?.cycle === missed.body.visit?.cycle);
    check('the two are linked together', missed.body.visit?.rescheduledToVisitId === missed.body.replacement?.id);
  } else {
    check('a second open car for the missed-wash path', false, 'none left today');
  }
}

/* -------------------------------------------------------------------------- */
/* Suite 4 — money, people and stock                                          */
/* -------------------------------------------------------------------------- */

async function suiteOperations() {
  suiteName = 'operations';
  const owner = (await login('owner@carzz.app', 'owner123')).cookie;
  const manager = (await login('manager.wadi@carzz.app', 'manager123')).cookie;
  const customer = (await login('customer@carzz.app', 'customer123')).cookie;
  const cycle = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 7);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  /* Customer */
  const cash = await post('/api/customer/pay', { amount: 500, mode: 'CASH' }, customer);
  check('a declared cash payment waits for the manager to confirm it',
    cash.ok && cash.body.payment?.status === 'PENDING');
  const gateway = await post('/api/customer/pay', { amount: 100, mode: 'GATEWAY' }, customer);
  check('an online payment confirms immediately', gateway.ok && gateway.body.payment?.status === 'CONFIRMED');
  check('a negative payment is refused', (await post('/api/customer/pay', { amount: -5, mode: 'CASH' }, customer)).status === 400);
  const complaint = await post('/api/customer/complaints',
    { type: 'WASH_QUALITY', body: 'The dashboard was left dusty after the wash.' }, customer);
  check('a customer can raise a complaint', complaint.ok);
  check('an empty complaint is refused',
    (await post('/api/customer/complaints', { type: 'WASH_QUALITY', body: 'no' }, customer)).status === 400);

  /* Intake */
  const intake = {
    action: 'create', source: 'GUARD_REF', name: 'Smoke Test Customer', phone: '9800001234',
    address: 'Test Society, Flat 12', schedulePattern: 'MON_THU',
    advance: 2000, paymentMode: 'CASH',
    cars: [
      { model: 'Swift', make: 'Maruti', colour: 'White', plate: 'MH31 ZZ 1111', packageId: 'pkg_bucket', scheduleTime: '09:00' },
      { model: 'i20', make: 'Hyundai', colour: 'Red', plate: 'MH31 ZZ 2222', packageId: 'pkg_bucket', scheduleTime: '09:30' },
    ],
  };
  const created = await post('/api/ops/customers', { ...intake, areaId: 'ar_wadi' }, manager);
  check('a customer with two cars is created', created.ok, created.body.message);
  check('and the month’s wash visits are generated on save', /\d+ wash visits generated/.test(created.body.message ?? ''));

  const { source: _omitted, ...noSource } = intake;
  check('the lead source cannot be skipped',
    (await post('/api/ops/customers', { ...noSource, areaId: 'ar_wadi' }, manager)).status === 400);
  const outside = await post('/api/ops/customers', { ...intake, areaId: 'ar_civil' }, manager);
  check('a manager cannot create in an area they do not run', outside.status === 403, outside.body.error);

  const customerId = created.body.customer?.id;
  if (customerId) {
    check('a manager records a payment', (await post('/api/ops/payments',
      { action: 'record', customerId, amount: 1600, mode: 'CASH' }, manager)).ok);
    check('a customer can be put on hold', (await post('/api/ops/customers',
      { action: 'setStatus', customerId, status: 'HOLD' }, manager)).ok);
    check('and reactivated', (await post('/api/ops/customers',
      { action: 'setStatus', customerId, status: 'ACTIVE' }, manager)).ok);
  }

  /* Schedule */
  const auto = await post('/api/ops/visits', { action: 'autoAssign', date: today, areaId: 'ar_wadi' }, manager);
  check('auto-assign covers unassigned cars', auto.ok, auto.body.message);
  check('a manager cannot auto-assign another area',
    (await post('/api/ops/visits', { action: 'autoAssign', date: today, areaId: 'ar_civil' }, manager)).status === 403);

  /* Pocket money — raised and approved inside Wadi, so the manager under test
     is the one who owns the request. */
  const WADI_STAFF = ['rahul1', 'sunil2', 'ajay3', 'prakash4'];
  let pocketRequestId = null;
  for (const name of WADI_STAFF) {
    const { ok, cookie } = await login(`${name}@carzz.app`, 'staff123');
    if (!ok) continue;
    const raised = await post('/api/staff/pocket', { amount: 200 }, cookie);
    if (raised.ok) {
      pocketRequestId = raised.body.request?.id ?? null;
      check('a wash boy asks for pocket money', true, raised.body.message);
      check('a second request is blocked while one is pending',
        (await post('/api/staff/pocket', { amount: 100 }, cookie)).status === 409);
      break;
    }
  }
  if (!pocketRequestId) {
    // Every Wadi boy already had one pending from the seed; approve one of those.
    for (let i = 0; i < WADI_STAFF.length && !pocketRequestId; i += 1) {
      const id = `pkt_stf_ar_wadi_${i}_0`;
      if ((await post('/api/ops/pocket', { requestId: id, decision: 'APPROVED' }, manager)).ok) {
        pocketRequestId = id;
        check('a wash boy already had pocket money pending', true, id);
      }
    }
    if (pocketRequestId) {
      check('the manager approves it', true);
      check('and it cannot be decided twice', (await post('/api/ops/pocket',
        { requestId: pocketRequestId, decision: 'REJECTED' }, manager)).status === 409);
    } else {
      check('a pocket request exists to approve', false, 'none raised or seeded in Wadi');
    }
  } else {
    const decided = await post('/api/ops/pocket', { requestId: pocketRequestId, decision: 'APPROVED' }, manager);
    check('the manager approves it', decided.ok, decided.body.message);
    check('and it cannot be decided twice', (await post('/api/ops/pocket',
      { requestId: pocketRequestId, decision: 'REJECTED' }, manager)).status === 409);
  }
  const foreignPocket = await post('/api/ops/pocket',
    { requestId: 'pkt_stf_ar_civil_0_0', decision: 'APPROVED' }, manager);
  check('a manager cannot decide another area’s request',
    foreignPocket.status === 403 || foreignPocket.status === 404);

  /* Complaints */
  let resolved = false;
  for (let i = 0; i < 42 && !resolved; i += 1) {
    const r = await post('/api/ops/complaints',
      { complaintId: `cmp_${i}`, action: 'resolve', resolution: 'Free re-wash scheduled' }, owner);
    if (r.ok) {
      resolved = check('a complaint is closed with what was done', r.body.complaint?.status === 'RESOLVED', r.body.message);
      check('closing one needs a resolution',
        (await post('/api/ops/complaints', { complaintId: `cmp_${i + 1}`, action: 'resolve', resolution: '' }, owner)).status === 400);
      const escalated = await post('/api/ops/complaints', { complaintId: `cmp_${i + 2}`, action: 'escalate' }, manager);
      if (escalated.ok) check('a manager escalates one to the owner', escalated.body.complaint?.status === 'ESCALATED');
    }
  }
  if (!resolved) check('a complaint is closed', false, 'none open');

  /* Stock */
  check('goods are issued to a wash boy', (await post('/api/ops/inventory',
    { action: 'issue', areaId: 'ar_wadi', itemId: 'itm_shampoo', staffId: 'stf_ar_wadi_0', quantity: 1 }, manager)).ok);
  const request = await post('/api/ops/inventory',
    { action: 'request', areaId: 'ar_wadi', itemId: 'itm_shampoo', quantity: 40, neededBy: '2026-12-31' }, manager);
  check('a purchase request is raised', request.ok, request.body.message);
  const requestId = request.body.request?.id;
  check('a manager cannot approve their own purchase',
    (await post('/api/ops/inventory', { action: 'decide', requestId, decision: 'APPROVED' }, manager)).status === 403);
  check('the owner approves it', (await post('/api/ops/inventory',
    { action: 'decide', requestId, decision: 'APPROVED' }, owner)).ok);
  check('and receiving it puts the goods back on the shelf',
    (await post('/api/ops/inventory', { action: 'receive', requestId }, manager)).ok);

  /* Staff */
  const email = `smoke${Date.now()}@carzz.app`;
  const hired = await post('/api/ops/staff',
    { action: 'create', name: 'Smoke Boy', phone: '9800004321', email, password: 'smokepass1', areaId: 'ar_wadi' }, manager);
  check('a wash boy is added', hired.ok, hired.body.message);
  check('a duplicate email is refused', (await post('/api/ops/staff',
    { action: 'create', name: 'Dup', phone: '9800004322', email: 'rahul1@carzz.app', password: 'smokepass1', areaId: 'ar_wadi' }, manager)).status === 409);
  check('the new boy can sign in', (await login(email, 'smokepass1')).ok);
  if (hired.body.staff?.id) {
    check('deactivating them frees their upcoming cars', (await post('/api/ops/staff',
      { action: 'setActive', staffId: hired.body.staff.id, active: false }, manager)).ok);
    const blocked = await login(email, 'smokepass1');
    check('and their login stops working', blocked.status === 403, blocked.body.error);
  }

  /* Owner-only controls */
  check('a manager cannot approve payouts',
    (await post('/api/admin/payout', { action: 'approveAll', cycle }, manager)).status === 403);
  check('a manager cannot change company settings',
    (await post('/api/admin/settings', { scope: 'payout', perWashRate: 1 }, manager)).status === 403);

  const payoutBefore = await html('/admin/payout', owner);
  const totalBefore = payoutBefore.match(/Total payable[\s\S]{0,240}?₹([\d,]+)/)?.[1];
  await post('/api/admin/settings', { scope: 'payout', baseMode: 'DAY_SLAB' }, owner);
  const payoutAfter = await html('/admin/payout', owner);
  const totalAfter = payoutAfter.match(/Total payable[\s\S]{0,240}?₹([\d,]+)/)?.[1];
  check('changing the base pay rule re-costs every payout',
    Boolean(totalBefore && totalAfter && totalBefore !== totalAfter), `${totalBefore} → ${totalAfter}`);
  await post('/api/admin/settings', { scope: 'payout', baseMode: 'PER_WASH' }, owner);

  const approved = await post('/api/admin/payout', { action: 'approveAll', cycle }, owner);
  check('the owner approves the payout run', approved.ok, approved.body.message);
  const again = await post('/api/admin/payout', { action: 'approveAll', cycle }, owner);
  check('approving again pays nobody twice', again.ok && again.body.approved === 0);

  check('a package price is the owner’s to change',
    (await post('/api/admin/packages', { action: 'update', packageId: 'pkg_bucket', price: 1700 }, owner)).ok);
  await post('/api/admin/packages', { action: 'update', packageId: 'pkg_bucket', price: 1600 }, owner);
  const retire = await post('/api/admin/packages', { action: 'update', packageId: 'pkg_bucket', active: false }, owner);
  check('a package still carrying cars cannot be retired', retire.status === 409, retire.body.error);

  check('every payment mode cannot be switched off at once',
    (await post('/api/admin/settings', { scope: 'app', paymentModesEnabled: [] }, owner)).status === 400);
  check('an expense is recorded', (await post('/api/admin/expenses',
    { head: 'MARKETING', amount: 5000, cycle }, owner)).ok);
  check('the owner cannot lock themselves out',
    (await post('/api/admin/users', { action: 'setActive', userId: 'usr_super', active: false }, owner)).status === 400);
  check('a manager account must be given an area', (await post('/api/admin/users',
    { action: 'create', name: 'No Area', email: `na${Date.now()}@carzz.app`, phone: '9800006666', password: 'somepass1', role: 'MANAGER' }, owner)).status === 400);
}

/* -------------------------------------------------------------------------- */
/* Suite 5 — the PWA is installable and works offline                         */
/* -------------------------------------------------------------------------- */

async function suitePwa() {
  suiteName = 'pwa';
  const manifestResponse = await fetch(`${BASE}/manifest.webmanifest`);
  const manifest = await manifestResponse.json().catch(() => ({}));
  check('the manifest is served', manifestResponse.status === 200 && Boolean(manifest.name));
  check('it declares a standalone app with icons',
    manifest.display === 'standalone' && (manifest.icons?.length ?? 0) >= 2);
  check('it includes a maskable icon for Android',
    (manifest.icons ?? []).some((i) => i.purpose === 'maskable'));

  const sw = await fetch(`${BASE}/sw.js`);
  check('the service worker is served and never cached',
    sw.status === 200 && /no-store/.test(sw.headers.get('cache-control') ?? ''));
  check('the offline page renders', (await fetch(`${BASE}/offline`)).status === 200);

  for (const icon of ['/icons/icon-192.png', '/icons/icon-512.png',
    '/icons/maskable-512.png', '/icons/apple-touch-icon.png', '/favicon-32.png']) {
    check(`${icon} is served`, (await fetch(BASE + icon)).status === 200);
  }
}


/* -------------------------------------------------------------------------- */
/* Suite 6 — the public website                                               */
/* -------------------------------------------------------------------------- */

async function suiteWebsite() {
  suiteName = 'website';
  const owner = (await login('owner@carzz.app', 'owner123')).cookie;
  const manager = (await login('manager.wadi@carzz.app', 'manager123')).cookie;

  const home = await fetch(BASE + '/', { redirect: 'manual' });
  check('the website is public — no sign-in needed', home.status === 200);
  const body = await html('/');
  check('it advertises live package prices', /₹1,600|₹2,000|₹3,200/.test(body));
  check('it lists the areas served', /Wadi|Bajaj Nagar|Civil Lines/.test(body));
  check('it shows real customer ratings', /rated washes/.test(body));

  /* Booking */
  const booking = await post('/api/enquiries', {
    name: 'Smoke Enquirer', phone: '9800112233', areaId: 'ar_wadi',
    locality: 'Test Society', carCount: 2, packageId: 'pkg_bucket',
  });
  check('a visitor can book a wash', booking.ok, booking.body.message);
  check('a booking with no name is refused',
    (await post('/api/enquiries', { phone: '9800112233' })).status === 400);
  const bogusArea = await post('/api/enquiries', {
    name: 'Bogus Area', phone: '9800112244', areaId: 'ar_does_not_exist',
  });
  check('a made-up area on a booking is dropped, not stored',
    bogusArea.ok, 'accepted with the area ignored');

  /* Only the owner edits the site */
  check('a manager cannot edit the website',
    (await post('/api/admin/website', { heroTitle: 'Hacked' }, manager)).status === 403);
  check('an anonymous visitor cannot edit the website',
    (await post('/api/admin/website', { heroTitle: 'Hacked' })).status === 401);

  /* Editing reaches the live page */
  const heading = `Smoke heading ${Date.now()}`;
  const saved = await post('/api/admin/website', { heroTitle: heading }, owner);
  check('the owner edits the banner', saved.ok, saved.body.message);
  check('and the change appears on the live page immediately',
    (await html('/')).includes(heading));

  /* Prices cannot be advertised for a package that does not exist */
  check('advertising an unknown package is refused',
    (await post('/api/admin/website', { visiblePackageIds: ['pkg_nope'] }, owner)).status === 400);

  /* Wash photos must never be reachable through the public gallery route */
  const leak = await fetch(BASE + '/api/gallery/some-wash-photo-before');
  check('a wash photo cannot be fetched through the public gallery route',
    leak.status === 404);

  /* Taking the site offline */
  await post('/api/admin/website', { published: false }, owner);
  const offline = await fetch(BASE + '/', { redirect: 'manual' });
  check('taking the site offline hides it', offline.status === 404, `got ${offline.status}`);
  const refused = await post('/api/enquiries', { name: 'Too Late', phone: '9800112255' });
  check('and bookings are refused while it is offline', refused.status === 503);
  await post('/api/admin/website', { published: true }, owner);
  check('publishing brings it back', (await fetch(BASE + '/')).status === 200);
}

/* -------------------------------------------------------------------------- */

const SUITES = [
  ['Access — who can reach what', suiteAccess],
  ['Sign-in', suiteAuth],
  ['The wash', suiteWash],
  ['Money, people and stock', suiteOperations],
  ['PWA', suitePwa],
  ['The public website', suiteWebsite],
];

let exitCode = 0;
for (const [title, run] of SUITES) {
  process.stdout.write(`\n${title}\n`);
  // A fresh server per suite: the demo provider seeds per process, and these
  // suites consume the state they act on.
  const server = await startServer();
  try {
    await run();
  } catch (error) {
    check(`${title} ran to completion`, false, String(error).slice(0, 160));
  } finally {
    await stopServer(server);
  }
}

const failed = results.filter((r) => !r.ok);
process.stdout.write(`\n${results.length - failed.length}/${results.length} checks passed\n`);
if (failed.length) {
  exitCode = 1;
  process.stdout.write('\nFailures:\n');
  for (const f of failed) process.stdout.write(`  ✗ [${f.suite}] ${f.name}${f.detail ? ` — ${f.detail}` : ''}\n`);
}
process.exit(exitCode);
