import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
);
await db.exec(fs.readFileSync("database/schema.sql", "utf8"));
await db.exec(fs.readFileSync("database/002-admin-import.sql", "utf8"));
await db.exec(fs.readFileSync("database/003-legacy-records.sql", "utf8"));
const admin = "11111111-1111-4111-8111-111111111111",
  a = "22222222-2222-4222-8222-222222222222",
  b = "33333333-3333-4333-8333-333333333333",
  device = "44444444-4444-4444-8444-444444444444";
await db.query("insert into auth.users values ($1),($2),($3)", [admin, a, b]);
await db.query(
  `insert into public.profiles(id,name,role,employee) values ($1,'מנהל','admin',null),($2,'עובד לדוגמה 1','agent','עובד לדוגמה 1'),($3,'עובד לדוגמה 2','agent','עובד לדוגמה 2')`,
  [admin, a, b],
);
await db.exec("set role authenticated");
async function as(id) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
}
async function fail(fn, msg) {
  try {
    await fn();
    throw new Error("Expected rejection");
  } catch (e) {
    assert.match(e.message, msg);
  }
}
await as(admin);
const item = {
  id: device,
  serial: "TEST-001",
  model: "Reach R-Li",
  side: "ימין",
  color: "כסף",
  company: "חברה לדוגמה 1",
  batch: "TEST",
  received: "2026-10-07",
};
await db.query("select receive_devices($1)", [JSON.stringify([item])]);
await fail(
  () =>
    db.query("select receive_devices($1)", [
      JSON.stringify([
        {
          ...item,
          id: "55555555-5555-4555-8555-555555555555",
          serial: "test-001",
        },
      ]),
    ]),
  /מספר סידורי/,
);
await db.query("select move_device($1,$2,$3,$4)", [
  device,
  1,
  "assign",
  JSON.stringify({ company: "חברה לדוגמה 1", employee: "עובד לדוגמה 1" }),
]);
await as(b);
assert.equal((await db.query("select * from devices")).rows.length, 0);
assert.equal((await db.query("select * from events")).rows.length, 0);
await fail(
  () =>
    db.query("select move_device($1,$2,$3,$4)", [
      device,
      2,
      "deliver",
      JSON.stringify({ client: "לקוח" }),
    ]),
  /אין הרשאה/,
);
await as(a);
assert.equal((await db.query("select * from devices")).rows.length, 1);
await fail(
  () => db.query("select receive_devices($1)", [JSON.stringify([item])]),
  /רק מנהל/,
);
await fail(
  () =>
    db.query("select move_device($1,$2,$3,$4)", [
      device,
      2,
      "reassign",
      JSON.stringify({ employee: "עובד לדוגמה 2", company: "חברה לדוגמה 1" }),
    ]),
  /אין הרשאה/,
);
await fail(() => db.query("update devices set data='{}'"), /permission denied/);
await db.query("select move_device($1,$2,$3,$4)", [
  device,
  2,
  "trial",
  JSON.stringify({ client: "לקוח בדיקה", trialUntil: "2026-12-20" }),
]);
await fail(
  () =>
    db.query("select move_device($1,$2,$3,$4)", [
      device,
      2,
      "deliver",
      JSON.stringify({ client: "לקוח" }),
    ]),
  /עודכן/,
);
await db.query("select move_device($1,$2,$3,$4)", [
  device,
  3,
  "deliver",
  JSON.stringify({ client: "לקוח בדיקה" }),
]);
await db.query("select move_device($1,$2,$3,$4)", [
  device,
  4,
  "return",
  JSON.stringify({ reason: "בדיקה" }),
]);
assert.equal((await db.query("select * from devices")).rows.length, 0);
await as(admin);
await fail(
  () =>
    db.query("select move_device($1,$2,$3,$4)", [
      device,
      5,
      "approve",
      JSON.stringify({ checked: false }),
    ]),
  /אישור/,
);
await db.query("select move_device($1,$2,$3,$4)", [
  device,
  5,
  "approve",
  JSON.stringify({ checked: true }),
]);
const result = (await db.query("select * from devices")).rows[0];
assert.equal(result.data.status, "warehouse");
assert.equal(result.version, 6);
assert.equal((await db.query("select * from events")).rows.length, 6);
console.log(
  "PASS: SQL deployment, row-level employee isolation, forbidden writes, admin reception, case-insensitive serial uniqueness, stale update rejection, full trial/delivery/return/restock transactions and audit",
);

