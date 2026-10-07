import { statuses } from "./data.js";
export const importKeys = [
  ["serial", "מספר סידורי", true],
  ["barcode", "ברקוד"],
  ["model", "דגם", true],
  ["company", "חברה"],
  ["employee", "עובד אחראי"],
  ["client", "לקוח"],
  ["status", "מצב"],
  ["side", "צד"],
  ["color", "צבע"],
  ["received", "תאריך קליטה"],
  ["trialUntil", "סיום ניסיון"],
  ["batch", "משלוח"],
  ["notes", "הערות"],
];
const aliases = {
  serial: [
    "מספר סידורי",
    "מס סידורי",
    "סידורי",
    "serial",
    "s/n",
    "sn",
    "מספר מכשיר",
  ],
  barcode: ["ברקוד", "barcode"],
  model: ["דגם", "model", "סוג מכשיר"],
  company: ["חברה", "company", "שם החברה"],
  employee: ["עובד", "עובד אחראי", "נציג", "סוכן", "employee", "אצל מי"],
  client: ["לקוח", "שם לקוח", "client", "customer", "שם המטופל"],
  status: ["סטטוס", "מצב", "status"],
  side: ["צד", "side", "אוזן"],
  color: ["צבע", "color"],
  received: ["תאריך קליטה", "תאריך קבלה", "received"],
  trialUntil: ["סיום ניסיון", "תאריך סיום ניסיון"],
  batch: ["משלוח", "תעודת משלוח", "batch"],
  notes: ["הערות", "notes"],
};
const clean = (s) => String(s ?? "").trim();
const norm = (s) =>
  clean(s)
    .toLowerCase()
    .replace(/["'׳״.:_-]/g, "")
    .replace(/\s+/g, " ");
export function guessMapping(headers) {
  return Object.fromEntries(
    importKeys.map(([key]) => [
      key,
      String(
        headers.findIndex((h) =>
          aliases[key]?.some((a) => norm(a) === norm(h)),
        ),
      ),
    ]),
  );
}
export async function readWorkbook(file) {
  if (file.size > 20 * 1024 * 1024) throw new Error("הקובץ גדול מ־20MB");
  if (/\.csv$/i.test(file.name)) {
    const Papa = (await import("papaparse")).default;
    const parsed = Papa.parse(await file.text(), { skipEmptyLines: "greedy" });
    if (parsed.errors.some((e) => e.type === "Quotes"))
      throw new Error("קובץ CSV אינו תקין");
    return [{ name: file.name, rows: parsed.data }];
  }
  if (!/\.xlsx$/i.test(file.name))
    throw new Error("יש לבחור קובץ Excel מסוג XLSX או CSV");
  const ExcelJS = (await import("exceljs")).default;
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(await file.arrayBuffer());
  return book.worksheets
    .map((sheet) => {
      const rows = [];
      sheet.eachRow({ includeEmpty: true }, (row, i) => {
        const cells = [];
        for (let col = 1; col <= sheet.columnCount; col++) {
          const c = row.getCell(col);
          let v = c.value;
          if (v instanceof Date) v = v.toISOString().slice(0, 10);
          else if (v && typeof v === "object") {
            if (v.formula) v = v.result ?? "";
            else if (v.richText) v = v.richText.map((r) => r.text).join("");
            else v = c.text;
          }
          if (typeof v === "number" && /^0+$/.test(c.numFmt || ""))
            v = String(v).padStart(c.numFmt.length, "0");
          cells.push(clean(v));
        }
        rows.push(cells);
      });
      return { name: sheet.name, rows };
    })
    .filter((s) => s.rows.some((r) => r.some(Boolean)));
}
export function parseDate(value) {
  const s = clean(value);
  if (!s) return "";
  const heb = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2}|\d{4})$/);
  let year, month, day;
  if (heb) {
    day = +heb[1];
    month = +heb[2];
    year = +heb[3];
    if (year < 100) year += 2000;
  } else {
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!iso) throw new Error(`תאריך לא מזוהה: ${s}`);
    year = +iso[1];
    month = +iso[2];
    day = +iso[3];
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  )
    throw new Error(`תאריך לא תקין: ${s}`);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
