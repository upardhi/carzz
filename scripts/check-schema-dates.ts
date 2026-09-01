/**
 * Guards `src/lib/data/prisma/fields.ts` against `prisma/schema.prisma`.
 *
 * The Prisma adapter converts date columns between Postgres `Date` objects and
 * the strings the domain model uses, and it knows which columns those are from
 * a hand-written map. Add a date column to the schema without adding it to the
 * map and the bug shows up only on the real database, only on that one screen.
 * This makes that a build-time failure instead. `npm run smoke` runs it.
 */
import { readFileSync } from 'node:fs';
import { DATE_FIELDS } from '../src/lib/data/prisma/fields';

// Normalised to LF: on a Windows checkout git hands this file back with CRLF,
// and the `$` anchors below will not match with a `\r` still on the line — so
// every date column read as absent and the check failed against itself.
const schema = readFileSync('prisma/schema.prisma', 'utf8').replace(/\r\n/g, '\n');

/** `ServicePackage` → `servicePackage`, the name of its Prisma delegate. */
const delegateName = (model: string) => model[0].toLowerCase() + model.slice(1);

const fromSchema = new Map<string, { dateOnly: string[]; timestamp: string[] }>();

for (const block of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
  const [, model, body] = block;
  const found = { dateOnly: [] as string[], timestamp: [] as string[] };

  for (const line of body.split('\n')) {
    const field = /^\s*(\w+)\s+DateTime\??\s*(.*)$/.exec(line);
    if (!field) continue;
    const [, name, attributes] = field;
    (attributes.includes('@db.Date') ? found.dateOnly : found.timestamp).push(name);
  }

  fromSchema.set(delegateName(model), found);
}

const problems: string[] = [];
const mapped = DATE_FIELDS as unknown as Record<
  string,
  { dateOnly: readonly string[]; timestamp: readonly string[] }
>;

for (const [model, expected] of fromSchema) {
  const actual = mapped[model];
  if (!actual) {
    problems.push(`${model}: in the schema but missing from DATE_FIELDS`);
    continue;
  }
  for (const kind of ['dateOnly', 'timestamp'] as const) {
    const want = [...expected[kind]].sort().join(', ');
    const have = [...actual[kind]].sort().join(', ');
    if (want !== have) {
      problems.push(`${model}.${kind}: schema has [${want}], map has [${have}]`);
    }
  }
}

for (const model of Object.keys(mapped)) {
  if (!fromSchema.has(model)) {
    problems.push(`${model}: in DATE_FIELDS but not in the schema`);
  }
}

if (problems.length) {
  console.error('DATE_FIELDS no longer matches prisma/schema.prisma:\n');
  for (const problem of problems) console.error(`  ${problem}`);
  console.error(
    '\nFix src/lib/data/prisma/fields.ts — without it the Prisma adapter ' +
      'returns Date objects where the app expects date strings.',
  );
  process.exit(1);
}

console.log(
  `Date-column map matches the schema (${fromSchema.size} models checked).`,
);