let cfg = (await db.query("select * from catalog")).rows[0];
await as(a);
await fail(
  () =>
    db.query("select manage_catalog($1,$2,$3,$4)", [
      "models",
      "add",
      JSON.stringify({ name: "חדש" }),
      cfg.version,
    ]),
  /רק מנהל/,
);
await fail(
  () =>
    db.query("select edit_device($1,$2,$3)", [
      device,
      6,
      JSON.stringify({ reason: "test" }),
    ]),
  /רק מנהל/,
);
await fail(
  () =>
    db.query("select import_devices($1,$2,$3,$4)", [
      "[]",
      JSON.stringify(cfg.data),
      cfg.version,
      "{}",
    ]),
  /רק מנהל/,
);
await as(admin);
await db.query("select manage_catalog($1,$2,$3,$4)", [
  "models",
  "add",
  JSON.stringify({ name: "דגם חדש" }),
  cfg.version,
]);
cfg = (await db.query("select * from catalog")).rows[0];
let old = cfg.data.models.find((m) => m.name === "Reach R-Li");
await db.query("select manage_catalog($1,$2,$3,$4)", [
  "models",
  "edit",
  JSON.stringify({ ...old, name: "Reach Updated" }),
  cfg.version,
]);
assert.equal(
  (await db.query("select * from devices")).rows[0].data.model,
  "Reach Updated",
);
let d = (await db.query("select * from devices")).rows[0];
await db.query("select edit_device($1,$2,$3)", [
  device,
  d.version,
  JSON.stringify({
    ...d.data,
    barcode: "BC-001",
    notes: "תיקון",
    reason: "בדיקת עריכה",
  }),
]);
d = (await db.query("select * from devices")).rows[0];
assert.equal(d.data.barcode, "BC-001");
await fail(
  () =>
    db.query("select edit_device($1,$2,$3)", [
      device,
      d.version,
      JSON.stringify({ ...d.data, reason: "" }),
    ]),
  /סיבת שינוי/,
);
await db.query("select move_device($1,$2,$3,$4)", [
  device,
  d.version,
  "assign",
  JSON.stringify({ company: "חברה לדוגמה 1", employee: "עובד לדוגמה 1" }),
]);
cfg = (await db.query("select * from catalog")).rows[0];
old = cfg.data.employees.find((x) => x.name === "עובד לדוגמה 1");
await db.query("select manage_catalog($1,$2,$3,$4)", [
  "employees",
  "edit",
  JSON.stringify({ ...old, name: "עובד לדוגמה 1 החדש" }),
  cfg.version,
]);
await as(a);
assert.equal((await db.query("select * from devices")).rows.length, 1);
assert.equal(
  (await db.query("select * from profiles where id=$1", [a])).rows[0].employee,
  "עובד לדוגמה 1 החדש",
);
await as(admin);
cfg = (await db.query("select * from catalog")).rows[0];
const next = structuredClone(cfg.data);
next.models.push({ id: crypto.randomUUID(), name: "דגם מיובא", active: true });
const imported = {
  ...item,
  id: crypto.randomUUID(),
  serial: "IMP-001",
  model: "דגם מיובא",
  status: "warehouse",
  company: "חברה לדוגמה 1",
  employee: "",
  client: "",
  received: "",
  attributes: { foo: "מידע נוסף" },
  source: { sheet: "בדיקה", row: 2, values: { foo: "מידע נוסף" } },
};
await db.query("select import_devices($1,$2,$3,$4)", [
  JSON.stringify([imported]),
  JSON.stringify(next),
  cfg.version,
  JSON.stringify({ file: "sample.csv", sheet: "בדיקה" }),
]);
assert.equal(
  (await db.query("select * from devices where data->>'serial'='IMP-001'"))
    .rows[0].data.source.row,
  2,
);
assert.equal(
  (await db.query("select * from devices where data->>'serial'='IMP-001'"))
    .rows[0].data.received,
  "",
);
cfg = (await db.query("select * from catalog")).rows[0];
await fail(
  () =>
    db.query("select import_devices($1,$2,$3,$4)", [
      JSON.stringify([
        { ...imported, id: crypto.randomUUID(), serial: "IMP-002" },
        { ...imported, id: crypto.randomUUID() },
      ]),
      JSON.stringify(cfg.data),
      cfg.version,
      "{}",
    ]),
  /הייבוא כולו בוטל/,
);
assert.equal(
  (await db.query("select * from devices where data->>'serial'='IMP-002'")).rows
    .length,
  0,
);
console.log(
  "PASS: dynamic catalogue CRUD, cascading model/employee renames preserve RLS, admin-only editing/import, custom attributes and source preservation, optional unknown dates, atomic rollback on duplicate imports",
);

