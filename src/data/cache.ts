/// A small key-value cache in IndexedDB (app-private on webOS), so screens can draw their first
/// frame from the last visit before the server answers. Every call is guarded: with no database
/// the app simply has no cache. It holds library lists only, never the token.

const NAME = "wavelane";
const STORE = "cache";
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;

interface Row {
  at: number;
  value: unknown;
}

let opening: Promise<IDBDatabase | null> | null = null;

function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function open(): Promise<IDBDatabase | null> {
  opening ??= new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = indexedDB.open(NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => {
        prune(request.result);
        resolve(request.result);
      };
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opening;
}

/// Keys under "dl:" belong to films saved on the tablet (their subtitle cues): they stay until the
/// film is deleted, however old, and signing out of the library cache doesn't touch them.
const isSaved = (key: IDBValidKey | undefined) => typeof key === "string" && key.startsWith("dl:");

/// Drops entries not refreshed for a month (items long gone from the library).
function prune(db: IDBDatabase): void {
  try {
    const cursor = db.transaction(STORE, "readwrite").objectStore(STORE).openCursor();
    const cutoff = Date.now() - KEEP_MS;
    cursor.onsuccess = () => {
      const at = cursor.result;
      if (!at) return;
      const row = at.value as Row | undefined;
      if (!isSaved(at.key) && (!row || !(row.at >= cutoff))) at.delete();
      at.continue();
    };
  } catch {
    // Best effort.
  }
}

export async function readCache<T>(key: string): Promise<T | undefined> {
  try {
    const db = await open();
    if (!db) return undefined;
    const row = (await done(db.transaction(STORE).objectStore(STORE).get(key))) as Row | undefined;
    return row?.value as T | undefined;
  } catch {
    return undefined;
  }
}

export async function writeCache(key: string, value: unknown): Promise<void> {
  try {
    const db = await open();
    if (db) await done(db.transaction(STORE, "readwrite").objectStore(STORE).put({ at: Date.now(), value } satisfies Row, key));
  } catch {
    // Full or unavailable: the next launch just starts without it.
  }
}

/// Empties the cache (sign-out: the next user must not see this one's library).
export async function clearCache(): Promise<void> {
  try {
    const db = await open();
    if (!db) return;
    const store = db.transaction(STORE, "readwrite").objectStore(STORE);
    const keys = (await done(store.getAllKeys())) as IDBValidKey[];
    for (const key of keys) if (!isSaved(key)) store.delete(key);
  } catch {
    // Nothing to clear.
  }
}

export async function deleteCache(key: string): Promise<void> {
  try {
    const db = await open();
    if (db) await done(db.transaction(STORE, "readwrite").objectStore(STORE).delete(key));
  } catch {
    // Nothing to delete.
  }
}
