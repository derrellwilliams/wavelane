/// App-private storage (localStorage, which on webOS belongs to this app alone). Every call is
/// guarded: storage can be unavailable or full, and the app must still run.

const PREFIX = "wavelane.";

export function load(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function save(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, value);
  } catch {
    // Nothing useful to do: the value just won't survive a restart.
  }
}

/// A random ID that names this install to the Jellyfin server. Made once, then kept.
export function deviceId(): string {
  const saved = load("deviceId");
  if (saved && /^[0-9a-f]{32}$/.test(saved)) return saved;
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const id = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  save("deviceId", id);
  return id;
}
