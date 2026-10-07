import React, { useState, useEffect, useRef } from "react";
import { ScanBarcode, X, Camera, Keyboard, Check } from "lucide-react";
export default function Scanner({ onResult, onClose }) {
  const video = useRef(null),
    controls = useRef(null),
    delivered = useRef(false);
  const [camera, setCamera] = useState(false),
    [error, setError] = useState(""),
    [manual, setManual] = useState(""),
    [starting, setStarting] = useState(false);
  const resultRef = useRef(onResult);
  resultRef.current = onResult;
  useEffect(() => {
    if (!camera) return;
    let cancelled = false;
    setStarting(true);
    setError("");
    async function start() {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
          throw new Error(
            "המצלמה אינה זמינה בדפדפן הזה. אפשר להשתמש בסורק USB או להזין את הקוד.",
          );
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const c = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false },
          video.current,
          (result) => {
            if (result && !cancelled && !delivered.current) {
              delivered.current = true;
              controls.current?.stop();
              resultRef.current(result.getText().trim());
            }
          },
        );
        if (cancelled) c.stop();
        else controls.current = c;
        setStarting(false);
      } catch (e) {
        if (cancelled) return;
        setStarting(false);
        setCamera(false);
        setError(
          e.name === "NotAllowedError"
            ? "לא ניתנה הרשאה למצלמה. ניתן לאשר אותה בדפדפן או להשתמש בסורק USB."
            : e.name === "NotFoundError"
              ? "לא נמצאה מצלמה. אפשר להשתמש בסורק USB או להזין את הקוד."
              : e.message,
        );
      }
    }
    start();
    return () => {
      cancelled = true;
      controls.current?.stop();
      controls.current = null;
      video.current?.srcObject?.getTracks().forEach((t) => t.stop());
    };
  }, [camera]);
  useEffect(() => {
    const before = document.activeElement;
    function key(e) {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const elements = [
          ...document.querySelectorAll(
            ".scanner-modal button,.scanner-modal input",
          ),
        ];
        const first = elements[0],
          last = elements.at(-1);
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
  }, [onClose]);
  return (
    <div className="modal-overlay scanner-overlay" onClick={onClose}>
      <section
        className="modal scanner-modal"
        role="dialog"
        aria-modal="true"
        aria-label="סריקת ברקוד"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="close-modal"
          aria-label="סגירת סורק"
          onClick={onClose}
        >
          <X />
        </button>
        <span className="square teal">
          <ScanBarcode size={25} />
        </span>
        <h2>סריקת ברקוד</h2>
        <p className="form-intro">סריקה במצלמה, בסורק USB או בהזנה ידנית.</p>
        {camera ? (
          <>
            <div className="camera-view">
              <video ref={video} muted playsInline />
              <div className="scan-guide" />
            </div>
            <p className="input-help">
              {starting ? "פותח מצלמה…" : "מקמו את הברקוד בתוך המסגרת"}
            </p>
            <button className="secondary full" onClick={() => setCamera(false)}>
              סגירת מצלמה
            </button>
          </>
        ) : (
          <button className="primary full" onClick={() => setCamera(true)}>
            <Camera size={19} />
            סריקה במצלמה
          </button>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const value = manual.trim();
            if (value) {
              controls.current?.stop();
              onResult(value);
            }
          }}
        >
          <label className="field">
            <span>
              <Keyboard size={16} /> מספר סידורי / ברקוד
            </span>
            <input
              autoFocus
              dir="ltr"
              aria-label="מספר סידורי או ברקוד לסריקה"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="סרקו בסורק USB או הקלידו קוד"
              maxLength={200}
            />
          </label>
          <button className="secondary full" disabled={!manual.trim()}>
            <Check size={17} />
            אישור הקוד
          </button>
        </form>
        <p className="input-help">
          סורק USB שמקליד את הקוד ולוחץ Enter פועל בשדה זה. המצלמה נעצרת בסיום
          הסריקה.
        </p>
      </section>
    </div>
  );
}
