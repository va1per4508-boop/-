import React, { useState } from "react";
import { FileUp, Check, AlertCircle, Table2 } from "lucide-react";
import {
  importKeys,
  readWorkbook,
  guessMapping,
  mapRows,
  stageImport,
} from "./importer";
import { useCatalog, normalizeCatalog } from "./catalog";
import { statuses } from "./data";
import { isLegacyWorkbook } from "./legacy.js";
import { LegacyPreview } from "./Legacy";
export default function ImportConsole({
  data,
  busy,
  onImport,
  error,
  production,
  onLegacyImport,
}) {
  const { companies } = useCatalog();
  const [book, setBook] = useState([]),
    [sheetIndex, setSheetIndex] = useState(0),
    [headerRow, setHeaderRow] = useState(0),
    [mapping, setMapping] = useState({}),
    [defaults, setDefaults] = useState({ company: "", status: "" }),
    [loading, setLoading] = useState(false),
    [localError, setLocalError] = useState(""),
    [preview, setPreview] = useState(null),
    [confirmed, setConfirmed] = useState(false),
    [sample, setSample] = useState(false),
    [filename, setFilename] = useState("");
  const sheet = book[sheetIndex],
    headers = sheet?.rows[headerRow] || [];
  function configure(s, i = 0) {
    setSheetIndex(i);
    const h = s.rows.findIndex((r) => r.some(Boolean));
    setHeaderRow(h);
    setMapping(guessMapping(s.rows[h]));
    setPreview(null);
    setConfirmed(false);
  }
  async function read(file) {
    if (!file) return;
    setLoading(true);
    setLocalError("");
    try {
      const sheets = await readWorkbook(file);
      if (!sheets.length) throw new Error("הקובץ אינו מכיל נתונים");
      setBook(sheets);
      setFilename(file.name);
      configure(sheets[0]);
    } catch (e) {
      setLocalError(e.message);
    } finally {
      setLoading(false);
    }
  }
  const invalidate = () => {
    setPreview(null);
    setConfirmed(false);
  };
  const staged = preview
    ? stageImport(
        { ...data, catalog: normalizeCatalog(data) },
        preview.items,
        sheet.name,
        headers,
        mapping,
      )
    : null;
  const added = staged
    ? Object.entries(staged).flatMap(([kind, list]) =>
        list
          .filter(
            (x) => !normalizeCatalog(data)[kind].some((o) => o.id === x.id),
          )
          .map((x) => x.name),
      )
    : [];
  const legacyMode = isLegacyWorkbook(book);
  return (
    <section className="panel import-panel">
      <div className="panel-head">
        <div>
          <h2>ייבוא מהגיליון הקיים</h2>
          <p>כל עמודה נשמרת. השיוכים מוצגים לבדיקה לפני שמירת הנתונים.</p>
        </div>
        <span className="square teal">
          <FileUp size={25} />
        </span>
      </div>
      <div className="form-body">
        <div className="upload-area">
          <FileUp size={30} />
          <div>
            <b>קובץ Excel או CSV</b>
            <p>מ־Google Sheets: קובץ ← הורדה ← Microsoft Excel</p>
            <input
              aria-label="בחירת קובץ מלאי"
              type="file"
              accept=".xlsx,.csv"
              disabled={loading || busy}
              onChange={(e) => read(e.target.files[0])}
            />
          </div>
        </div>
        {loading && <p role="status">קורא את הקובץ…</p>}
        {sheet && !legacyMode && (
          <>
            <div className="form-grid">
              <label className="field">
                <span>לשונית בגיליון</span>
                <select
                  aria-label="בחירת לשונית לייבוא"
                  value={sheetIndex}
                  onChange={(e) =>
                    configure(book[+e.target.value], +e.target.value)
                  }
                >
                  {book.map((s, i) => (
                    <option key={i} value={i}>
                      {s.name} · {s.rows.length} שורות
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>שורת הכותרות</span>
                <input
                  aria-label="שורת כותרות"
                  type="number"
                  min="1"
                  max={sheet.rows.length}
                  value={headerRow + 1}
                  onChange={(e) => {
                    const row = +e.target.value - 1;
                    setHeaderRow(row);
                    setMapping(guessMapping(sheet.rows[row] || []));
                    invalidate();
                  }}
                />
              </label>
              <label className="field">
                <span>חברה כשלא מצוינת בשורה</span>
                <select
                  aria-label="חברת ברירת מחדל לייבוא"
                  value={defaults.company}
                  onChange={(e) => {
                    setDefaults({ ...defaults, company: e.target.value });
                    invalidate();
                  }}
                >
                  <option value="">ללא שיוך</option>
                  {companies.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>מצב כשלא מצוין בשורה *</span>
                <select
                  aria-label="מצב ברירת מחדל לייבוא"
                  value={defaults.status}
                  onChange={(e) => {
                    setDefaults({ ...defaults, status: e.target.value });
                    invalidate();
                  }}
                >
                  <option value="">בחירת מצב</option>
                  {Object.entries(statuses).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <h3>התאמת עמודות</h3>
            <p className="input-help">
              עמודות שלא ישויכו כאן יישמרו כשדות נוספים בכרטיס המכשיר. תאריכים
              שלא צוינו יישארו ריקים.
            </p>
            <div className="mapping-grid">
              {importKeys.map(([key, label, required]) => (
                <label className="field" key={key}>
                  <span>
                    {label}
                    {required ? " *" : ""}
                  </span>
                  <select
                    aria-label={`עמודת ${label}`}
                    value={mapping[key] ?? "-1"}
                    onChange={(e) => {
                      setMapping({ ...mapping, [key]: e.target.value });
                      invalidate();
                    }}
                  >
                    <option value="-1">לא קיימת / ברירת מחדל</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>
                        {i + 1}. {h || "ללא כותרת"}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <button
              className="secondary"
              onClick={() => {
                setPreview(
                  mapRows({
                    sheet,
                    headerRow,
                    mapping,
                    defaults,
                    existing: data.devices,
                  }),
                );
                setConfirmed(false);
              }}
            >
              <Table2 size={18} />
              בדיקת נתונים ותצוגה מקדימה
            </button>
            {preview && (
              <div className="import-preview">
                <div className="preview-summary">
                  <b>{preview.items.length} מכשירים תקינים</b>
                  <span>{preview.errors.length} שגיאות</span>
                  <span>{preview.warnings.length} הערות</span>
                </div>
                {preview.errors.length > 0 && (
                  <div className="error-list" role="alert">
                    {preview.errors.map((e, i) => (
                      <p key={i}>
                        שורה {e.row}: {e.message}
                      </p>
                    ))}
                    <b>לא ייובא אף מכשיר עד לתיקון כל השגיאות.</b>
                  </div>
                )}
                {preview.warnings.length > 0 && (
                  <details>
                    <summary>פרטים חסרים לבדיקה</summary>
                    {preview.warnings.map((w, i) => (
                      <p key={i}>
                        שורה {w.row}: {w.message}
                      </p>
                    ))}
                  </details>
                )}
                {added.length > 0 && (
                  <div className="info-note">
                    <AlertCircle size={19} />
                    <span>
                      ערכים חדשים שיתווספו לרשימות:{" "}
                      {[...new Set(added)].join(" · ")}
                    </span>
                  </div>
                )}
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>מספר סידורי</th>
                        <th>דגם</th>
                        <th>חברה</th>
                        <th>עובד</th>
                        <th>לקוח</th>
                        <th>מצב</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.items.slice(0, 30).map((d) => (
                        <tr key={d.id}>
                          <td dir="ltr">{d.serial}</td>
                          <td dir="ltr">{d.model}</td>
                          <td>{d.company || "—"}</td>
                          <td>{d.employee || "—"}</td>
                          <td>{d.client || "—"}</td>
                          <td>{statuses[d.status]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="input-help">
                  מוצגות עד 30 שורות. כל {preview.items.length} המכשירים התקינים
                  יישמרו יחד, לאחר האישור.
                </p>
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  בדקתי את השיוכים ואת הערכים החדשים. הנתונים נכונים לייבוא.
                </label>
                {!production && (
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={sample}
                      onChange={(e) => setSample(e.target.checked)}
                    />
                    זהו קובץ דוגמה ללא נתונים אמיתיים. אני מבין שהשמירה מקומית
                    בלבד.
                  </label>
                )}
                <button
                  className="primary"
                  disabled={
                    busy ||
                    !confirmed ||
                    preview.errors.length > 0 ||
                    preview.items.length === 0 ||
                    (!production && !sample)
                  }
                  onClick={async () => {
                    try {
                      await onImport(preview.items, staged, {
                        file: filename,
                        sheet: sheet.name,
                      });
                      setPreview(null);
                      setBook([]);
                    } catch (e) {
                      setLocalError(e.message);
                    }
                  }}
                >
                  <Check size={18} />
                  {busy
                    ? "מייבא…"
                    : `אישור וייבוא ${preview.items.length} מכשירים`}
                </button>
              </div>
            )}
          </>
        )}
        {legacyMode && (
          <LegacyPreview
            book={book}
            companies={companies}
            existing={data.legacy || []}
            production={production}
            busy={busy}
            onImport={async (records) => {
              await onLegacyImport(records);
              setBook([]);
            }}
          />
        )}
        {(localError || error) && (
          <div className="error" role="alert">
            {localError || error}
          </div>
        )}
      </div>
    </section>
  );
}