export function mapRows({ sheet, headerRow, mapping, defaults, existing }) {
  const headers = sheet.rows[headerRow] || [];
  const seen = new Set(existing.map((d) => clean(d.serial).toLowerCase())),
    barcodes = new Set(existing.map((d) => d.barcode).filter(Boolean));
  const items = [],
    errors = [],
    warnings = [];
  const used = Object.values(mapping).filter((x) => +x >= 0);
  if (new Set(used).size !== used.length)
    errors.push({
      row: headerRow + 1,
      message: "אותה עמודה משויכת ליותר משדה אחד",
    });
  for (let i = headerRow + 1; i < sheet.rows.length; i++) {
    const row = sheet.rows[i];
    if (!row.some((v) => clean(v))) continue;
    try {
      const item = {
        id: crypto.randomUUID(),
        serial: "",
        barcode: "",
        model: "",
        company: defaults.company || "",
        employee: "",
        client: "",
        status: defaults.status || "",
        side: "לא מוגדר",
        color: "",
        received: "",
        trialUntil: "",
        batch: "",
        notes: "",
        attributes: {},
        source: {
          sheet: sheet.name,
          row: i + 1,
          values: Object.fromEntries(
            headers.map((h, col) => [
              `${col + 1}:${h || "עמודה"}`,
              row[col] || "",
            ]),
          ),
        },
      };
      for (const [key] of importKeys) {
        if (+mapping[key] >= 0)
          item[key] = clean(row[+mapping[key]]) || item[key];
      }
      if (!item.serial || !item.model)
        throw new Error("חסר מספר סידורי או דגם");
      if (item.serial.length > 100 || item.model.length > 100)
        throw new Error("מספר סידורי או דגם ארוך מדי");
      if (seen.has(clean(item.serial).toLowerCase()))
        throw new Error(`מספר סידורי כפול: ${item.serial}`);
      if (item.barcode && barcodes.has(item.barcode))
        throw new Error("הברקוד כבר משויך למכשיר");
      item.received = parseDate(item.received);
      item.trialUntil = parseDate(item.trialUntil);
      const s = Object.keys(statuses).find(
        (k) =>
          norm(k) === norm(item.status) ||
          norm(statuses[k]) === norm(item.status),
      );
      if (!s)
        throw new Error(
          `מצב לא מזוהה: ${item.status || "לא צוין"} — בחרו עמודה או מצב ברירת מחדל`,
        );
      item.status = s;
      if (
        ["agent", "trial", "delivered"].includes(s) &&
        (!item.employee || !item.company)
      )
        throw new Error("חסר עובד או חברה עבור מכשיר משויך");
      if (["trial", "delivered"].includes(s) && !item.client)
        throw new Error("חסר לקוח עבור מכשיר שנמסר");
      if (s === "trial" && !item.trialUntil)
        throw new Error("חסר תאריך סיום ניסיון");
      if (
        !["agent", "trial", "delivered"].includes(s) &&
        (item.employee || item.client)
      )
        throw new Error(
          "יש עובד או לקוח בשורה שמסומנת כמלאי ללא שיוך — יש לתקן את המצב",
        );
      if (item.side === "R" || item.side.toLowerCase() === "right")
        item.side = "ימין";
      if (item.side === "L" || item.side.toLowerCase() === "left")
        item.side = "שמאל";
      if (!["ימין", "שמאל", "לא מוגדר"].includes(item.side))
        throw new Error("צד לא מזוהה: " + item.side);
      headers.forEach((h, col) => {
        if (!used.includes(String(col)) && clean(h) && clean(row[col]))
          item.attributes[`sheet:${sheet.name}:${col + 1}`] = clean(row[col]);
      });
      if (!item.received)
        warnings.push({
          row: i + 1,
          message: "תאריך הקליטה לא צוין ויישאר ריק",
        });
      seen.add(clean(item.serial).toLowerCase());
      if (item.barcode) barcodes.add(item.barcode);
      items.push(item);
    } catch (e) {
      errors.push({ row: i + 1, message: e.message });
    }
  }
  if (items.length > 1000)
    errors.push({ row: 0, message: "ניתן לייבא עד 1000 מכשירים בכל פעולה" });
  return { items, errors, warnings };
}
export function stageImport(data, items, sheet, headers, mapping) {
  const catalog = structuredClone(data.catalog);
  for (const [kind, key] of [
    ["companies", "company"],
    ["employees", "employee"],
    ["models", "model"],
    ["colors", "color"],
  ])
    for (const item of items) {
      const name = item[key];
      if (name && !catalog[kind].some((x) => x.name === name))
        catalog[kind].push({ id: crypto.randomUUID(), name, active: true });
    }
  headers.forEach((h, col) => {
    const key = `sheet:${sheet}:${col + 1}`;
    if (
      h &&
      !Object.values(mapping).includes(String(col)) &&
      items.some((i) => i.attributes?.[key]) &&
      !catalog.fields.some((f) => f.key === key)
    )
      catalog.fields.push({
        id: crypto.randomUUID(),
        key,
        name: catalog.fields.some((f) => f.name === h)
          ? `${h} · ${sheet} · ${col + 1}`
          : h,
        active: true,
      });
  });
  return catalog;
}
