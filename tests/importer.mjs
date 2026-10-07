import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  readWorkbook,
  guessMapping,
  mapRows,
  parseDate,
  stageImport,
} from "../src/importer.js";
import { defaultCatalog } from "../src/catalog.js";
const book = new ExcelJS.Workbook();
const sheet = book.addWorksheet("אודיוטק");
sheet.addRow([
  "מספר סידורי",
  "דגם",
  "סטטוס",
  "צד",
  "תאריך קליטה",
  "פרמטר נוסף",
]);
sheet.addRow([
  123,
  "דגם א",
  "במחסן",
  "R",
  new Date("2026-10-05T00:00:00Z"),
  "ערך",
]);
sheet.getCell("A2").numFmt = "000000";
book.addWorksheet("פטיפון").addRow(["מספר סידורי", "דגם"]);
const buf = await book.xlsx.writeBuffer();
const file = {
  name: "sample.xlsx",
  size: buf.byteLength,
  arrayBuffer: async () => buf,
};
const sheets = await readWorkbook(file);
assert.equal(sheets.length, 2);
assert.equal(sheets[0].rows[1][0], "000123");
const mapping = guessMapping(sheets[0].rows[0]);
const result = mapRows({
  sheet: sheets[0],
  headerRow: 0,
  mapping,
  defaults: { company: "אודיוטק" },
  existing: [],
});
assert.equal(result.errors.length, 0);
assert.equal(result.items[0].side, "ימין");
assert.equal(result.items[0].received, "2026-10-05");
assert.equal(result.items[0].attributes["sheet:אודיוטק:6"], "ערך");
assert.equal(result.items[0].source.values["6:פרמטר נוסף"], "ערך");
const data = { devices: [], events: [], catalog: defaultCatalog() };
const staged = stageImport(
  data,
  result.items,
  "אודיוטק",
  sheets[0].rows[0],
  mapping,
);
assert(staged.models.some((x) => x.name === "דגם א"));
assert(staged.fields.some((x) => x.name === "פרמטר נוסף"));
assert.equal(parseDate("05/10/2026"), "2026-10-05");
assert.throws(() => parseDate("31/02/2026"));
const duplicates = mapRows({
  sheet: { ...sheets[0], rows: [...sheets[0].rows, sheets[0].rows[1]] },
  headerRow: 0,
  mapping,
  defaults: { company: "אודיוטק" },
  existing: [],
});
assert.equal(duplicates.errors.length, 1);
assert.match(duplicates.errors[0].message, /כפול/);
console.log(
  "PASS: XLSX multiple sheets, formatted leading-zero serials, Hebrew mapping, actual dates, all source columns and additional attributes, staged catalogue entries and duplicates",
);
