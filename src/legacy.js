import { parseDate } from "./importer.js";
const clean = (x) => String(x ?? "").trim();
export const legacyTypes = {
  "device-order": "הזמנת מכשירים",
  other: "אביזר / חיוב לבדיקה",
  cancelled: "רשומה שבוטלה",
};
export const legacyDelivery = {
  delivered: "נמסר",
  pending: "לא נמסר",
  unknown: "לא צוין",
};
export function legacyCompany(sheet, companies) {
  const n = clean(sheet).replace(/\s+/g, "");
  return (
    companies.find((c) =>
      n.includes(c.replace(" מכשירי שמיעה", "").replace(/\s+/g, "")),
    ) || ""
  );
}
export function parseLegacy(
  book,
  companies,
  existing = [],
  dateMeaning = "order",
  corrections = {},
) {
  const records = [],
    issues = [],
    summaries = [],
    fingerprints = new Map(existing.map((r) => [r.sourceKey, r]));
  for (const sheet of book) {
    const headers = sheet.rows[0] || [];
    const company = legacyCompany(sheet.name, companies);
    let deviceRows = 0,
      units = 0,
      other = 0,
      formulaRows = 0;
    if (!company) {
      issues.push({
        sheet: sheet.name,
        row: 1,
        message: "לא ניתן לזהות חברה לפי שם הלשונית",
        blocking: true,
      });
      continue;
    }
    for (let i = 1; i < sheet.rows.length; i++) {
      const v = sheet.rows[i] || [];
      if (
        ![...v.slice(0, 5), v[9]].some((x) => clean(x) && typeof x !== "object")
      ) {
        formulaRows++;
        continue;
      }
      const model = clean(v[1]),
        notes = clean(v[9]),
        client = clean(v[2]);
      const kind = model
        ? "device-order"
        : notes.includes("בוטל")
          ? "cancelled"
          : "other";
      const quantity = clean(v[4]) === "" ? null : Number(v[4]);
      const rawDate = clean(v[6]);
      let orderDate = "";
      try {
        if (corrections[`${clean(sheet.name)}:${i + 1}`])
          orderDate = parseDate(corrections[`${clean(sheet.name)}:${i + 1}`]);
        else if (rawDate) orderDate = parseDate(rawDate);
      } catch (e) {
        issues.push({
          sheet: sheet.name,
          row: i + 1,
          message: e.message,
          blocking: true,
        });
      }
      if (quantity !== null && (!Number.isInteger(quantity) || quantity < 1)) {
        issues.push({
          sheet: sheet.name,
          row: i + 1,
          message: "כמות לא תקינה",
          blocking: true,
        });
      }
      const status =
        clean(v[7]) === "נמסר"
          ? "delivered"
          : clean(v[7]) === "לא נמסר"
            ? "pending"
            : "unknown";
      const rawPrice = v[5];
      const price =
        typeof rawPrice === "number" && Number.isFinite(rawPrice)
          ? rawPrice
          : null;
      const record = {
        id: crypto.randomUUID(),
        sourceKey: `legacy:${clean(sheet.name)}:${i + 1}`,
        kind,
        company,
        model,
        client,
        color: clean(v[0]),
        quantity,
        price,
        priceRaw: clean(rawPrice),
        payment: clean(v[3]),
        orderDate,
        delivery: status,
        city: clean(v[8]),
        notes,
        employee: "",
        serials: [],
        source: {
          sheet: sheet.name,
          row: i + 1,
          dateMeaning,
          ...(corrections[`${clean(sheet.name)}:${i + 1}`]
            ? { dateCorrection: { original: rawDate, corrected: orderDate } }
            : {}),
          values: Object.fromEntries(
            v.map((x, col) => [
              `${col + 1}:${clean(headers[col]) || "ללא כותרת"}`,
              x ?? "",
            ]),
          ),
        },
      };
      if (fingerprints.has(record.sourceKey)) {
        const old = fingerprints.get(record.sourceKey);
        if (
          JSON.stringify(old.source.values) ===
          JSON.stringify(record.source.values)
        )
          continue;
        issues.push({
          sheet: sheet.name,
          row: i + 1,
          message: "השורה כבר יובאה והשתנתה במקור — יש לעדכן את הרשומה הקיימת",
          blocking: true,
        });
        continue;
      }
      fingerprints.set(record.sourceKey, record);
      if (kind === "device-order") {
        deviceRows++;
        units += quantity || 0;
        if (quantity === null)
          issues.push({
            sheet: sheet.name,
            row: i + 1,
            message: "חסרה כמות",
            blocking: true,
          });
        if (!client)
          issues.push({
            sheet: sheet.name,
            row: i + 1,
            message: "חסר שם לקוח",
            blocking: false,
          });
        if (!rawDate)
          issues.push({
            sheet: sheet.name,
            row: i + 1,
            message: "תאריך הזמנה לא צוין; יישאר ריק",
            blocking: false,
          });
        if (record.price === null)
          issues.push({
            sheet: sheet.name,
            row: i + 1,
            message: "מחיר לא מספרי; הערך המקורי נשמר",
            blocking: false,
          });
      } else other++;
      records.push(record);
    }
    summaries.push({ company, deviceRows, units, other, formulaRows });
  }
  return { records, issues, summaries };
}
export function isLegacyWorkbook(book) {
  return (
    book.length > 0 &&
    book.every(
      (s) =>
        s.rows[0]?.some((h) => clean(h) === "כמות") &&
        !s.rows[0]?.some((h) => /סידורי|serial/i.test(clean(h))),
    )
  );
}
