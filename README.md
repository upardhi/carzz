# Carz Management

Car wash operations for a multi-area business: schedules, photo-verified
proof of work, payments, staff payout and stock — one Next.js PWA serving
five different audiences.

## Running it

```bash
npm install
cp .env.example .env.local     # the defaults work as-is
npm run dev
```

Open http://localhost:3000. No database is needed to start — the default
provider is a seeded in-memory store.

### Demo sign-ins

The login screen lists these and fills them in on a tap.

| Role        | Email                      | Password      |
| ----------- | -------------------------- | ------------- |
| Super Admin | `owner@carzz.app`          | `owner123`    |
| Area Admin  | `areaadmin@carzz.app`      | `area123`     |
| Manager     | `manager.wadi@carzz.app`   | `manager123`  |
| Wash Staff  | `rahul1@carzz.app`         | `staff123`    |
| Customer    | `customer@carzz.app`       | `customer123` |

## The five roles

| Role            | Sees                                        | Lives at   |
| --------------- | ------------------------------------------- | ---------- |
| **Super Admin** | Every area. Profit, payout approval, rates  | `/admin`   |
| **Area Admin**  | One region: its managers and their staff    | `/area`    |
| **Manager**     | One area, day to day                        | `/manager` |
| **Employee**    | Today's cars and his own earnings           | `/staff`   |
| **Customer**    | His cars, schedule, proof and payments      | `/app`     |

Scope is enforced on every read and write, not hidden in a menu: a manager
cannot reach another area's records by editing the address bar. See
`src/lib/auth/rbac.ts` for the permission matrix and
`src/app/api/ops/_guard.ts` for the write-side check.

## Choosing a database later

The database decision is deliberately reversible. Everything above the data
layer talks to one interface (`src/lib/data/ports/store.ts`) through a narrow,
portable filter language. Three adapters implement it:

| `DATA_PROVIDER` | Backend                              | Setup                    |
| --------------- | ------------------------------------ | ------------------------ |
| `memory`        | In-process seeded store (default)    | none                     |
| `prisma`        | Postgres / MySQL / SQLite via Prisma | `DATABASE_URL`           |
| `firebase`      | Cloud Firestore                      | service-account env vars |

Switching is a change to `DATA_PROVIDER` plus that provider's credentials. No
route handler, service or component changes.

### Moving to Postgres (Neon, Supabase, RDS, or your own server)

Prisma is already installed. Put both URLs in `.env.local` and run:

```bash
npx prisma migrate deploy   # or: npx prisma db push, for a first run
npm run db:seed             # loads the demo dataset
DATA_PROVIDER=prisma npm run dev
```

**Two URLs, because they do different jobs.** `DATABASE_URL` is what the
running app uses and must be the host's **pooled** connection string — on a
serverless deployment each invocation otherwise opens its own connection and
exhausts the limit. `DIRECT_URL` is used only by migrations, which issue DDL
a pooler cannot run. On Neon the pooled host is the one containing
`-pooler`; on a plain Postgres server with no pooler, leave `DIRECT_URL`
unset and migrations fall back to `DATABASE_URL`. The app warns at boot if
`DATABASE_URL` does not look pooled.

**Which host?** Any Postgres works — the datasource is just a connection
string. Neon suits this app well: it is only Postgres, which is all that is
needed here since the app brings its own auth and its own photo storage, and
it scales to zero between rounds without *pausing* the project the way a
free tier that sleeps would.

```bash
# Firestore instead
npm i firebase-admin
DATA_PROVIDER=firebase npm run dev
```

`prisma/schema.prisma` mirrors `src/lib/data/types.ts` one-to-one, and
`prisma/seed.ts` loads the same demo dataset the in-memory provider uses, so
there is one definition of it rather than two that drift. Wash photos sit
behind the same kind of seam (`src/lib/storage/index.ts`), so S3 or Firebase
Storage drops in without touching the wash flow.

> **Pin Prisma 7.** npm's `latest` tag for `prisma` currently points at an
> 8.0 release candidate whose CLI is restructured — `generate`, `db push` and
> `migrate` are gone from it. This project pins `7.10.0`, the last stable.

## What the app enforces

These are rules, not UI suggestions — each is checked server-side:

