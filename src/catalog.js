import React from "react";
import { companies, employees, models, statuses } from "./data.js";
export function defaultCatalog() {
  const entries = (list) =>
    list.map((name) => ({ id: crypto.randomUUID(), name, active: true }));
  return {
    companies: entries(companies),
    employees: entries(employees),
    models: entries(models),
    colors: entries(["כסף", "גרפיט", "שמפניה"]),
    fields: [],
  };
}
export function normalizeCatalog(data) {
  return data.catalog || defaultCatalog();
}
export function catalogLists(catalog, includeInactive = false) {
  return Object.fromEntries(
    Object.entries(catalog).map(([key, items]) => [
      key,
      key === "fields"
        ? items.filter((x) => includeInactive || x.active !== false)
        : items
            .filter((x) => includeInactive || x.active !== false)
            .map((x) => x.name),
    ]),
  );
}
export const CatalogContext = React.createContext(null);
export function useCatalog() {
  return React.useContext(CatalogContext) || catalogLists(defaultCatalog());
}
const property = {
  companies: "company",
  employees: "employee",
  models: "model",
  colors: "color",
};
export function changeCatalog(data, kind, operation, item) {
  const catalog = structuredClone(normalizeCatalog(data));
  if (!Object.hasOwn(catalog, kind)) throw new Error("רשימה לא תקינה");
  const old = catalog[kind].find((x) => x.id === item.id);
  const name = item.name?.trim();
  if (operation !== "remove" && (!name || name.length > 100))
    throw new Error("יש להזין שם באורך עד 100 תווים");
  if (
    operation !== "remove" &&
    catalog[kind].some(
      (x) => x.id !== item.id && x.name.toLowerCase() === name.toLowerCase(),
    )
  )
    throw new Error("השם כבר קיים ברשימה");
  let devices = data.devices,
    profiles = data.profiles;
  let archived = false;
  if (operation === "add") {
    catalog[kind].push({
      id: crypto.randomUUID(),
      name,
      active: true,
      ...(kind === "fields" ? { key: crypto.randomUUID() } : {}),
    });
  } else if (!old) throw new Error("הפריט לא נמצא");
  else if (operation === "edit") {
    catalog[kind] = catalog[kind].map((x) =>
      x.id === item.id ? { ...x, name, active: item.active !== false } : x,
    );
    if (property[kind] && old.name !== name)
      devices = devices.map((d) =>
        d[property[kind]] === old.name ? { ...d, [property[kind]]: name } : d,
      );
  } else if (operation === "remove") {
    const inUse =
      kind === "fields"
        ? devices.some((d) => d.attributes?.[old.key])
        : devices.some((d) => d[property[kind]] === old.name);
    if (inUse) {
      old.active = false;
      archived = true;
    } else catalog[kind] = catalog[kind].filter((x) => x.id !== item.id);
  } else throw new Error("פעולה לא תקינה");
  const label = {
    companies: "חברה",
    employees: "עובד",
    models: "דגם",
    colors: "צבע",
    fields: "שדה",
  }[kind];
  const event = {
    id: crypto.randomUUID(),
    type: `${operation === "add" ? "הוספת" : operation === "edit" ? "עדכון" : archived ? "ארכוב" : "מחיקת"} ${label}`,
    at: new Date().toISOString(),
    actor: "מנהל הדגמה",
    detail:
      old && old.name !== name
        ? `${old.name} ← ${name || old.name}`
        : name || old.name,
  };
  return { ...data, devices, catalog, events: [event, ...data.events] };
}
export function validateDeviceEdit(data, device, values, catalog) {
  const n = { ...device, ...values };
  const required = ["serial", "model", "reason"];
  for (const k of required)
    if (!values[k]?.trim())
      throw new Error("יש למלא מספר סידורי, דגם וסיבת שינוי");
  n.serial = n.serial.trim();
  if (
    data.devices.some(
      (x) =>
        x.id !== device.id && x.serial.toLowerCase() === n.serial.toLowerCase(),
    )
  )
    throw new Error("המספר הסידורי כבר קיים");
  if (
    n.barcode &&
    data.devices.some((x) => x.id !== device.id && x.barcode === n.barcode)
  )
    throw new Error("הברקוד כבר משויך למכשיר אחר");
  if (!Object.hasOwn(statuses, n.status)) throw new Error("מצב לא תקין");
  for (const [kind, key] of Object.entries(property))
    if (n[key] && !catalog[kind].some((x) => x.name === n[key]))
      throw new Error(`הערך אינו קיים ברשימה: ${n[key]}`);
  if (
    ["agent", "trial", "delivered"].includes(n.status) &&
    (!n.employee || !n.company)
  )
    throw new Error("במצב זה חובה לבחור חברה ועובד");
  if (["trial", "delivered"].includes(n.status) && !n.client?.trim())
    throw new Error("במצב זה חובה להזין לקוח");
  if (n.status === "trial" && !n.trialUntil)
    throw new Error("חסר תאריך סיום ניסיון");
  if (!["agent", "trial", "delivered"].includes(n.status)) {
    n.employee = "";
    n.client = "";
    n.trialUntil = "";
  }
  if (n.status !== "trial") n.trialUntil = "";
  delete n.reason;
  return n;
}
export function editDemo(data, device, values) {
  const next = validateDeviceEdit(data, device, values, normalizeCatalog(data));
  const changed = Object.keys(values).filter(
    (k) =>
      !["reason", "id", "version"].includes(k) &&
      JSON.stringify(values[k]) !== JSON.stringify(device[k]),
  );
  return {
    ...data,
    devices: data.devices.map((d) => (d.id === device.id ? next : d)),
    events: [
      {
        id: crypto.randomUUID(),
        deviceId: device.id,
        serial: next.serial,
        type: "עריכת מנהל",
        at: new Date().toISOString(),
        actor: "מנהל הדגמה",
        detail: values.reason,
        before: device,
        after: next,
        changed,
      },
      ...data.events,
    ],
  };
}
