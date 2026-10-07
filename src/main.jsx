import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  Package,
  PackagePlus,
  Users,
  Building2,
  History,
  Search,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  SlidersHorizontal,
  ChevronLeft,
  X,
  Check,
  Download,
  RotateCcw,
  Box,
  AudioLines,
  LogOut,
  Menu,
  ClipboardCheck,
  Wrench,
  AlertCircle,
  ChevronDown,
  Truck,
  UserRound,
  RefreshCw,
  ScanBarcode,
  Settings,
  FileUp,
  Pencil,
} from "lucide-react";
import { statuses, actions, allowed, seed } from "./data";
import {
  backend,
  loadDemo,
  saveDemo,
  fetchRemote,
  addRemote,
  moveRemote,
  moveDemo,
  editRemote,
  catalogRemote,
  importRemote,
  importLegacyRemote,
  editLegacyRemote,
} from "./store";
import {
  CatalogContext,
  defaultCatalog,
  normalizeCatalog,
  catalogLists,
  useCatalog,
  changeCatalog,
  editDemo,
} from "./catalog";
import Scanner from "./Scanner";
import { AdminSettings, EditDevice } from "./Admin";
import ImportConsole from "./ImportConsole";
import { LegacyRecords } from "./Legacy";
import "./style.css";
const nav = [
  ["overview", "תמונת מצב", LayoutDashboard],
  ["inventory", "כל המכשירים", Package],
  ["receive", "קליטת מלאי", PackagePlus],
  ["team", "מלאי עובדים", Users],
  ["companies", "חברות", Building2],
  ["returns", "החזרות ותיקונים", RotateCcw],
  ["history", "יומן תנועות", History],
  ["import", "ייבוא מגיליון", FileUp],
  ["legacy", "רשומות מהגיליון", History],
  ["settings", "ניהול ועריכה", Settings],
];
const fmt = (d) =>
  !d || Number.isNaN(new Date(d).getTime())
    ? "—"
    : new Intl.DateTimeFormat("he-IL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "Asia/Jerusalem",
      }).format(new Date(d));
