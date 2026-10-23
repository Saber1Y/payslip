/**
 * The last records page opened in this browser, so the header can offer a way back from anywhere.
 * It lives only in this browser: a convenience, never the source of the link. Storage can be blocked or
 * cleared (private windows, cleared site data), so every access is guarded and failures are ignored.
 */
const KEY = "payslip:records-link";
const EVENT = "payslip:records-link";

export interface RememberedLink {
  path: string;
  role: "employer" | "worker";
  name: string;
}

export function rememberRecordsLink(link: RememberedLink): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(link));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // Storage unavailable: the page still works, there is just no shortcut back.
  }
}

export function readRecordsLink(): RememberedLink | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RememberedLink>;
    if (typeof parsed.path !== "string" || !/^\/[ew]\/[A-Za-z0-9_-]{43}$/.test(parsed.path)) return null;
    if (parsed.role !== "employer" && parsed.role !== "worker") return null;
    return { path: parsed.path, role: parsed.role, name: typeof parsed.name === "string" ? parsed.name : "" };
  } catch {
    return null;
  }
}

/** Forgets the remembered link if it is `path`, for example after that link was replaced by recovery. */
export function forgetRecordsLink(path: string): void {
  try {
    if (readRecordsLink()?.path !== path) return;
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // Storage unavailable: nothing was remembered.
  }
}

export function onRecordsLinkChange(listener: () => void): () => void {
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
