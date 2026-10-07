import { chromium } from "@playwright/test";
import ExcelJS from "exceljs";
import fs from "node:fs";
import assert from "node:assert/strict";
fs.mkdirSync("work", { recursive: true });
const wb = new ExcelJS.Workbook();
const s = wb.addWorksheet("חברה לדוגמה 3 רקסטון");
s.addRow([
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
]);
s.addRow([
  "גוף",
  "SOURCE MODEL",
  "לקוח דוגמה",
  "שולם",
  2,
  1942,
  "31.06.26",
  "נמסר",
  "עיר",
  "",
]);
s.addRow([
  "",
  "",
  "לקוח אביזר",
  "שולם",
  1,
  324,
  "30.06.26",
  "נמסר",
  "מטען",
  "",
]);
s.addRow(["", "", "", "", null, "#REF!", "", "נמסר / לא נמסר"]);
await wb.xlsx.writeFile("work/legacy-sample.xlsx");
const b = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
await p.goto(process.env.TEST_URL || "http://localhost:5175");
await p.locator("nav").getByRole("button", { name: "ייבוא מגיליון" }).click();
await p.getByLabel("בחירת קובץ מלאי").setInputFiles("work/legacy-sample.xlsx");
await p.getByLabel("תיקון תאריך חברה לדוגמה 3 רקסטון שורה 2").fill("2026-06-30");
await p.getByText("0 שגיאות", { exact: false }).waitFor();
await p.getByRole("checkbox").nth(0).check();
await p.getByRole("checkbox").nth(1).check();
await p
  .getByRole("button", { name: "ייבוא 2 רשומות מהגיליון", exact: true })
  .click();
await p.getByRole("status").filter({ hasText: "2 רשומות יובאו" }).waitFor();
await p.locator("nav").getByRole("button", { name: "רשומות מהגיליון" }).click();
assert.equal(await p.locator("tbody tr").count(), 2);
await p
  .getByRole("button", {
    name: "עריכת רשומה legacy:חברה לדוגמה 3 רקסטון:2",
    exact: true,
  })
  .click();
await p.getByLabel("עובד ברשומה").selectOption("עובד לדוגמה 1");
await p.getByLabel("סיבת שינוי רשומה").fill("שיוך עובד לפי בדיקה");
await p.getByRole("button", { name: "שמירת רשומה", exact: true }).click();
await p.getByRole("dialog").waitFor({ state: "hidden" });
assert.equal(
  await p.locator("tbody").getByText("עובד לדוגמה 1", { exact: true }).count(),
  1,
);
await p.screenshot({ path: "work/legacy-screen.png", fullPage: true });
await p.reload();
await p.locator("nav").getByRole("button", { name: "רשומות מהגיליון" }).click();
assert.equal(await p.locator("tbody tr").count(), 2);
assert.deepEqual(errors, []);
await b.close();
console.log(
  "PASS: legacy XLSX auto-detection, date correction, atomic all-tabs preview/import, accessory retained, admin edit and persistent order table",
);