const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const shortCompany = (c) => c?.replace(" מכשירי שמיעה", "") || "טרם שויך";
function App() {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [session, setSession] = useState(null),
    [authReady, setAuthReady] = useState(!backend),
    [profile, setProfile] = useState(null),
    [page, setPage] = useState("overview"),
    [search, setSearch] = useState(""),
    [company, setCompany] = useState(""),
    [status, setStatus] = useState(""),
    [employee, setEmployee] = useState(""),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [mobile, setMobile] = useState(false),
    [scanner, setScanner] = useState(null),
    [passwordDone, setPasswordDone] = useState(false);
  useEffect(() => {
    if (!backend) {
      try {
        const loaded = loadDemo();
        setData({ ...loaded, catalog: normalizeCatalog(loaded) });
      } catch (e) {
        setError(e.message);
      }
      return;
    }
    const link = new URLSearchParams(location.search);
    const tokenHash = link.get("token_hash");
    if (tokenHash && link.get("type") === "recovery") {
      history.replaceState(null, "", location.pathname + "?setup=password");
      backend.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" }).then(({ data, error }) => {
        setSession(data.session);
        if (error) setError("קישור הכניסה פג תוקף או כבר נוצל. בקשו קישור חדש.");
        setAuthReady(true);
      });
    } else {
      backend.auth.getSession().then(({ data }) => {
        setSession(data.session);
        setAuthReady(true);
      });
    }
    const {
      data: { subscription },
    } = backend.auth.onAuthStateChange((_, s) => {
      setData(null);
      setProfile(null);
      setPage("overview");
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);
  async function refresh() {
    try {
      setData(await fetchRemote());
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }
  useEffect(() => {
    if (backend && session) {
      refresh();
      backend
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single()
        .then(({ data }) => setProfile(data));
      const timer = setInterval(refresh, 30000);
      return () => clearInterval(timer);
    }
  }, [session]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  useEffect(() => {
    if (!modal) return;
    const before = document.activeElement;
    function key(e) {
      if (e.key === "Escape" && !busy) setModal(null);
      if (e.key === "Tab") {
        const nodes = [
          ...document.querySelectorAll(
            ".modal button:not([disabled]),.modal input,.modal select,.modal textarea",
          ),
        ];
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      before?.focus();
    };
  }, [modal, busy]);
  const admin = !backend || profile?.role === "admin";
  function persist(next) {
    if (!backend) saveDemo(next);
    setData(next);
  }
  async function commit(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
      setModal(null);
    } catch (e) {
      setError(e.message || "הפעולה לא נשמרה. נסו שוב.");
    } finally {
      setBusy(false);
    }
  }
  function navigate(p, filters = {}) {
    setPage(p);
    setSearch("");
    setStatus(filters.status || "");
    setEmployee(filters.employee || "");
    setCompany(filters.company || "");
    setMobile(false);
    setError("");
  }
  if (!authReady) return <div className="loading">טוען…</div>;
  if (backend && !session) return <Login onError={setError} error={error} />;
  if (backend && session && new URLSearchParams(location.search).get("setup") === "password" && !passwordDone) return <SetPassword onDone={() => { history.replaceState(null,"",location.pathname);setPasswordDone(true); }} />;
  if (!data)
    return (
      <div className="loading">
        <AudioLines size={40} />
        <h2>מלאי</h2>
        <p>{error || "טוען את המלאי…"}</p>
        {error && <button onClick={refresh}>ניסיון נוסף</button>}
      </div>
    );
  const catalog = normalizeCatalog(data);
  const { companies, employees } = catalogLists(catalog, true);
  const active = data.devices.filter((d) => d.status !== "supplier");
  const counts = Object.fromEntries(
    Object.keys(statuses).map((s) => [
      s,
      data.devices.filter((d) => d.status === s).length,
    ]),
  );
  const filters = (d) =>
    (!search ||
      [
        d.serial,
        d.barcode,
        d.model,
        d.employee,
        d.client,
        d.company,
        d.batch,
        ...Object.values(d.attributes || {}),
      ].some((v) => v?.toLowerCase().includes(search.toLowerCase()))) &&
    (!company || d.company === company) &&
    (!status || d.status === status) &&
    (!employee || d.employee === employee);
  const filtered = data.devices
    .filter(filters)
    .filter((d) =>
      page === "returns" ? ["inspection", "repair"].includes(d.status) : true,
    );
  const recent = [...data.events].sort(
    (a, b) => new Date(b.at) - new Date(a.at),
  );
  function exportCSV() {
    const rows = [
      [
        "מספר סידורי",
        "דגם",
        "צד",
        "צבע",
        "מצב",
        "חברה",
        "עובד",
        "לקוח",
        "תאריך קליטה",
        "סיום ניסיון",
        "ברקוד",
        ...catalog.fields.map((f) => f.name),
      ],
      ...filtered.map((d) => [
        d.serial,
        d.model,
        d.side,
        d.color,
        statuses[d.status],
        d.company,
        d.employee,
        d.client,
        d.received,
        d.trialUntil,
        d.barcode,
        ...catalog.fields.map((f) => d.attributes?.[f.key] || ""),
      ]),
    ];
    const csv =
      "\uFEFF" +
      rows
        .map((r) =>
          r
            .map(
              (v) =>
                '"' +
                String(v || "")
                  .replace(/^[=+@-]/, "'$&")
                  .replaceAll('"', '""') +
                '"',
            )
            .join(","),
        )
        .join("\r\n");
    download(csv, "מלאי.csv", "text/csv;charset=utf-8");
  }
  function backup() {
    download(
      JSON.stringify(data, null, 2),
      "inventory-backup.json",
      "application/json",
    );
  }
  return (
    <CatalogContext.Provider value={catalogLists(catalog)}>
      <div className="app">
        <aside className={"sidebar " + (mobile ? "open" : "")}>
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              navigate("overview");
            }}
          >
            <span className="brand-icon">
              <AudioLines size={28} />
            </span>
            <span>
              מלאי<small>ניהול מכשירי שמיעה</small>
            </span>
          </a>
          <div className="workspace">
            <span className="workspace-icon">
              <Building2 size={19} />
            </span>
            <div>
              קבוצת חברות השמיעה
              <small>{companies.length} חברות · מחסן משותף</small>
            </div>
          </div>
          <div className="nav-label">סביבת עבודה</div>
          <nav>
            {nav
              .filter(
                ([id]) =>
                  admin ||
                  !["receive", "companies", "settings", "import"].includes(id),
              )
              .map(([id, title, Icon]) => (
                <button
                  key={id}
                  className={page === id ? "selected" : ""}
                  onClick={() => navigate(id)}
                >
                  <Icon size={20} />
                  <span>{title}</span>
                  {id === "returns" && (
                    <em>{counts.inspection + counts.repair}</em>
                  )}
                </button>
              ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="supplier">
              <span>ספק ראשי</span>
              <strong>REXTON</strong>
              <small>מכשירי שמיעה</small>
            </div>
            <div className="user">
              <span className="avatar dark">{admin ? "מ" : "ע"}</span>
              <div>
                {profile?.name || "מנהל מערכת"}
                <small>
                  {backend ? (admin ? "מנהל" : "עובד שטח") : "סביבת הדגמה"}
                </small>
              </div>
              {backend && (
                <button
                  title="יציאה"
                  aria-label="יציאה"
                  onClick={() => backend.auth.signOut()}
                >
                  <LogOut size={18} />
                </button>
              )}
            </div>
          </div>
        </aside>
        {mobile && (
          <div className="backdrop" onClick={() => setMobile(false)} />
        )}
        <div className="shell">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="mobile-toggle"
                aria-label="פתיחת תפריט"
                onClick={() => setMobile(true)}
              >
                <Menu />
              </button>
              <span>סביבת עבודה</span>
              <ChevronLeft size={15} />
              <b>{nav.find((n) => n[0] === page)?.[1]}</b>
            </div>
            <div className="top-actions">
              <span className="mode-pill">
                {backend ? "סביבת עבודה משותפת" : "הדגמה אינטראקטיבית"}
              </span>
              <span className="header-date">{fmt(new Date())}</span>
              <button
                className="icon-btn"
                aria-label="רענון נתונים"
                onClick={() =>
                  backend ? refresh() : setToast("הנתונים מעודכנים בדפדפן זה")
                }
              >
                <RefreshCw size={18} />
              </button>
            </div>
          </header>
          <main>
            <div className="page-heading">
              <div>
                <div className="eyebrow">REXTON / INVENTORY</div>
                <h1>{nav.find((n) => n[0] === page)?.[1]}</h1>
                <p>
                  {
                    {
                      overview: "כל מכשיר, בכל שלב. תמונה אחת של המלאי שלך.",
                      inventory: "איתור ומעקב אחר כל מכשיר לפי מספר סידורי.",
                      receive: "קליטת משלוח מהספק אל המחסן המשותף.",
                      team: "העובדים שלך — מלאי משותף ומעקב אישי.",
                      companies:
                        "חלוקת המלאי בין החברות, ללא תלות בעובד האחראי.",
                      returns:
                        "מכשירים שהוחזרו עוברים בדיקה לפני חזרה למלאי הזמין.",
                      history:
                        "כל קליטה, העברה ומסירה נשמרות בהיסטוריית המכשיר.",
                      settings:
                        "ניהול דגמים, חברות, עובדים ופרמטרים — בהרשאת מנהל.",
                      legacy:
                        "היסטוריית הזמנות ומסירות עם הנתונים המקוריים מהגיליון.",
                      import:
                        "העברת המלאי הקיים עם כל הפרטים והשיוכים מהגיליון.",
                    }[page]
                  }
                </p>
              </div>
              <div className="heading-actions">
                <button
                  className="secondary"
                  onClick={() =>
                    setScanner({
                      onResult: (value) => {
                        const device = data.devices.find((d) =>
                          [d.serial, d.barcode].some(
                            (s) => s?.toLowerCase() === value.toLowerCase(),
                          ),
                        );
                        setScanner(null);
                        if (device) setModal({ kind: "detail", device });
                        else {
                          navigate("inventory");
                          setSearch(value);
                          setToast("הקוד לא נמצא במלאי הנגיש לך");
                        }
                      },
                    })
                  }
                >
                  <ScanBarcode size={18} />
                  סריקת ברקוד
                </button>
                {["overview", "inventory"].includes(page) && (
                  <button className="secondary" onClick={exportCSV}>
                    <Download size={17} />
                    ייצוא מלאי
                  </button>
                )}
                {admin && page !== "receive" && (
                  <button
                    className="primary"
                    onClick={() => navigate("receive")}
                  >
                    <Plus size={18} />
                    קליטת מלאי
                  </button>
                )}
              </div>
            </div>
            {!backend && (
              <div className="demo-note">
                <Box size={16} />
                <span>
                  <b>נתוני הדגמה</b> · השינויים נשמרים בדפדפן הזה בלבד. אין
                  להזין פרטי לקוחות אמיתיים.
                </span>
                <button onClick={backup}>הורדת גיבוי</button>
              </div>
            )}
            {error && (
              <div className="error" role="alert">
                <AlertCircle size={18} />
                {error}
                <button aria-label="סגירת שגיאה" onClick={() => setError("")}>
                  <X size={16} />
                </button>
              </div>
            )}
            {page === "overview" && (
              <>
                <section className="metrics">
                  {[
                    [
                      active.length,
                      "מכשירים במערכת",
                      "בכל החברות והשלבים",
                      Package,
                      "all",
                    ],
                    [
                      counts.warehouse,
                      "זמינים במחסן",
                      "מוכנים להעברה לעובד",
                      Box,
                      "warehouse",
                    ],
                    [
                      counts.agent,
                      "אצל עובדי השטח",
                      "ממתינים למסירה ללקוח",
                      Users,
                      "agent",
                    ],
                    [
                      counts.trial,
                      "מכשירים בניסיון",
                      "מעקב עד למסירה או החזרה",
                      ClipboardCheck,
                      "trial",
                    ],
                  ].map(([n, label, sub, Icon, s], i) => (
                    <button
                      key={s}
                      className={"metric " + (i === 0 ? "main-metric" : "")}
                      onClick={() =>
                        navigate("inventory", { status: s === "all" ? "" : s })
                      }
                    >
                      <span className="metric-top">
                        {label}
                        <Icon size={20} />
                      </span>
                      <strong>
                        {n}
                        <small>מכשירים</small>
                      </strong>
                      <span className="metric-bottom">
                        {sub}
                        <ChevronLeft size={15} />
                      </span>
                    </button>
                  ))}
                </section>
                <section className="dashboard-middle">
                  <div className="panel distribution">
                    <div className="panel-head">
                      <div>
                        <h2>מלאי לפי חברה</h2>
                        <p>שיוך המכשירים לאורך כל התהליך</p>
                      </div>
                      <button
                        className="text-btn"
                        onClick={() => navigate("companies")}
                      >
                        כל החברות
                        <ChevronLeft size={15} />
                      </button>
                    </div>
                    <div className="distribution-rows">
                      {companies.map((c, i) => {
                        const ds = active.filter((d) => d.company === c);
                        return (
                          <button
                            className="company-row"
                            key={c}
                            onClick={() =>
                              navigate("inventory", { company: c })
                            }
                          >
                            <span className={"company-logo color-" + i}>
                              {c[0]}
                            </span>
                            <div className="company-data">
                              <div>
                                <b>{shortCompany(c)}</b>
                                <span>{ds.length} מכשירים</span>
                              </div>
                              <div className="segmented">
                                {[
                                  "warehouse",
                                  "agent",
                                  "trial",
                                  "delivered",
                                  "inspection",
                                  "repair",
                                ].map((s) => (
                                  <span
                                    key={s}
                                    title={`${statuses[s]}: ${ds.filter((d) => d.status === s).length}`}
                                    className={"seg " + s}
                                    style={{
                                      flex:
                                        ds.filter((d) => d.status === s)
                                          .length || 0,
                                      display: ds.some((d) => d.status === s)
                                        ? "block"
                                        : "none",
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                            <ChevronLeft size={15} />
                          </button>
                        );
                      })}
                    </div>
                    <div className="legend">
                      {["warehouse", "agent", "trial", "delivered"].map((s) => (
                        <span key={s}>
                          <i className={s} />
                          {statuses[s]}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="panel attention">
                    <div className="panel-head">
                      <div>
                        <h2>דורש תשומת לב</h2>
                        <p>פעולות שכדאי להשלים</p>
                      </div>
                      <span className="attention-icon">
                        <AlertCircle size={20} />
                      </span>
                    </div>
                    <button
                      className="attention-row"
                      onClick={() => navigate("returns")}
                    >
                      <span className="square amber">
                        <ClipboardCheck size={21} />
                      </span>
                      <div>
                        <b>{counts.inspection} מכשירים ממתינים לבדיקה</b>
                        <small>אישור תקינות וחזרה למלאי</small>
                      </div>
                      <ChevronLeft size={17} />
                    </button>
                    <button
                      className="attention-row"
                      onClick={() => navigate("inventory", { status: "trial" })}
                    >
                      <span className="square purple">
                        <History size={21} />
                      </span>
                      <div>
                        <b>
                          {
                            data.devices.filter(
                              (d) =>
                                d.status === "trial" &&
                                d.trialUntil &&
                                new Date(d.trialUntil) < new Date(),
                            ).length
                          }{" "}
                          תקופות ניסיון הסתיימו
                        </b>
                        <small>עדכון מסירה או החזרה</small>
                      </div>
                      <ChevronLeft size={17} />
                    </button>
                    <button
                      className="attention-row"
                      onClick={() =>
                        navigate("inventory", { status: "repair" })
                      }
                    >
                      <span className="square blue">
                        <Wrench size={21} />
                      </span>
                      <div>
                        <b>{counts.repair} מכשירים בתיקון</b>
                        <small>מעקב אחר מכשירים בשירות</small>
                      </div>
                      <ChevronLeft size={17} />
                    </button>
                  </div>
                </section>
                <section className="panel inventory-panel">
                  <div className="panel-head">
                    <div>
                      <h2>מבט על המלאי</h2>
                      <p>המכשירים שלך, במקום אחד</p>
                    </div>
                    <button
                      className="text-btn"
                      onClick={() => navigate("inventory")}
                    >
                      לכל המכשירים
                      <ChevronLeft size={15} />
                    </button>
                  </div>
                  <FilterBar
                    {...{
                      search,
                      setSearch,
                      company,
                      setCompany,
                      status,
                      setStatus,
                    }}
                  />
                  <DeviceTable
                    devices={filtered.slice(0, 6)}
                    onOpen={(d) => setModal({ kind: "detail", device: d })}
                  />
                  <div className="table-footer">
                    מציג {Math.min(filtered.length, 6)} מתוך {filtered.length}{" "}
                    מכשירים<span>לחיצה על מכשיר פותחת את הכרטיס שלו</span>
                  </div>
                </section>
                <div className="recent-strip">
                  <h3>תנועות אחרונות</h3>
                  {recent.slice(0, 3).map((e) => (
                    <button
                      key={e.id}
                      onClick={() => {
                        const d = data.devices.find((d) => d.id === e.deviceId);
                        if (d) setModal({ kind: "detail", device: d });
                      }}
                    >
                      <span className="movement-icon">
                        <ArrowDownLeft size={17} />
                      </span>
                      <div>
                        <b>{e.type}</b>
                        <small dir="ltr">{e.serial}</small>
                      </div>
                      <span>{fmt(e.at)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {["inventory", "returns"].includes(page) && (
              <section className="panel inventory-panel">
                <div className="panel-head">
                  <h2>
                    {page === "returns"
                      ? "מעקב החזרות ותיקונים"
                      : "רשימת מכשירים"}{" "}
                    <span className="count">{filtered.length}</span>
                  </h2>
                  <button className="text-btn" onClick={exportCSV}>
                    <Download size={16} />
                    ייצוא CSV
                  </button>
                </div>
                <FilterBar
                  {...{
                    search,
                    setSearch,
                    company,
                    setCompany,
                    status,
                    setStatus,
                    employee,
                    setEmployee,
                  }}
                />
                <DeviceTable
                  devices={filtered}
                  onOpen={(d) => setModal({ kind: "detail", device: d })}
                />
                <div className="table-footer">
                  {filtered.length} מכשירים תואמים לסינון
                  <button
                    className="text-btn"
                    onClick={() => {
                      setSearch("");
                      setStatus("");
                      setCompany("");
                      setEmployee("");
                    }}
                  >
                    ניקוי סינון
                  </button>
                </div>
              </section>
            )}
            {page === "receive" && (
              <Receive
                busy={busy}
                onScan={(callback) =>
                  setScanner({
                    onResult: (value) => {
                      setScanner(null);
                      callback(value);
                    },
                  })
                }
                onSubmit={(items) =>
                  commit(async () => {
                    if (backend) persist(await addRemote(items));
                    else {
                      const duplicates = items.filter((i) =>
                        data.devices.some(
                          (d) =>
                            d.serial.toLowerCase() === i.serial.toLowerCase(),
                        ),
                      );
                      if (duplicates.length)
                        throw new Error(
                          "מספר סידורי כבר קיים: " +
                            duplicates.map((d) => d.serial).join(", "),
                        );
                      const events = items.map((d) => ({
                        id: crypto.randomUUID(),
                        deviceId: d.id,
                        serial: d.serial,
                        type: "קליטה מהספק",
                        at: new Date().toISOString(),
                        actor: "מנהל הדגמה",
                        detail: `${d.model} · משלוח ${d.batch}`,
                      }));
                      persist({
                        ...data,
                        devices: [...items, ...data.devices],
                        events: [...events, ...data.events],
                      });
                    }
                    setToast(`${items.length} מכשירים נקלטו במחסן`);
                    navigate("inventory");
                  })
                }
              />
            )}
            {page === "settings" && admin && (
              <AdminSettings
                data={data}
                busy={busy}
                error={error}
                onChange={async (kind, operation, item) => {
                  setBusy(true);
                  setError("");
                  try {
                    persist(
                      backend
                        ? await catalogRemote(data, kind, operation, item)
                        : changeCatalog(data, kind, operation, item),
                    );
                    setToast("הרשימה עודכנה והשיוכים נשמרו");
                  } catch (e) {
                    setError(e.message);
                    throw e;
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            )}
            {page === "import" && admin && (
              <ImportConsole
                data={data}
                busy={busy}
                error={error}
                production={!!backend}
                onLegacyImport={async (records) => {
                  setBusy(true);
                  try {
                    if (backend)
                      persist(
                        await importLegacyRemote(records, data.catalogVersion),
                      );
                    else {
                      const seen = new Set(
                        (data.legacy || []).map((r) => r.sourceKey),
                      );
                      if (records.some((r) => seen.has(r.sourceKey)))
                        throw new Error("רשומה כבר קיימת");
                      const catalog = structuredClone(normalizeCatalog(data));
                      for (const r of records)
                        if (
                          r.model &&
                          !catalog.models.some((m) => m.name === r.model)
                        )
                          catalog.models.push({
                            id: crypto.randomUUID(),
                            name: r.model,
                            active: true,
                          });
                      persist({
                        ...data,
                        catalog,
                        legacy: [...(data.legacy || []), ...records],
                        events: [
                          {
                            id: crypto.randomUUID(),
                            type: "ייבוא רשומות מהגיליון",
                            at: new Date().toISOString(),
                            actor: "מנהל הדגמה",
                            detail: `${records.length} רשומות`,
                          },
                          ...data.events,
                        ],
                      });
                    }
                    setToast(`${records.length} רשומות יובאו`);
                  } catch (e) {
                    setError(e.message);
                    throw e;
                  } finally {
                    setBusy(false);
                  }
                }}
                onImport={async (items, nextCatalog, source) => {
                  setBusy(true);
                  setError("");
                  try {
                    if (backend)
                      persist(
                        await importRemote(
                          items,
                          nextCatalog,
                          data.catalogVersion,
                          source,
                        ),
                      );
                    else {
                      const seen = new Set(
                        data.devices.map((d) => d.serial.toLowerCase()),
                      );
                      for (const d of items) {
                        if (seen.has(d.serial.toLowerCase()))
                          throw new Error("מספר סידורי כבר קיים");
                        seen.add(d.serial.toLowerCase());
                      }
                      persist({
                        ...data,
                        catalog: nextCatalog,
                        devices: [...items, ...data.devices],
                        events: [
                          ...items.map((d) => ({
                            id: crypto.randomUUID(),
                            deviceId: d.id,
                            serial: d.serial,
                            type: "ייבוא מגיליון",
                            at: new Date().toISOString(),
                            actor: "מנהל הדגמה",
                            detail: `${source.file} · ${source.sheet} · שורה ${d.source.row}`,
                          })),
                          ...data.events,
                        ],
                      });
                    }
                    setToast(`${items.length} מכשירים יובאו בהצלחה`);
                  } catch (e) {
                    setError(e.message);
                    throw e;
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            )}
            {page === "legacy" && (
              <LegacyRecords
                records={data.legacy || []}
                companies={companies}
                employees={employees}
                busy={busy}
                error={error}
                onEdit={
                  admin
                    ? async (record, reason) => {
                        setBusy(true);
                        setError("");
                        try {
                          if (!reason.trim())
                            throw new Error("חסרה סיבת שינוי");
                          if (backend)
                            persist(await editLegacyRemote(record, reason));
                          else
                            persist({
                              ...data,
                              legacy: data.legacy.map((r) =>
                                r.id === record.id ? record : r,
                              ),
                              events: [
                                {
                                  id: crypto.randomUUID(),
                                  type: "עריכת רשומה מהגיליון",
                                  recordId: record.id,
                                  at: new Date().toISOString(),
                                  actor: "מנהל הדגמה",
                                  detail: reason,
                                },
                                ...data.events,
                              ],
                            });
                          setToast("הרשומה נשמרה");
                        } catch (e) {
                          setError(e.message);
                          throw e;
                        } finally {
                          setBusy(false);
                        }
                      }
                    : null
                }
              />
            )}
            {page === "team" && (
              <>
                <div className="team-grid">
                  {employees.map((e, i) => {
                    const ds = active.filter((d) => d.employee === e);
                    return (
                      <section className="panel team-card" key={e}>
                        <div className="team-head">
                          <span className={"avatar color-" + i}>
                            {e
                              .split(" ")
                              .map((s) => s[0])
                              .join("")}
                          </span>
                          <div>
                            <h2>{e}</h2>
                            <p>עובד שטח · כל החברות</p>
                          </div>
                        </div>
                        <strong className="team-number">
                          {
                            ds.filter((d) =>
                              ["agent", "trial"].includes(d.status),
                            ).length
                          }
                          <small>מכשירים באחריות</small>
                        </strong>
                        <div className="team-stats">
                          <span>
                            לפני מסירה
                            <b>
                              {ds.filter((d) => d.status === "agent").length}
                            </b>
                          </span>
                          <span>
                            בניסיון
                            <b>
                              {ds.filter((d) => d.status === "trial").length}
                            </b>
                          </span>
                          <span>
                            נמסרו
                            <b>
                              {
                                ds.filter((d) => d.status === "delivered")
                                  .length
                              }
                            </b>
                          </span>
                        </div>
                        <div className="company-tags">
                          {companies
                            .filter((c) => ds.some((d) => d.company === c))
                            .map((c) => (
                              <span key={c}>{shortCompany(c)}</span>
                            ))}
                        </div>
                        <button
                          className="secondary full"
                          onClick={() => navigate("inventory", { employee: e })}
                        >
                          למלאי של {e.split(" ")[0]}
                          <ChevronLeft size={16} />
                        </button>
                      </section>
                    );
                  })}
                </div>
                <div className="info-note">
                  <Users size={19} />
                  <span>
                    העובדים משותפים לכל החברות. שיוך החברה נשמר בכרטיס המכשיר
                    בכל העברה ומסירה.
                  </span>
                </div>
              </>
            )}
            {page === "companies" && (
              <div className="company-grid">
                {companies.map((c, i) => {
                  const ds = active.filter((d) => d.company === c);
                  return (
                    <section className="panel company-card" key={c}>
                      <span className={"company-logo large color-" + i}>
                        {c[0]}
                      </span>
                      <h2>{c}</h2>
                      <strong>
                        {ds.length}
                        <small>מכשירים משויכים</small>
                      </strong>
                      <div className="company-stat-list">
                        {[
                          "warehouse",
                          "agent",
                          "trial",
                          "delivered",
                          "inspection",
                          "repair",
                        ].map((s) => (
                          <div key={s}>
                            <Badge status={s} />
                            <b>{ds.filter((d) => d.status === s).length}</b>
                          </div>
                        ))}
                      </div>
                      <button
                        className="secondary full"
                        onClick={() => navigate("inventory", { company: c })}
                      >
                        למלאי החברה
                        <ChevronLeft size={16} />
                      </button>
                    </section>
                  );
                })}
                <section className="panel unassigned">
                  <Box size={24} />
                  <div>
                    <h2>מלאי משותף שטרם שויך</h2>
                    <p>
                      {active.filter((d) => !d.company).length} מכשירים · החברה
                      תיבחר בעת ההעברה לעובד
                    </p>
                  </div>
                  <button
                    className="secondary"
                    onClick={() =>
                      navigate("inventory", { status: "warehouse" })
                    }
                  >
                    מלאי המחסן
                  </button>
                </section>
              </div>
            )}
            {page === "history" && (
              <section className="panel history-panel">
                <div className="panel-head">
                  <h2>
                    היסטוריית תנועות{" "}
                    <span className="count">{recent.length}</span>
                  </h2>
                  <label className="search-box">
                    <Search size={18} />
                    <input
                      placeholder="חיפוש מספר סידורי או פעולה…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                </div>
                <div className="history-list">
                  {recent
                    .filter((e) =>
                      [e.serial, e.type, e.detail, e.actor].some((s) =>
                        s?.includes(search),
                      ),
                    )
                    .map((e) => (
                      <button
                        className="history-row"
                        key={e.id}
                        onClick={() => {
                          const d = data.devices.find(
                            (d) => d.id === e.deviceId,
                          );
                          if (d) setModal({ kind: "detail", device: d });
                        }}
                      >
                        <span className="square teal">
                          <History size={20} />
                        </span>
                        <div>
                          <b>
                            {e.type} <span className="serial">{e.serial}</span>
                          </b>
                          <p>{e.detail}</p>
                        </div>
                        <div className="history-meta">
                          <b>{fmt(e.at)}</b>
                          <small>{e.actor}</small>
                        </div>
                        <ChevronLeft size={17} />
                      </button>
                    ))}
                </div>
              </section>
            )}
            <footer>
              מלאי <span>ניהול מכשירי שמיעה · Rexton</span>
              <span>
                {backend
                  ? "נתונים משותפים · רענון אוטומטי כל 30 שניות"
                  : "סביבת הדגמה · שמירה מקומית"}
              </span>
            </footer>
          </main>
        </div>
        {modal && (
          <div
            className="modal-overlay"
            onClick={() => !busy && setModal(null)}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-label={
                modal.kind === "detail"
                  ? "כרטיס מכשיר"
                  : modal.kind === "edit"
                    ? "עריכת מכשיר"
                    : actions[modal.action]
              }
              className={
                "modal " +
                (["detail", "edit"].includes(modal.kind) ? "device-modal" : "")
              }
              onClick={(e) => e.stopPropagation()}
            >
              <button
                autoFocus
                className="close-modal"
                aria-label="סגירה"
                onClick={() => setModal(null)}
                disabled={busy}
              >
                <X size={22} />
              </button>
              {modal.kind === "detail" ? (
                <DeviceDetail
                  device={
                    data.devices.find((d) => d.id === modal.device.id) ||
                    modal.device
                  }
                  events={recent.filter((e) => e.deviceId === modal.device.id)}
                  admin={admin}
                  onEdit={(device) => {
                    setError("");
                    setModal({ kind: "edit", device });
                  }}
                  onAction={(d, action) =>
                    setModal({ kind: "action", device: d, action })
                  }
                />
              ) : modal.kind === "edit" && admin ? (
                <EditDevice
                  device={modal.device}
                  busy={busy}
                  error={error}
                  onBack={() =>
                    setModal({ kind: "detail", device: modal.device })
                  }
                  onSubmit={(values) =>
                    commit(async () => {
                      persist(
                        backend
                          ? await editRemote(modal.device, values)
                          : editDemo(data, modal.device, values),
                      );
                      setToast("השינויים נשמרו ביומן המכשיר");
                    })
                  }
                />
              ) : (
                <ActionForm
                  device={modal.device}
                  action={modal.action}
                  busy={busy}
                  error={error}
                  onBack={() =>
                    setModal({ kind: "detail", device: modal.device })
                  }
                  onSubmit={(v) =>
                    commit(async () => {
                      persist(
                        backend
                          ? await moveRemote(modal.device, modal.action, v)
                          : moveDemo(data, modal.device, modal.action, v),
                      );
                      setToast("הפעולה נשמרה ויומן התנועות עודכן");
                    })
                  }
                />
              )}
            </section>
          </div>
        )}
        {scanner && (
          <Scanner
            onClose={() => setScanner(null)}
            onResult={scanner.onResult}
          />
        )}
        {toast && (
          <div className="toast" role="status">
            <Check size={18} />
            {toast}
          </div>
        )}
      </div>
    </CatalogContext.Provider>
  );
}
function download(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Badge({ status }) {
  return (
    <span className={"badge " + status}>
      <i />
      {statuses[status]}
    </span>
  );
}
function FilterBar({
  search,
  setSearch,
  company,
  setCompany,
  status,
  setStatus,
  employee,
  setEmployee,
}) {
  const { companies, employees } = useCatalog();
  return (
    <div className="filterbar">
      <label className="search-box">
        <Search size={18} />
        <input
          aria-label="חיפוש מכשירים"
          placeholder="חיפוש לפי מספר סידורי, דגם או לקוח…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button aria-label="ניקוי חיפוש" onClick={() => setSearch("")}>
            <X size={14} />
          </button>
        )}
      </label>
      <label className="select-box">
        <Building2 size={16} />
        <select
          aria-label="סינון לפי חברה"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        >
          <option value="">כל החברות</option>
          {companies.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <label className="select-box">
        <SlidersHorizontal size={16} />
        <select
          aria-label="סינון לפי מצב"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">כל המצבים</option>
          {Object.entries(statuses).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      {setEmployee && (
        <label className="select-box">
          <UserRound size={16} />
          <select
            aria-label="סינון לפי עובד"
            value={employee}
            onChange={(e) => setEmployee(e.target.value)}
          >
            <option value="">כל העובדים</option>
            {employees.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
function DeviceTable({ devices, onOpen }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>מכשיר / מספר סידורי</th>
            <th>חברה</th>
            <th>עובד אחראי</th>
            <th>לקוח</th>
            <th>מצב</th>
            <th aria-label="פתיחת מכשיר" />
          </tr>
        </thead>
        <tbody>
          {devices.map((d) => (
            <tr key={d.id}>
              <td>
                <button className="device-cell" onClick={() => onOpen(d)}>
                  <span className="device-icon">
                    <AudioLines size={21} />
                  </span>
                  <span>
                    <b dir="ltr">{d.model}</b>
                    <small dir="ltr">
                      {d.serial} <span className="side">· {d.side}</span>
                    </small>
                  </span>
                </button>
              </td>
              <td>
                <span
                  className={"company-label " + (!d.company ? "muted" : "")}
                >
                  {shortCompany(d.company)}
                </span>
              </td>
              <td>
                {d.employee ? (
                  <span className="employee-label">
                    <span className="avatar mini">{d.employee[0]}</span>
                    {d.employee}
                  </span>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
              <td>{d.client || <span className="muted">—</span>}</td>
              <td>
                <Badge status={d.status} />
              </td>
              <td>
                <button
                  className="row-open"
                  aria-label={`פתיחת מכשיר ${d.serial}`}
                  onClick={() => onOpen(d)}
                >
                  <ChevronLeft size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!devices.length && (
        <div className="empty">
          <Package size={32} />
          <h3>לא נמצאו מכשירים</h3>
          <p>נסו לשנות את החיפוש או את הסינון.</p>
        </div>
      )}
    </div>
  );
}
function DeviceDetail({ device: d, events, admin, onAction, onEdit }) {
  const { fields } = useCatalog();
  const options = allowed(d).filter(
    (a) => admin || ["deliver", "trial", "return"].includes(a),
  );
  return (
    <>
      <div className="detail-top">
        <span className="device-icon large">
          <AudioLines size={32} />
        </span>
        <div>
          <div className="eyebrow">כרטיס מכשיר</div>
          <h2 dir="ltr">{d.model}</h2>
          <span className="serial">{d.serial}</span>
        </div>
        <Badge status={d.status} />
      </div>
      <div className="detail-grid">
        {[
          ["חברה", d.company || "טרם שויך"],
          ["עובד אחראי", d.employee || "—"],
          ["לקוח", d.client || "—"],
          ["צד", d.side],
          ["צבע", d.color],
          ["ספק", "Rexton"],
          ["תאריך קליטה", fmt(d.received)],
          ["משלוח", d.batch || "—"],
          ["ברקוד", d.barcode || "—"],
          ...fields.map((f) => [f.name, d.attributes?.[f.key] || "—"]),
          ...(d.trialUntil ? [["סיום ניסיון", fmt(d.trialUntil)]] : []),
        ].map(([k, v]) => (
          <div key={k}>
            <small>{k}</small>
            <b>{v}</b>
          </div>
        ))}
      </div>
      {d.notes && (
        <div className="detail-notes">
          <b>הערות</b>
          <p>{d.notes}</p>
        </div>
      )}
      {d.source && (
        <details className="source-details">
          <summary>
            הנתונים המקוריים מהגיליון · {d.source.sheet} · שורה {d.source.row}
          </summary>
          {Object.entries(d.source.values || {}).map(([k, v]) => (
            <div key={k}>
              <b>{k}</b>
              <span>{v || "—"}</span>
            </div>
          ))}
        </details>
      )}
      <div className="detail-actions">
        {admin && (
          <button className="secondary" onClick={() => onEdit(d)}>
            <Pencil size={17} />
            עריכת מכשיר
          </button>
        )}
        {options.map((a, i) => (
          <button
            className={i === 0 ? "primary" : "secondary"}
            key={a}
            onClick={() => onAction(d, a)}
          >
            {a === "return" ? (
              <RotateCcw size={17} />
            ) : (
              <ArrowUpRight size={17} />
            )}{" "}
            {actions[a]}
          </button>
        ))}
      </div>
      <div className="detail-history">
        <h3>היסטוריית המכשיר</h3>
        {events.length ? (
          events.map((e) => (
            <div className="timeline-item" key={e.id}>
              <i />
              <div>
                <b>{e.type}</b>
                <p>{e.detail}</p>
                <small>
                  {fmt(e.at)} · {e.actor}
                </small>
              </div>
            </div>
          ))
        ) : (
          <p className="muted">טרם נרשמו תנועות</p>
        )}
      </div>
    </>
  );
}
function Field({ label, children }) {
  const id = React.useId();
  return (
    <div className="field">
      <label id={id}>{label}</label>
      {React.Children.map(children, (child) =>
        React.isValidElement(child) &&
        ["input", "select", "textarea"].includes(child.type)
          ? React.cloneElement(child, { "aria-labelledby": id })
          : child,
      )}
    </div>
  );
}
function ActionForm({ device: d, action, busy, error, onBack, onSubmit }) {
  const { companies, employees } = useCatalog();
  const [v, setV] = useState({
    company: d.company || "",
    employee: d.employee || "",
    client: d.client || "",
    trialUntil: d.trialUntil || "",
    notes: "",
    reason: "",
    checked: false,
  });
  function set(k, val) {
    setV({ ...v, [k]: val });
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(v);
      }}
    >
      <div className="eyebrow">עדכון מכשיר</div>
      <h2>{actions[action]}</h2>
      <p className="form-intro">
        <span dir="ltr">
          {d.model} · {d.serial}
        </span>
      </p>
      {["assign", "reassign"].includes(action) && (
        <>
          <Field label="חברה *">
            <select
              required
              value={v.company}
              onChange={(e) => set("company", e.target.value)}
            >
              <option value="">בחירת חברה</option>
              {companies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="עובד אחראי *">
            <select
              required
              value={v.employee}
              onChange={(e) => set("employee", e.target.value)}
            >
              <option value="">בחירת עובד</option>
              {employees.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </>
      )}
      {["deliver", "trial"].includes(action) && (
        <>
          <Field label="שם הלקוח *">
            <input
              required
              value={v.client}
              onChange={(e) => set("client", e.target.value)}
              placeholder="שם מלא"
              maxLength={100}
            />
          </Field>
          {action === "trial" && (
            <Field label="תאריך סיום ניסיון *">
              <input
                type="date"
                required
                min={today()}
                value={v.trialUntil}
                onChange={(e) => set("trialUntil", e.target.value)}
              />
            </Field>
          )}
          <div className="info-note">
            המסירה תשויך ל{shortCompany(d.company)} ולעובד {d.employee}.
          </div>
        </>
      )}
      {action === "return" && (
        <>
          <Field label="סיבת ההחזרה *">
            <textarea
              required
              value={v.reason}
              onChange={(e) => set("reason", e.target.value)}
              placeholder="סיבת ההחזרה ומצב המכשיר"
              maxLength={1000}
            />
          </Field>
          <div className="info-note">
            המכשיר יועבר לבדיקה. לאחר אישור תקינות ניתן להחזיר אותו למלאי הזמין.
          </div>
        </>
      )}
      {action === "approve" && (
        <label className="check-field">
          <input
            type="checkbox"
            required
            checked={v.checked}
            onChange={(e) => set("checked", e.target.checked)}
          />
          <span>המכשיר נבדק, נוקה ונמצא תקין למסירה מחדש.</span>
        </label>
      )}
      {action === "supplier" && (
        <div className="info-note">
          המכשיר יוסר מהמלאי הפעיל. היסטוריית המכשיר תישמר.
        </div>
      )}
      {action !== "return" && (
        <Field label="הערות לתנועה">
          <textarea
            value={v.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="מידע נוסף, אם יש"
            maxLength={1000}
          />
        </Field>
      )}
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      <div className="form-footer">
        <button type="submit" className="primary" disabled={busy}>
          <Check size={18} />
          {busy ? "שומר…" : "אישור ושמירה"}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={onBack}
          disabled={busy}
        >
          חזרה לכרטיס
        </button>
      </div>
    </form>
  );
}
function Receive({ busy, onSubmit, onScan }) {
  const { companies, models, colors, fields } = useCatalog();
  const [v, setV] = useState({
      model: models[0] || "",
      side: "ימין",
      color: colors[0] || "",
      company: "",
      batch: "",
      received: today(),
      serials: "",
      notes: "",
      attributes: {},
    }),
    [error, setError] = useState("");
  const serials = v.serials
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  function set(k, x) {
    setV({ ...v, [k]: x });
  }
  function submit(e) {
    e.preventDefault();
    setError("");
    if (new Set(serials.map((s) => s.toLowerCase())).size !== serials.length) {
      setError("יש מספרים סידוריים כפולים ברשימה. יש להסיר את הכפילויות.");
      return;
    }
    if (!serials.length) {
      setError("יש להזין לפחות מספר סידורי אחד");
      return;
    }
    onSubmit(
      serials.map((serial) => ({
        id: crypto.randomUUID(),
        serial,
        model: v.model,
        side: v.side,
        color: v.color,
        company: v.company,
        batch: v.batch,
        received: v.received,
        notes: v.notes,
        attributes: v.attributes,
        employee: "",
        client: "",
        trialUntil: "",
        status: "warehouse",
      })),
    );
  }
  return (
    <div className="receive-layout">
      <form className="panel receive-form" onSubmit={submit}>
        <div className="panel-head">
          <div>
            <h2>משלוח חדש מהספק</h2>
            <p>כל מספר סידורי ייקלט כמכשיר נפרד</p>
          </div>
          <span className="square teal">
            <Truck size={23} />
          </span>
        </div>
        <div className="form-body">
          <div className="form-grid">
            <Field label="ספק">
              <input value="Rexton" readOnly />
            </Field>
            <Field label="מספר משלוח / תעודת משלוח *">
              <input
                required
                value={v.batch}
                onChange={(e) => set("batch", e.target.value)}
                placeholder="לדוגמה RX-2026-105"
                maxLength={100}
              />
            </Field>
            <Field label="דגם *">
              <select
                required
                value={v.model}
                onChange={(e) => set("model", e.target.value)}
              >
                <option value="">בחירת דגם</option>
                {models.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </Field>
            <Field label="תאריך קליטה *">
              <input
                required
                type="date"
                value={v.received}
                onChange={(e) => set("received", e.target.value)}
              />
            </Field>
            <Field label="צד">
              <select
                value={v.side}
                onChange={(e) => set("side", e.target.value)}
              >
                {["ימין", "שמאל", "לא מוגדר"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="צבע">
              <select
                value={v.color}
                onChange={(e) => set("color", e.target.value)}
              >
                <option value="">לא צוין</option>
                {colors.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="שיוך לחברה">
            <select
              value={v.company}
              onChange={(e) => set("company", e.target.value)}
            >
              <option value="">מלאי מחסן משותף — שיוך בהמשך</option>
              {companies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <button
            type="button"
            className="secondary scan-receive"
            onClick={() =>
              onScan((value) =>
                setV((previous) => ({
                  ...previous,
                  serials: [previous.serials.trim(), value]
                    .filter(Boolean)
                    .join("\n"),
                })),
              )
            }
          >
            <ScanBarcode size={18} />
            הוספת מספר סידורי בסריקה
          </button>
          <Field label="מספרים סידוריים *">
            <textarea
              required
              className="serial-input"
              dir="ltr"
              value={v.serials}
              onChange={(e) => set("serials", e.target.value)}
              placeholder={"RX-260200\nRX-260201\nRX-260202"}
            />
          </Field>
          <div className="input-help">
            מספר אחד בכל שורה, או הפרדה בפסיק. כל המכשירים יקבלו את פרטי הדגם
            והצד שנבחרו.
          </div>
          {fields.map((f) => (
            <Field key={f.key} label={f.name}>
              <input
                maxLength={1000}
                value={v.attributes[f.key] || ""}
                onChange={(e) =>
                  set("attributes", {
                    ...v.attributes,
                    [f.key]: e.target.value,
                  })
                }
              />
            </Field>
          ))}
          <Field label="הערות משלוח">
            <textarea
              value={v.notes}
              onChange={(e) => set("notes", e.target.value)}
              maxLength={1000}
              placeholder="מידע נוסף על המשלוח"
            />
          </Field>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <div className="form-footer">
            <button className="primary" disabled={busy}>
              <PackagePlus size={18} />
              {busy ? "קולט…" : `קליטת ${serials.length || ""} מכשירים למחסן`}
            </button>
            <span className="muted">המספרים ייבדקו למניעת כפילויות</span>
          </div>
        </div>
      </form>
      <aside className="receive-aside">
        <div className="panel receive-summary">
          <span className="square teal">
            <PackagePlus size={26} />
          </span>
          <h2>מספק, למחסן, ללקוח.</h2>
          <p>מכשיר אחד. מספר סידורי אחד. היסטוריה מלאה.</p>
          <ol>
            <li>
              <b>קליטה למחסן</b>
              <span>רישום הדגם, המספר הסידורי והמשלוח</span>
            </li>
            <li>
              <b>העברה לעובד</b>
              <span>בחירת חברה ועובד אחראי</span>
            </li>
            <li>
              <b>מסירה או ניסיון</b>
              <span>שיוך ללקוח ומעקב אחרי המכשיר</span>
            </li>
            <li>
              <b>החזרה במידת הצורך</b>
              <span>בדיקה ואישור חזרה למלאי</span>
            </li>
          </ol>
        </div>
        <div className="info-note">
          <AlertCircle size={20} />
          <span>
            קולטים דגמים או צדדים שונים? יש לבצע קליטה נפרדת לכל קבוצת מכשירים.
          </span>
        </div>
      </aside>
    </div>
  );
}
function Login({ error, onError }) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false);
  async function login(e) {
    e.preventDefault();
    setBusy(true);
    const { error } = await backend.auth.signInWithPassword({
      email,
      password,
    });
    onError(error ? "לא ניתן להתחבר. בדקו את הפרטים ונסו שוב." : "");
    setBusy(false);
  }
  return (
    <div className="login">
      <div className="panel">
        <span className="brand-icon">
          <AudioLines size={32} />
        </span>
        <h1>ברוכים הבאים למלאי</h1>
        <p>ניהול מכשירי שמיעה · קבוצת חברות השמיעה</p>
        <form onSubmit={login}>
          <Field label="דוא״ל">
            <input
              dir="ltr"
              required
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="סיסמה">
            <input
              dir="ltr"
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && <div className="error">{error}</div>}
          <button className="primary full" disabled={busy}>
            {busy ? "מתחבר…" : "כניסה למערכת"}
          </button>
        </form>
        <small>לקבלת גישה או לאיפוס סיסמה, פנו למנהל המערכת.</small>
      </div>
    </div>
  );
}
function SetPassword({onDone}) {
 const [password,setPassword]=useState(""),[confirmation,setConfirmation]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
 async function save(e){e.preventDefault();if(password!==confirmation){setError("הסיסמאות אינן זהות");return;}setBusy(true);const r=await backend.auth.updateUser({password});setBusy(false);if(r.error)setError("לא ניתן לשמור את הסיסמה. נסו שוב או בקשו קישור חדש.");else onDone();}
 return <div className="login"><div className="panel"><h1>הגדרת סיסמה</h1><p>בחרו סיסמה אישית לכניסה למערכת.</p><form onSubmit={save}><Field label="סיסמה חדשה"><input dir="ltr" type="password" minLength={10} required autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></Field><Field label="אימות סיסמה"><input dir="ltr" type="password" minLength={10} required autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></Field>{error&&<div role="alert" className="error">{error}</div>}<button className="primary full" disabled={busy}>{busy?"שומר…":"שמירת סיסמה וכניסה"}</button></form></div></div>;
}
createRoot(document.getElementById("root")).render(<App />);
