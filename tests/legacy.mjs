import assert from "node:assert/strict";
import { parseLegacy, isLegacyWorkbook } from "../src/legacy.js";
const companies = [
  "אודיוטק",
  "פטיפון מכשירי שמיעה",
  "אודיו סאונד מכשירי שמיעה",
];
const headers = [
  "צבע מכשיר",
  "דגם",
  "שם לקוח",
  "שולם \\ לא שולם",
  "כמות",
  "מחיר בשקלים",
  "תאריך",
  "נמסר / לא נמסר",
  "עיר מגורים",
  "הערות",
];
const book = [
  {
    name: "אודיו סאונד רקסטון",
    rows: [
      headers,
      [
        "גוף",
        "MODEL",
        "לקוח דוגמה",
        "שולם",
        2,
        1942,
        "31.06.26",
        "נמסר",
        "עיר",
        "",
      ],
      ["", "", "", "", null, "#REF!", "", "נמסר / לא נמסר"],
      ["", "", "לקוח דוגמה", "שולם", 1, 324, "30.06.26", "נמסר", "מטען", ""],
    ],
  },
];
assert(isLegacyWorkbook(book));
const blocked = parseLegacy(book, companies);
assert.equal(blocked.issues.filter((i) => i.blocking).length, 1);
const corrected = parseLegacy(book, companies, [], "order", {
  "אודיו סאונד רקסטון:2": "2026-06-30",
});
assert.equal(corrected.records.length, 2);
assert.equal(corrected.summaries[0].units, 2);
assert.equal(corrected.summaries[0].other, 1);
assert.equal(corrected.records[0].orderDate, "2026-06-30");
assert.equal(corrected.records[0].source.values["7:תאריך"], "31.06.26");
assert.equal(corrected.records[0].employee, "");
assert.equal(corrected.records[0].serials.length, 0);
assert.equal(corrected.records[1].kind, "other");
assert.equal(
  parseLegacy(book, companies, corrected.records, "order", {
    "אודיו סאונד רקסטון:2": "2026-06-30",
  }).records.length,
  0,
);
console.log(
  "PASS: quantity-based order import, company tabs, formula-only rows skipped, invalid date correction with original preserved, no fabricated serials/employees, accessory classification and duplicate prevention",
);