- **No photo, no completed wash.** A wash cannot be closed without a before
  and after photo. The button is disabled, and the API refuses it too.
- **A missed wash returns to the customer's count.** Recording a miss needs a
  compulsory reason and generates the make-good visit in the same billing
  cycle, so the customer is never quietly short a wash he paid for.
- **The lead source cannot be skipped.** Step 1 of customer intake, because
  it is the only record of which marketing actually works.
- **Managers cannot buy.** Purchase requests go to the owner.
- **The owner approves payout.** Nothing is payable until he does, and
  approval writes a snapshot so a payslip cannot drift afterwards.
- **Photos are not public.** They are pictures of customers' vehicles outside
  their homes, so they are served only to a signed-in account.

## One open business question

The brief left the base pay rule unsettled: are ₹300 / ₹350 / ₹400 a **slab
by the car's position in the day**, or does a **flat rate per wash** apply?
The two differ by roughly three times on the same work.

It ships as a setting (Settings → base pay rule), defaulting to the flat
₹110 per wash that reproduces the figures in the original prototype. Change
it once decided; every unapproved payout recalculates, and no code changes.

## Checking it still works

```bash
npm run build && npm run smoke
```

Around ninety end-to-end checks against the real production server, covering:
which role can reach which of the pages (and that a signed-out visitor reaches
none of them), sign-in, the whole wash flow including every way it can be
refused, customer payments and complaints, intake, scheduling, pocket money,
stock, and the owner's payout and settings controls. Each suite runs against
a freshly started server, since they mutate the state they act on.

Point it at a deployment with `npm run smoke -- --base=https://…`.

## Deploying

`npm run build` runs `prisma generate` first, because the generated Prisma
Client lives in `node_modules` and is not committed — on a fresh checkout
(any CI, and every Vercel build) it does not exist until that command runs.
Nothing under `src/` imports it statically, so a build succeeds without a
database; only the running app needs one.

Set these on the host before the deployment is usable:

| Variable        | Value                                                    |
| --------------- | -------------------------------------------------------- |
| `AUTH_SECRET`   | A generated secret (see Notes below)                      |
| `DATA_PROVIDER` | `prisma`                                                  |
| `DATABASE_URL`  | The **pooled** connection string                          |
| `DIRECT_URL`    | The direct connection string, for migrations              |

**`DATA_PROVIDER` must not be left unset in a deployment.** The default
in-memory store is a fresh copy of the demo data in every process: on a
serverless host each instance holds its own copy, so two people signed in at
the same time can see different data, and every save disappears when the
instance is recycled. It is meant for local work and the smoke suite. The
app warns about this at boot in production.

Run the migration and the seed once, from a machine that has `DIRECT_URL`:

```bash
npx prisma db push && npm run db:seed
```

## Mobile

The PWA is installable and works offline — see [MOBILE.md](./MOBILE.md) for
that and for the Capacitor wrapper if a store listing is required.

## Layout

```
src/
  app/            routes: /login /app /staff /manager /area /admin and /api
  components/
    ui/           design-token primitives (Card, Tag, Button, Table…)
    shell/        MobileShell, ConsoleShell, brand, icons
    console/      screens shared by Manager and Area Admin
    pwa/          service worker registration, install prompt, offline banner
  lib/
    auth/         sessions, scrypt hashing, RBAC and scoping
    data/         domain types, repository ports, three adapters
    services/     business rules: visits, accounts, payroll, inventory, reports
    storage/      wash photo storage port
    util/         formatting, labels, business-timezone handling
prisma/schema.prisma
```

## Scripts

| Command             | Does                                    |
| ------------------- | --------------------------------------- |
| `npm run dev`       | Development server                      |
| `npm run build`     | Production build                        |
| `npm run smoke`     | End-to-end checks (needs a build first) |
| `npm run typecheck` | Types, app and Node scripts alike       |
| `npm run lint`      | ESLint                                  |
| `npm run db:push`   | Push the Prisma schema                  |
| `npm run cap:sync`  | Build and sync the native shell         |

## Notes

- Times are wall-clock in `BUSINESS_TIMEZONE` (default `Asia/Kolkata`), not
  UTC — a round running 7 AM to noon would otherwise straddle two UTC days.
- `AUTH_SECRET` must be set to a real value in production:
  `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
