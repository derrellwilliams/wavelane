/// The user's recent Letterboxd entries from their public feed, read by the TV service. Entries
/// carry exact TMDB IDs, so they match library movies without guessing. They cover only the latest
/// ~50 films, so they add to the export rather than replace it.
import { signal } from "@preact/signals";
import { load, save } from "../api/storage";
import { callService } from "../platform/service";

export interface Entry {
  tmdb: string;
  rating: number | null;
  /// ISO date.
  date: string | null;
  rewatch: boolean;
}

const USER = "letterboxd.user";
const FEED = "letterboxd.feed";
const AT = "letterboxd.feed.at";
const EVERY = 6 * 60 * 60 * 1000;
const NAME = /^[A-Za-z0-9_]{1,40}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const isUsername = (value: string) => NAME.test(value);

export function readEntries(raw: string | null): Entry[] {
  if (!raw) return [];
  try {
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list) || list.length > 200) return [];
    const out: Entry[] = [];
    for (const entry of list as Record<string, unknown>[]) {
      if (!entry || typeof entry.tmdb !== "string" || !/^\d{1,9}$/.test(entry.tmdb)) continue;
      const rating = entry.rating;
      out.push({
        tmdb: entry.tmdb,
        rating: typeof rating === "number" && rating >= 0.5 && rating <= 5 ? rating : null,
        date: typeof entry.date === "string" && DATE.test(entry.date) ? entry.date : null,
        rewatch: entry.rewatch === true,
      });
    }
    return out;
  } catch {
    return [];
  }
}

const saved = load(USER);
export const username = signal(saved && NAME.test(saved) ? saved : "");
export const entries = signal<Entry[]>(readEntries(load(FEED)));

export function setUsername(name: string): void {
  const clean = name.trim().replace(/^@/, "");
  username.value = NAME.test(clean) ? clean : "";
  save(USER, username.value || null);
  save(AT, null);
  if (!username.value) {
    entries.value = [];
    save(FEED, null);
  } else void refreshFeed(true);
}

/// Reads the feed when it is a few hours old (or `force`). Quiet on failure: the export and the
/// last copy still work.
export async function refreshFeed(force = false): Promise<void> {
  const name = username.value;
  if (!name || !NAME.test(name)) return;
  if (!force && Date.now() - Number(load(AT)) < EVERY) return;
  try {
    const reply = await callService<{ status: number; entries: unknown }>("feed", { user: name }, 20000);
    if (reply.status !== 200) return;
    const fresh = readEntries(JSON.stringify(reply.entries));
    entries.value = fresh;
    save(FEED, JSON.stringify(fresh));
    save(AT, String(Date.now()));
  } catch {
    // Off the TV, offline, or the page changed.
  }
}
