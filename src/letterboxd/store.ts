/// The user's Letterboxd history as the app keeps it: the list of films from the export, in app
/// storage, as a signal. Everything read back is checked again, because storage is not trusted.
import { signal } from "@preact/signals";
import { load, save } from "../api/storage";
import type { Seen } from "./log";

const KEY = "letterboxd.log";
const MAX_FILMS = 20_000;

const NAME_OK = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 300;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/// Films read back from storage, or an empty list when anything is wrong with them.
export function readLog(raw: string | null): Seen[] {
  if (!raw) return [];
  try {
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list) || list.length > MAX_FILMS) return [];
    const films: Seen[] = [];
    for (const entry of list as Record<string, unknown>[]) {
      if (!entry || typeof entry !== "object") continue;
      const year = entry.year;
      const rating = entry.rating;
      const rewatches = entry.rewatches;
      if (!NAME_OK(entry.name) || typeof year !== "number" || !(year >= 1870 && year <= 2100)) continue;
      films.push({
        name: entry.name,
        year,
        uri: typeof entry.uri === "string" && /^https:\/\/boxd\.it\/[A-Za-z0-9]{1,12}$/.test(entry.uri) ? entry.uri : "",
        watched: entry.watched === true,
        rating: typeof rating === "number" && rating >= 0.5 && rating <= 5 ? rating : undefined,
        last: typeof entry.last === "string" && DATE.test(entry.last) ? entry.last : undefined,
        rewatches: typeof rewatches === "number" && rewatches >= 0 && rewatches <= 1000 ? Math.floor(rewatches) : 0,
        watchlist: entry.watchlist === true,
      });
    }
    return films;
  } catch {
    return [];
  }
}

export const watchLog = signal<Seen[]>(readLog(load(KEY)));

export function setWatchLog(films: Seen[]): void {
  watchLog.value = films;
  save(KEY, films.length ? JSON.stringify(films) : null);
}

export function forgetWatchLog(): void {
  setWatchLog([]);
}
