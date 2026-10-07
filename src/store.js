import { createClient } from "@supabase/supabase-js";
import { seed, transition, actions } from "./data";
export const backend =
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
    ? createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
      )
    : null;
const KEY = "hearing-stock-demo-v1";
export function loadDemo() {
  try {
    const value = localStorage.getItem(KEY);
    return value ? JSON.parse(value) : seed();
  } catch {
    throw new Error(
      "לא ניתן לקרוא את הנתונים השמורים בדפדפן. אין לאפס את האחסון לפני גיבוי.",
    );
  }
}
export function saveDemo(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}
async function fetchAll(table, columns, order) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await backend
      .from(table)
      .select(columns)
      .order(order, { ascending: table !== "events" })
      .range(offset, offset + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}
export async function fetchRemote() {
  const [devices, events, catalog, legacy] = await Promise.all([
    fetchAll("devices", "id,data,version", "id"),
    fetchAll("events", "data", "created_at"),
    backend.from("catalog").select("data,version").eq("id", 1).single(),
    fetchAll("legacy_records", "id,data,version", "id"),
  ]);
  if (catalog.error) throw catalog.error;
  return {
    devices: devices.map((x) => ({ ...x.data, id: x.id, version: x.version })),
    events: events.map((x) => x.data),
    catalog: catalog.data.data,
    catalogVersion: catalog.data.version,
    legacy: legacy.map((x) => ({ ...x.data, id: x.id, version: x.version })),
  };
}
export async function addRemote(items) {
  const { error } = await backend.rpc("receive_devices", { items });
  if (error) throw error;
  return fetchRemote();
}
export async function moveRemote(device, type, values) {
  const { error } = await backend.rpc("move_device", {
    device_id: device.id,
    expected_version: device.version,
    action: type,
    action_values: values,
  });
  if (error) throw error;
  return fetchRemote();
}
export function moveDemo(data, d, type, v) {
  const next = transition(d, type, v);
  const event = {
    id: crypto.randomUUID(),
    deviceId: d.id,
    serial: d.serial,
    type: actions[type],
    at: new Date().toISOString(),
    actor: "מנהל הדגמה",
    detail: [
      d.employee && `מאת ${d.employee}`,
      next.employee && `אל ${next.employee}`,
      next.company,
      next.client,
      v.reason,
      v.notes,
    ]
      .filter(Boolean)
      .join(" · "),
  };
  return {
    ...data,
    devices: data.devices.map((x) => (x.id === d.id ? next : x)),
    events: [event, ...data.events],
  };
}

export async function editRemote(device, values) {
  const { error } = await backend.rpc("edit_device", {
    device_id: device.id,
    expected_version: device.version,
    changes: values,
  });
  if (error) throw error;
  return fetchRemote();
}
export async function catalogRemote(data, kind, operation, item) {
  const { error } = await backend.rpc("manage_catalog", {
    kind,
    operation,
    item,
    expected_version: data.catalogVersion,
  });
  if (error) throw error;
  return fetchRemote();
}
export async function importRemote(items, catalog, version, source) {
  const { error } = await backend.rpc("import_devices", {
    items,
    next_catalog: catalog,
    expected_catalog_version: version,
    source_info: source,
  });
  if (error) throw error;
  return fetchRemote();
}

export async function importLegacyRemote(items, version) {
  const { error } = await backend.rpc("import_legacy_records", {
    items,
    expected_catalog_version: version,
  });
  if (error) throw error;
  return fetchRemote();
}
export async function editLegacyRemote(record, reason) {
  const { error } = await backend.rpc("edit_legacy_record", {
    record_id: record.id,
    expected_version: record.version,
    changes: record,
    reason,
  });
  if (error) throw error;
  return fetchRemote();
}
