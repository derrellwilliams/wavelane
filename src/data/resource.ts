/// Cache, then refresh: a screen asks for data by key and gets the last known copy at once
/// (memory, else IndexedDB) while the server is asked again in the background. A failed refresh
/// keeps the old copy on screen; `failed` is only set when there is nothing to show.
import { signal, type Signal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import type { Session } from "../api/auth";
import { ApiError } from "../api/client";
import { session, setSession } from "../api/session";
import { clearCache, readCache, writeCache } from "./cache";

export interface Loaded<T> {
  data?: T;
  failed: boolean;
}

interface Entry {
  state: Signal<Loaded<unknown>>;
  /// When the server last answered. 0 means "ask again".
  at: number;
  busy: boolean;
}

/// How long an answer counts as current, so moving between screens doesn't ask again each time.
const FRESH_MS = 60_000;
const NOTHING: Loaded<never> = { failed: false };

const entries = new Map<string, Entry>();
/// Raised to make every screen on show ask again (after marking something watched, or Try again).
const round = signal(0);
/// True while the last server request failed (not a sign-out), so screens can say they show a saved copy.
export const offline = signal(false);
/// Raised on sign-out, so answers still on their way are thrown away.
let generation = 0;

function entryFor(key: string): Entry {
  let entry = entries.get(key);
  if (!entry) {
    entry = { state: signal<Loaded<unknown>>(NOTHING), at: 0, busy: false };
    entries.set(key, entry);
  }
  return entry;
}

async function refresh(entry: Entry, key: string, load: () => Promise<unknown>, persist: boolean): Promise<void> {
  if (entry.busy || Date.now() - entry.at < FRESH_MS) return;
  entry.busy = true;
  const mine = generation;
  const has = () => entry.state.value.data !== undefined;

  const cached =
    persist && !has()
      ? readCache<unknown>(key).then((value) => {
          if (value !== undefined && !has() && mine === generation) entry.state.value = { data: value, failed: false };
        })
      : Promise.resolve();

  try {
    const data = await load();
    if (mine !== generation) return;
    entry.state.value = { data, failed: false };
    entry.at = Date.now();
    offline.value = false;
    if (persist) void writeCache(key, data);
  } catch (error) {
    if (mine !== generation) return;
    if (error instanceof ApiError && error.status === 401) {
      // The token was revoked: back to sign-in.
      forgetEverything();
      setSession(null);
      return;
    }
    offline.value = true;
    await cached;
    if (!has() && mine === generation) entry.state.value = { failed: true };
  } finally {
    entry.busy = false;
  }
}

/// The data for `key` (null: nothing to ask yet). `load` runs when the screen appears and the
/// copy held is older than a minute. `persist` false keeps it out of IndexedDB (search results).
export function useResource<T>(key: string | null, load: (session: Session) => Promise<T>, persist = true): Loaded<T> {
  const current = session.value;
  const fullKey = key && current ? `${current.userId}@${current.server}|${key}` : null;
  const entry = fullKey ? entryFor(fullKey) : null;
  const turn = round.value;

  useEffect(() => {
    if (entry && fullKey && current) void refresh(entry, fullKey, () => load(current), persist);
  }, [fullKey, turn]);

  return (entry?.state.value ?? NOTHING) as Loaded<T>;
}

/// Marks everything out of date and makes the screens on show ask again.
export function refreshAll(): void {
  for (const entry of entries.values()) entry.at = 0;
  round.value++;
}

/// Sign-out: drops everything held in memory and on disk.
export function forgetEverything(): void {
  generation++;
  entries.clear();
  void clearCache();
}
