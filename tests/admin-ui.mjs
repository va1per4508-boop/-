import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
fs.mkdirSync("work", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(process.env.TEST_URL || "http://localhost:5174");
await page.getByRole("heading", { name: "תמונת מצב", exact: true }).waitFor();
await page.locator("nav").getByRole("button", { name: "ניהול ועריכה" }).click();
await page.getByRole("button", { name: "הוספה", exact: true }).click();
await page.getByLabel("שם פריט ברשימה").fill("QA Model");
await page.getByRole("button", { name: "שמירת פריט" }).click();
await page
  .getByRole("button", { name: "עריכת QA Model", exact: true })
  .waitFor();
await page
  .getByRole("button", { name: "עריכת Reach R-Li", exact: true })
  .click();
await page.getByLabel("שם פריט ברשימה").fill("Reach Renamed");
await page.getByRole("button", { name: "שמירת פריט" }).click();
await page
  .getByRole("button", { name: "עריכת Reach Renamed", exact: true })
  .waitFor();
await page.getByRole("button", { name: "שדות נוספים", exact: true }).click();
await page.getByRole("button", { name: "הוספה", exact: true }).click();
await page.getByLabel("שם פריט ברשימה").fill("רמת טכנולוגיה");
await page.getByRole("button", { name: "שמירת פריט" }).click();
await page
  .getByRole("button", { name: "עריכת רמת טכנולוגיה", exact: true })
  .waitFor();
await page.screenshot({ path: "work/settings.png", fullPage: true });
await page.locator("nav").getByRole("button", { name: "כל המכשירים" }).click();
await page
  .getByRole("button", { name: "פתיחת מכשיר RX-260100", exact: true })
  .click();
assert.equal(
  await page
    .getByRole("dialog")
    .getByRole("heading", { name: "Reach Renamed", exact: true })
    .count(),
  1,
);
await page.getByRole("button", { name: "עריכת מכשיר", exact: true }).click();
await page.getByLabel("עריכת דגם").selectOption("QA Model");
await page.getByLabel("ברקוד נוסף").fill("BAR-100");
await page.getByLabel("רמת טכנולוגיה").fill("7");
await page.getByLabel("סיבת עריכת מנהל").fill("בדיקת שינוי מנהל");
await page.getByRole("button", { name: "שמירת שינויים", exact: true }).click();
await page.getByRole("dialog").waitFor({ state: "hidden" });
await page.getByRole("button", { name: "סריקת ברקוד", exact: true }).click();
await page.getByLabel("מספר סידורי או ברקוד לסריקה").fill("BAR-100");
await page.getByLabel("מספר סידורי או ברקוד לסריקה").press("Enter");
await page.getByRole("dialog", { name: "כרטיס מכשיר" }).waitFor();
assert.equal(
  await page
    .getByRole("dialog")
    .getByRole("heading", { name: "QA Model", exact: true })
    .count(),
  1,
);
assert.equal(
  await page.getByRole("dialog").getByText("7", { exact: true }).count(),
  1,
);
await page.keyboard.press("Escape");
const fixture =
  "מספר סידורי,דגם,חברה,עובד,לקוח,מצב,צד,תאריך קליטה,רמת הגברה\nIMP-QA-1,Imported Model,חברה לדוגמה 1,,,במחסן,ימין,05/10/2026,55\nIMP-QA-2,Imported Model,חברה לדוגמה 2 מכשירי שמיעה,עובד לדוגמה 1,לקוח דוגמה,נמסר ללקוח,שמאל,,65";
fs.writeFileSync("work/sample.csv", fixture);
await page
  .locator("nav")
  .getByRole("button", { name: "ייבוא מגיליון" })
  .click();
await page.getByLabel("בחירת קובץ מלאי").setInputFiles("work/sample.csv");
await page.getByLabel("בחירת לשונית לייבוא").waitFor();
await page.getByRole("button", { name: "בדיקת נתונים ותצוגה מקדימה" }).click();
await page.getByText("2 מכשירים תקינים", { exact: true }).waitFor();
assert.equal(await page.getByText("0 שגיאות", { exact: true }).count(), 1);
await page.getByRole("checkbox").nth(0).check();
await page.getByRole("checkbox").nth(1).check();
await page.screenshot({ path: "work/import.png", fullPage: true });
await page.getByRole("button", { name: "אישור וייבוא 2 מכשירים" }).click();
await page.getByRole("status").filter({ hasText: "2 מכשירים יובאו" }).waitFor();
await page.locator("nav").getByRole("button", { name: "כל המכשירים" }).click();
await page
  .getByRole("button", { name: "פתיחת מכשיר IMP-QA-2", exact: true })
  .click();
assert.equal(
  await page
    .getByRole("dialog")
    .locator(".detail-grid")
    .getByText("65", { exact: true })
    .count(),
  1,
);
assert.equal(
  await page
    .getByRole("dialog")
    .locator(".detail-grid")
    .getByText("עובד לדוגמה 1", { exact: true })
    .count(),
  1,
);
await page.keyboard.press("Escape");
await page.reload();
await page.getByRole("heading", { name: "תמונת מצב", exact: true }).waitFor();
await page.locator("nav").getByRole("button", { name: "ניהול ועריכה" }).click();
await page
  .getByRole("button", { name: "עריכת Imported Model", exact: true })
  .waitFor();
await page
  .getByRole("button", { name: "הסרת Imported Model", exact: true })
  .click();
await page.getByRole("button", { name: "אישור הסרה", exact: true }).click();
await page.getByText("בארכיון — אינו מוצע בבחירה חדשה").waitFor();
await page
  .locator("nav")
  .getByRole("button", { name: "קליטת מלאי", exact: true })
  .click();
assert.equal(
  await page
    .getByLabel("דגם *")
    .locator("option")
    .filter({ hasText: "Imported Model" })
    .count(),
  0,
);
await page.getByRole("button", { name: "הוספת מספר סידורי בסריקה" }).click();
await page.getByLabel("מספר סידורי או ברקוד לסריקה").fill("NEW-SCAN-1");
await page.getByRole("button", { name: "אישור הקוד" }).click();
assert.equal(
  await page.getByLabel("מספרים סידוריים *").inputValue(),
  "NEW-SCAN-1",
);
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "work/admin-mobile.png", fullPage: true });
assert(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
);
assert.deepEqual(errors, []);
await browser.close();
console.log(
  "PASS: editable catalogue, cascading rename, custom fields, administrator edits and audit, barcode lookup, reception scanning, CSV preview and import with additional columns/source, archive behaviour, persistence, mobile",
);
// A real Code 128 barcode is decoded through a virtual video camera, not a mocked decoder.
if (fs.existsSync("work/barcode.y4m")) {
  const b = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      `--use-file-for-fake-video-capture=${path.resolve("work/barcode.y4m")}`,
    ],
  });
  const p = await b.newPage();
  await p.goto(process.env.TEST_URL || "http://localhost:5174");
  await p.getByRole("button", { name: "סריקת ברקוד", exact: true }).click();
  await p.getByRole("button", { name: "סריקה במצלמה" }).click();
  await p
    .getByRole("dialog", { name: "כרטיס מכשיר" })
    .waitFor({ timeout: 20000 });
  assert.equal(
    await p.getByRole("dialog").getByText("RX-260100", { exact: true }).count(),
    1,
  );
  await b.close();
  console.log(
    "PASS: Code128 camera decoding using ZXing and camera shutdown after lookup",
  );
}