const legacyRow = {
  id: crypto.randomUUID(),
  sourceKey: "legacy:sample:2",
  kind: "device-order",
  model: "LEGACY MODEL",
  company: "חברה לדוגמה 1",
  employee: "",
  client: "לקוח דוגמה",
  quantity: 2,
  delivery: "delivered",
  orderDate: "2026-06-30",
  source: {
    sheet: "sample",
    row: 2,
    values: { date: "31.06.26" },
    dateCorrection: { original: "31.06.26", corrected: "2026-06-30" },
  },
};
cfg = (await db.query("select * from catalog")).rows[0];
await db.query("select import_legacy_records($1,$2)", [
  JSON.stringify([legacyRow]),
  cfg.version,
]);
assert.equal(
  (await db.query("select * from legacy_records")).rows[0].data.quantity,
  2,
);
cfg = (await db.query("select * from catalog")).rows[0];
await fail(
  () =>
    db.query("select import_legacy_records($1,$2)", [
      JSON.stringify([{ ...legacyRow, id: crypto.randomUUID() }]),
      cfg.version,
    ]),
  /כבר יובאה/,
);
await as(b);
assert.equal((await db.query("select * from legacy_records")).rows.length, 0);
await fail(
  () =>
    db.query("select import_legacy_records($1,$2)", [
      JSON.stringify([legacyRow]),
      cfg.version,
    ]),
  /רק מנהל/,
);
await as(admin);
await db.query("select edit_legacy_record($1,$2,$3,$4)", [
  legacyRow.id,
  1,
  JSON.stringify({
    employee: "עובד לדוגמה 2",
    sourceKey: "forged",
    source: { bad: true },
  }),
  "שיוך עובד",
]);
await as(b);
const legacyVisible = (await db.query("select * from legacy_records")).rows[0];
assert.equal(legacyVisible.data.sourceKey, legacyRow.sourceKey);
assert.deepEqual(legacyVisible.data.source, legacyRow.source);
await as(admin);
const oldModel = cfg.data.models.find((m) => m.name === "LEGACY MODEL");
await db.query("select manage_catalog($1,$2,$3,$4)", [
  "models",
  "edit",
  JSON.stringify({ ...oldModel, name: "LEGACY RENAMED" }),
  cfg.version,
]);
assert.equal(
  (await db.query("select * from legacy_records")).rows[0].data.model,
  "LEGACY RENAMED",
);
console.log(
  "PASS: historical quantity records retain original source/corrections; protected import/edit, employee isolation, source immutability, duplicate rejection and catalogue cascades",
);
await db.close();
