import React, { useState, useEffect } from "react";
import { Check, FileSpreadsheet, Pencil, Search, X } from "lucide-react";
import { parseLegacy, legacyTypes, legacyDelivery } from "./legacy.js";
export function LegacyPreview({
  book,
  companies,
  existing,
  production,
  busy,
  onImport,
}) {
  const [corrections, setCorrections] = useState({});
  const result = parseLegacy(book, companies, existing, "order", corrections);
  const [confirmed, setConfirmed] = useState(false),
    [sample, setSample] = useState(false),
    [error, setError] = useState("");
  const blocking = result.issues.filter((i) => i.blocking);
  return (
    <div className="legacy-preview">
      <div className="info-note">
        <FileSpreadsheet size={24} />
        <span>
          הגיליון מכיל הזמנות עם כמויות, ללא מספרים סידוריים. כל שורה תישמר
          כהזמנה עם פרטי הלקוח והחברה. היא לא תתווסף אוטומטית למלאי המחסן.
        </span>
      </div>
      <div className="legacy-summary">
        {result.summaries.map((s) => (
          <div className="panel" key={s.company}>
            <b>{s.company}</b>
            <strong>
              {s.deviceRows}
              <small>הזמנות · {s.units} מכשירים</small>
            </strong>
            <p>{s.other} רשומות נוספות לבדיקה</p>
          </div>
        ))}
      </div>
      <p className="input-help">
        עמודת ״תאריך״ תישמר כתאריך הזמנה. פרטים מקוריים, מחירים ושורות אביזרים
        או ביטול יישמרו בנפרד. עובדים ומספרים סידוריים לא יושלמו ללא מידע.
      </p>
      {result.issues.length > 0 && (
        <details open={blocking.length > 0}>
          <summary>
            {blocking.length} שגיאות ו־
            {result.issues.filter((i) => !i.blocking).length} פרטים לבדיקה
          </summary>
          {result.issues.map((issue, i) => (
            <div key={i}>
              <p>
                {issue.sheet.trim()} · שורה {issue.row}: {issue.message}
              </p>
              {issue.blocking && issue.message.includes("תאריך") && (
                <label className="field">
                  <span>תאריך הזמנה מתוקן</span>
                  <input
                    aria-label={`תיקון תאריך ${issue.sheet.trim()} שורה ${issue.row}`}
                    type="date"
                    value={
                      corrections[`${issue.sheet.trim()}:${issue.row}`] || ""
                    }
                    onChange={(e) => {
                      setCorrections({
                        ...corrections,
                        [`${issue.sheet.trim()}:${issue.row}`]: e.target.value,
                      });
                      setConfirmed(false);
                    }}
                  />
                </label>
              )}
            </div>
          ))}
        </details>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>חברה</th>
              <th>לקוח</th>
              <th>דגם</th>
              <th>כמות</th>
              <th>מחיר כפי שמופיע בגיליון</th>
              <th>תאריך הזמנה</th>
              <th>מסירה</th>
            </tr>
          </thead>
          <tbody>
            {result.records.slice(0, 25).map((r) => (
              <tr key={r.id}>
                <td>{r.company}</td>
                <td>{r.client || "—"}</td>
                <td>{r.model || legacyTypes[r.kind]}</td>
                <td>{r.quantity ?? "—"}</td>
                <td>{r.priceRaw || "—"}</td>
                <td>{r.orderDate || "—"}</td>
                <td>{legacyDelivery[r.delivery]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="input-help">
        מוצגות 25 רשומות ראשונות מתוך {result.records.length}. הייבוא ישמור יחד
        את כל שלוש הלשוניות.
      </p>
      <label className="check-field">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        בדקתי את הנתונים ואת השיוכים לחברות.
      </label>
      {!production && (
        <>
          <div className="info-note">
            ייבוא הנתונים האמיתיים זמין לאחר חיבור מסד הנתונים המשותף. תצוגה
            מקדימה זו אינה שומרת את הקובץ בשרת.
          </div>
          <label className="check-field">
            <input
              type="checkbox"
              checked={sample}
              onChange={(e) => setSample(e.target.checked)}
            />
            זהו קובץ דוגמה בלבד, ללא נתוני לקוחות אמיתיים.
          </label>
        </>
      )}
      <button
        className="primary"
        disabled={
          busy ||
          !confirmed ||
          (!production && !sample) ||
          blocking.length > 0 ||
          result.records.length === 0
        }
        onClick={async () => {
          try {
            await onImport(result.records);
            setConfirmed(false);
          } catch (e) {
            setError(e.message);
          }
        }}
      >
        <Check size={18} />
        {busy ? "שומר…" : `ייבוא ${result.records.length} רשומות מהגיליון`}
      </button>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
export function LegacyRecords({
  records = [],
  initialCompany = "",
  companies,
  employees,
  onEdit,
  busy,
  error,
}) {
  const [search, setSearch] = useState(""),
    [company, setCompany] = useState(initialCompany),
    [edit, setEdit] = useState(null),
    [reason, setReason] = useState("");
  useEffect(() => {
    if (!edit) return;
    const before = document.activeElement;
    const key = (e) => {
      if (e.key === "Escape" && !busy) setEdit(null);
      if (e.key === "Tab") {
        const xs = [
          ...document.querySelectorAll(
            ".device-modal button:not([disabled]),.device-modal input,.device-modal select,.device-modal textarea",
          ),
        ];
        if (e.shiftKey && document.activeElement === xs[0]) {
          e.preventDefault();
          xs.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === xs.at(-1)) {
          e.preventDefault();
          xs[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      before?.focus();
    };
  }, [!!edit, busy]);
  const filtered = records.filter(
    (r) =>
      (!company || r.company === company) &&
      (!search ||
        [
          r.client,
          r.model,
          r.company,
          r.notes,
          r.employee,
          ...(r.serials || []),
        ].some((x) => x?.toLowerCase().includes(search.toLowerCase()))),
  );
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>
            מכשירים ורשומות החברה <span className="count">{records.length}</span>
          </h2>
          <p>
            נתוני הקובץ לפי חברה, לקוח, דגם וכמות. כולל הזמנות, מסירות ורשומות נוספות.
          </p>
        </div>
        <FileSpreadsheet size={23} />
      </div>
      <div className="filterbar">
        <label className="search-box">
          <Search size={18} />
          <input
            aria-label="חיפוש ברשומות"
            placeholder="חיפוש לקוח, דגם או עובד…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="select-box">
          <select
            aria-label="סינון רשומות לפי חברה"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          >
            <option value="">כל החברות</option>
            {companies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>לקוח</th>
              <th>חברה</th>
              <th>דגם / סוג</th>
              <th>כמות</th>
              <th>תאריך הזמנה</th>
              <th>מסירה</th>
              <th>תשלום</th>
              <th>מחיר בגיליון</th>
              <th>עובד</th>
              <th>פרטי מקור</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>{r.client || "—"}</td>
                <td>{r.company}</td>
                <td>{r.model || legacyTypes[r.kind]}</td>
                <td>{r.quantity ?? "—"}</td>
                <td>{r.orderDate || "—"}</td>
                <td>{legacyDelivery[r.delivery]}</td>
                <td>{r.payment || "—"}</td>
                <td>{r.priceRaw || "—"}</td>
                <td>{r.employee || "טרם שויך"}</td>
                <td>
                  <details className="source-details">
                    <summary>כל הפרמטרים</summary>
                    <div>
                      <b>עיר</b>
                      <span>{r.city || "—"}</span>
                    </div>
                    <div>
                      <b>הערות</b>
                      <span>{r.notes || "—"}</span>
                    </div>
                    {Object.entries(r.source?.values || {}).map(([k, v]) => (
                      <div key={k}>
                        <b>{k}</b>
                        <span>{String(v ?? "—")}</span>
                      </div>
                    ))}
                    {r.source?.dateCorrection && (
                      <div>
                        <b>תיקון תאריך הזמנה</b>
                        <span>
                          {r.source.dateCorrection.original} ←{" "}
                          {r.source.dateCorrection.corrected}
                        </span>
                      </div>
                    )}
                  </details>
                </td>
                <td>
                  {onEdit && (
                    <button
                      className="icon-btn"
                      aria-label={`עריכת רשומה ${r.sourceKey}`}
                      onClick={() => {
                        setEdit({ ...r });
                        setReason("");
                      }}
                    >
                      <Pencil size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!records.length && (
          <div className="empty">
            <FileSpreadsheet size={32} />
            <h3>טרם יובאו רשומות מהגיליון</h3>
            <p>
              לאחר חיבור מסד נתונים, אפשר לייבא את קובץ המלאי דרך ״ייבוא
              מגיליון״.
            </p>
          </div>
        )}
      </div>
      {edit && (
        <div className="modal-overlay">
          <form
            className="modal device-modal"
            role="dialog"
            aria-modal="true"
            aria-label="עריכת רשומה מהגיליון"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await onEdit(edit, reason);
                setEdit(null);
              } catch {}
            }}
          >
            <button
              type="button"
              className="close-modal"
              aria-label="סגירת עריכת רשומה"
              onClick={() => setEdit(null)}
            >
              <X />
            </button>
            <h2>עריכת רשומה מהגיליון</h2>
            <p className="form-intro">
              {edit.source.sheet} · שורה {edit.source.row}
            </p>
            <div className="form-grid">
              {[
                ["client", "שם לקוח"],
                ["model", "דגם"],
                ["color", "צבע"],
                ["city", "עיר מגורים"],
                ["priceRaw", "מחיר כפי שמופיע בגיליון"],
                ["payment", "מצב תשלום"],
              ].map(([k, label]) => (
                <label className="field" key={k}>
                  <span>{label}</span>
                  <input
                    aria-label={label}
                    value={edit[k] || ""}
                    maxLength={200}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        [k]: e.target.value,
                        ...(k === "priceRaw"
                          ? {
                              price:
                                e.target.value.trim() &&
                                Number.isFinite(Number(e.target.value))
                                  ? Number(e.target.value)
                                  : null,
                            }
                          : {}),
                      })
                    }
                  />
                </label>
              ))}
              <label className="field">
                <span>כמות</span>
                <input
                  aria-label="כמות ברשומה"
                  type="number"
                  min="1"
                  value={edit.quantity ?? ""}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      quantity: e.target.value ? +e.target.value : null,
                    })
                  }
                />
              </label>
              <label className="field">
                <span>תאריך הזמנה</span>
                <input
                  aria-label="תאריך הזמנה"
                  type="date"
                  value={edit.orderDate || ""}
                  onChange={(e) =>
                    setEdit({ ...edit, orderDate: e.target.value })
                  }
                />
              </label>
              <label className="field">
                <span>חברה</span>
                <select
                  aria-label="חברה ברשומה"
                  value={edit.company}
                  onChange={(e) =>
                    setEdit({ ...edit, company: e.target.value })
                  }
                >
                  {companies.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>עובד אחראי</span>
                <select
                  aria-label="עובד ברשומה"
                  value={edit.employee || ""}
                  onChange={(e) =>
                    setEdit({ ...edit, employee: e.target.value })
                  }
                >
                  <option value="">טרם שויך</option>
                  {employees.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>מצב מסירה</span>
                <select
                  aria-label="מצב מסירה ברשומה"
                  value={edit.delivery}
                  onChange={(e) =>
                    setEdit({ ...edit, delivery: e.target.value })
                  }
                >
                  {Object.entries(legacyDelivery).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>סוג רשומה</span>
                <select
                  aria-label="סוג רשומה"
                  value={edit.kind}
                  onChange={(e) => setEdit({ ...edit, kind: e.target.value })}
                >
                  {Object.entries(legacyTypes).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span>הערות</span>
              <textarea
                aria-label="הערות רשומה"
                value={edit.notes}
                onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
              />
            </label>
            <label className="field">
              <span>סיבת השינוי *</span>
              <input
                aria-label="סיבת שינוי רשומה"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={1000}
              />
            </label>
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <button className="primary" disabled={busy}>
              <Check size={18} />
              שמירת רשומה
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
