export const OFFICE_SESSION_KEY = "ist-office-session";
export const OFFICE_SESSION_TTL = 4 * 60 * 60 * 1000; // 4 hours

export function getSavedOfficeSession({ storage = localStorage, now = Date.now } = {}) {
  try {
    const raw = storage.getItem(OFFICE_SESSION_KEY);
    if (!raw) return null;
    const { name, ts } = JSON.parse(raw);
    if (now() - ts > OFFICE_SESSION_TTL) {
      storage.removeItem(OFFICE_SESSION_KEY);
      return null;
    }
    return name;
  } catch {
    return null;
  }
}

export function saveOfficeSession(name, { storage = localStorage, now = Date.now } = {}) {
  try {
    storage.setItem(OFFICE_SESSION_KEY, JSON.stringify({ name, ts: now() }));
  } catch {}
}

export function clearOfficeSession({ storage = localStorage } = {}) {
  try {
    storage.removeItem(OFFICE_SESSION_KEY);
  } catch {}
}
