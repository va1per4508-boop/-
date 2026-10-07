import React, { useState } from "react";
import {
  Plus,
  Pencil,
  Archive,
  Settings,
  Package,
  Building2,
  Users,
  Palette,
  Columns3,
  Check,
  ScanBarcode,
  FileUp,
} from "lucide-react";
import { useCatalog, normalizeCatalog } from "./catalog";
import { statuses } from "./data";
export function AdminSettings({ data, busy, onChange, error }) {
  const [tab, setTab] = useState("models"),
    [edit, setEdit] = useState(null),
    [name, setName] = useState(""),
    [active, setActive] = useState(true),
    [localError, setLocalError] = useState("");
  const catalog = normalizeCatalog(data);
  const tabs = [
    ["models", "דגמים", Package],
    ["companies", "חברות", Building2],
    ["employees", "עובדים", Users],
    ["colors", "צבעים", Palette],
    ["fields", "שדות נוספים", Columns3],
  ];
  async function submit(e) {
    e.preventDefault();
    setLocalError("");
    try {
      await onChange(tab, edit?.id ? "edit" : "add", {
        id: edit?.id,
        name,
        active,
      });
      setEdit(null);
      setName("");
    } catch (e) {
      setLocalError(e.message);
    }
  }
  return (
    <section className="panel admin-panel">
      <div className="panel-head">
        <div>
          <h2>ניהול רשימות ופרמטרים</h2>
          <p>שינוי שם מעדכן גם את המכשירים המשויכים אליו.</p>
        </div>
        <span className="square teal">
          <Settings size={23} />
        </span>
      </div>
      <div className="admin-tabs">
        {tabs.map(([id, title, Icon]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => {
              setTab(id);
              setEdit(null);
              setName("");
              setLocalError("");
            }}
          >
            <Icon size={17} />
            {title}
          </button>
        ))}
      </div>
      <div className="admin-content">
        <div className="admin-list">
          <div className="panel-head">
            <h2>
              {tabs.find((t) => t[0] === tab)[1]}{" "}
              <span className="count">{catalog[tab].length}</span>
            </h2>
            <button
              className="primary"
              onClick={() => {
                setEdit({});
                setName("");
                setActive(true);
              }}
            >
              <Plus size={17} />
              הוספה
            </button>
          </div>
          {catalog[tab].map((item) => (
            <div className="catalog-row" key={item.id}>
              <div>
                <b>{item.name}</b>
                <small>
                  {item.active === false
                    ? "בארכיון — אינו מוצע בבחירה חדשה"
                    : "פעיל"}
                </small>
              </div>
              <button
                className="secondary"
                aria-label={`עריכת ${item.name}`}
                onClick={() => {
                  setEdit(item);
                  setName(item.name);
                  setActive(item.active !== false);
                }}
              >
                <Pencil size={16} />
                עריכה
              </button>
              <button
                className="icon-btn"
                aria-label={`הסרת ${item.name}`}
                onClick={() => {
                  setEdit({ ...item, removing: true });
                  setName(item.name);
                }}
              >
                <Archive size={18} />
              </button>
            </div>
          ))}
          {!catalog[tab].length && (
            <div className="empty">
              <Columns3 size={28} />
              <h3>הרשימה עדיין ריקה</h3>
              <p>הוסיפו שדה כדי לשמור פרמטר נוסף בכרטיס המכשיר.</p>
            </div>
          )}
        </div>
        <aside className="catalog-editor">
          {edit ? (
            edit.removing ? (
              <>
                <h3>הסרת ״{edit.name}״</h3>
                <p>
                  פריט שמשויך למכשירים יועבר לארכיון. פריט שאינו בשימוש יימחק
                  מהרשימה.
                </p>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={async () => {
                    try {
                      await onChange(tab, "remove", edit);
                      setEdit(null);
                    } catch (e) {
                      setLocalError(e.message);
                    }
                  }}
                >
                  אישור הסרה
                </button>
                <button className="secondary" onClick={() => setEdit(null)}>
                  ביטול
                </button>
              </>
            ) : (
              <form onSubmit={submit}>
                <h3>{edit.id ? "עריכת פריט" : "הוספת פריט"}</h3>
                <label className="field">
                  <span>{tab === "fields" ? "שם השדה" : "שם"}</span>
                  <input
                    aria-label="שם פריט ברשימה"
                    required
                    autoFocus
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                {edit.id && (
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={(e) => setActive(e.target.checked)}
                    />
                    פעיל לבחירה
                  </label>
                )}
                <button className="primary" disabled={busy}>
                  <Check size={17} />
                  {busy ? "שומר…" : "שמירת פריט"}
                </button>
                <button
                  className="secondary"
                  type="button"
                  onClick={() => setEdit(null)}
                >
                  ביטול
                </button>
              </form>
            )
          ) : (
            <>
              <Settings size={26} />
              <h3>הרשימות שלך, בשליטתך.</h3>
              <p>
                הוסיפו דגמים, חברות, עובדים, צבעים ושדות נוספים. כל שינוי נשמר
                ביומן התנועות.
              </p>
              {tab === "employees" && (
                <p>יצירת חשבון כניסה לעובד מתבצעת בנפרד מהוספתו לרשימה.</p>
              )}
            </>
          )}
          {(localError || error) && (
            <div className="error" role="alert">
              {localError || error}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
function Options({ items, current, empty = "בחירה" }) {
  return (
    <>
      <option value="">{empty}</option>
      {[...new Set([...(current ? [current] : []), ...items])].map((x) => (
        <option key={x}>{x}</option>
      ))}
    </>
  );
}
export function EditDevice({
  device: d,
  busy,
  error,
  onSubmit,
  onBack,
  onScan,
}) {
  const { companies, employees, models, colors, fields } = useCatalog();
  const [v, setV] = useState({
    ...d,
    barcode: d.barcode || "",
    attributes: d.attributes || {},
    reason: "",
  });
  function set(k, value) {
    setV((x) => ({ ...x, [k]: value }));
  }
  const assigned = ["agent", "trial", "delivered"].includes(v.status);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(v);
      }}
    >
      <div className="eyebrow">הרשאת מנהל</div>
      <h2>עריכת מכשיר</h2>
      <p className="form-intro">
        ניתן לשנות את פרטי המכשיר והשיוכים. סיבת השינוי תישמר בהיסטוריה.
      </p>
      <div className="form-grid">
        <label className="field">
          <span>מספר סידורי *</span>
          <input
            aria-label="עריכת מספר סידורי"
            required
            dir="ltr"
            maxLength={100}
            value={v.serial}
            onChange={(e) => set("serial", e.target.value)}
          />
        </label>
        <label className="field">
          <span>ברקוד נוסף</span>
          <input
            aria-label="ברקוד נוסף"
            dir="ltr"
            maxLength={200}
            value={v.barcode}
            onChange={(e) => set("barcode", e.target.value)}
          />
        </label>
        <label className="field">
          <span>דגם *</span>
          <select
            aria-label="עריכת דגם"
            required
            value={v.model}
            onChange={(e) => set("model", e.target.value)}
          >
            <Options items={models} current={v.model} />
          </select>
        </label>
        <label className="field">
          <span>צד</span>
          <select
            aria-label="עריכת צד"
            value={v.side}
            onChange={(e) => set("side", e.target.value)}
          >
            {["ימין", "שמאל", "לא מוגדר"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>צבע</span>
          <select
            aria-label="עריכת צבע"
            value={v.color || ""}
            onChange={(e) => set("color", e.target.value)}
          >
            <Options items={colors} current={v.color} />
          </select>
        </label>
        <label className="field">
          <span>מצב *</span>
          <select
            aria-label="עריכת מצב"
            required
            value={v.status}
            onChange={(e) => set("status", e.target.value)}
          >
            {Object.entries(statuses).map(([k, x]) => (
              <option value={k} key={k}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>חברה {assigned ? "*" : ""}</span>
          <select
            aria-label="עריכת חברה"
            required={assigned}
            value={v.company}
            onChange={(e) => set("company", e.target.value)}
          >
            <Options items={companies} current={v.company} empty="מלאי משותף" />
          </select>
        </label>
        <label className="field">
          <span>עובד אחראי {assigned ? "*" : ""}</span>
          <select
            aria-label="עריכת עובד"
            required={assigned}
            disabled={!assigned}
            value={assigned ? v.employee : ""}
            onChange={(e) => set("employee", e.target.value)}
          >
            <Options items={employees} current={v.employee} />
          </select>
        </label>
        <label className="field">
          <span>
            לקוח {["trial", "delivered"].includes(v.status) ? "*" : ""}
          </span>
          <input
            aria-label="עריכת לקוח"
            required={["trial", "delivered"].includes(v.status)}
            disabled={!assigned}
            maxLength={100}
            value={assigned ? v.client : ""}
            onChange={(e) => set("client", e.target.value)}
          />
        </label>
        <label className="field">
          <span>תאריך קליטה</span>
          <input
            aria-label="עריכת תאריך קליטה"
            type="date"
            required
            value={v.received}
            onChange={(e) => set("received", e.target.value)}
          />
        </label>
        <label className="field">
          <span>משלוח</span>
          <input
            aria-label="עריכת משלוח"
            maxLength={100}
            value={v.batch || ""}
            onChange={(e) => set("batch", e.target.value)}
          />
        </label>
        {v.status === "trial" && (
          <label className="field">
            <span>סיום ניסיון *</span>
            <input
              aria-label="עריכת סיום ניסיון"
              required
              type="date"
              value={v.trialUntil}
              onChange={(e) => set("trialUntil", e.target.value)}
            />
          </label>
        )}
        {fields.map((f) => (
          <label className="field" key={f.key}>
            <span>{f.name}</span>
            <input
              aria-label={f.name}
              maxLength={1000}
              value={v.attributes[f.key] || ""}
              onChange={(e) =>
                set("attributes", { ...v.attributes, [f.key]: e.target.value })
              }
            />
          </label>
        ))}
      </div>
      <label className="field">
        <span>הערות</span>
        <textarea
          aria-label="עריכת הערות"
          value={v.notes || ""}
          onChange={(e) => set("notes", e.target.value)}
          maxLength={1000}
        />
      </label>
      <label className="field">
        <span>סיבת השינוי *</span>
        <textarea
          aria-label="סיבת עריכת מנהל"
          required
          value={v.reason}
          onChange={(e) => set("reason", e.target.value)}
          placeholder="לדוגמה: תיקון שיוך לפי גיליון המלאי"
          maxLength={1000}
        />
      </label>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="form-footer">
        <button className="primary" disabled={busy}>
          <Check size={18} />
          {busy ? "שומר…" : "שמירת שינויים"}
        </button>
        <button type="button" className="secondary" onClick={onBack}>
          חזרה לכרטיס
        </button>
      </div>
    </form>
  );
}
