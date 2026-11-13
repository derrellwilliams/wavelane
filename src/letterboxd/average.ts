/// Letterboxd's average rating for each library movie, read by the TV service from the public
/// film page (by TMDB ID). Only library movies are looked up, one request every few seconds, the
/// film being looked at first. Results are kept 30 days. A block (403/429) pauses everything for a
/// day. This part breaks Letterboxd's terms (accepted by the user): remove or replace it before
/// any store release.
import { signal } from "@preact/signals";
import { load, save } from "../api/storage";
import { film } from "../platform/letterboxd";

export interface Average {
  /// 0.5 to 5, or null when the film has no rating (or no page).
  rating: number | null;
  count: number | null;
  /// ms since 1970 when it was read.
  at: number;
}

const KEY = "letterboxd.averages";
const PAUSE = "letterboxd.pause";
const SWITCH = "letterboxd.averages.off";
const TTL = 30 * 24 * 60 * 60 * 1000;
const GAP = 4000;
const BLOCKED_FOR = 24 * 60 * 60 * 1000;
const FAILED_FOR = 10 * 60 * 1000;
const MAX_ENTRIES = 20_000;
const TMDB = /^\d{1,9}$/;

export function readAverages(raw: string | null): Map<string, Average> {
  const map = new Map<string, Average>();
  if (!raw) return map;
  try {
    const entries: unknown = JSON.parse(raw);
    if (!Array.isArray(entries) || entries.length > MAX_ENTRIES) return map;
    for (const entry of entries) {
      if (!Array.isArray(entry)) continue;
      const [id, rating, count, at] = entry as unknown[];
      if (typeof id !== "string" || !TMDB.test(id) || typeof at !== "number" || !(at > 0)) continue;
      map.set(id, {
        rating: typeof rating === "number" && rating >= 0.5 && rating <= 5 ? rating : null,
        count: typeof count === "number" && count >= 1 && count <= 1e9 ? Math.floor(count) : null,
        at,
      });
    }
  } catch {
    // Unreadable: start again.
  }
  return map;
}

export const averages = signal<Map<string, Average>>(readAverages(load(KEY)));

const fresh = (entry: Average | undefined, now: number) => !!entry && now - entry.at < TTL;

/// The next film to look up: one being looked at first, then the library in order. Null when
/// everything is fresh.
export function pickNext(library: readonly string[], wanted: readonly string[], known: ReadonlyMap<string, Average>, now: number): string | null {
  for (const id of wanted) if (TMDB.test(id) && !fresh(known.get(id), now)) return id;
  for (const id of library) if (TMDB.test(id) && !fresh(known.get(id), now)) return id;
  return null;
}

/// How many library movies have a TMDB ID to look up, and until when a block or failure has paused
/// the reading (ms since 1970, or 0). For the progress line on Account.
export const libraryTotal = signal(0);
export const pausedUntil = signal(Number(load(PAUSE)) || 0);

function pause(ms: number): void {
  const until = Date.now() + ms;
  save(PAUSE, String(until));
  pausedUntil.value = until;
}

export const scraping = signal(load(SWITCH) !== "1");
export function setScraping(on: boolean): void {
  scraping.value = on;
  save(SWITCH, on ? null : "1");
  if (on) wake();
}

let library: string[] = [];
let wanted: string[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let busy = false;

/// The TMDB IDs of the library's movies, in the order to read them.
export function setLibraryIds(ids: string[]): void {
  library = ids;
  libraryTotal.value = ids.length;
  wake();
}

/// A film the user is looking at: read it next.
export function wantAverage(id: string | undefined): void {
  if (!id || wanted.includes(id)) return;
  wanted = [id, ...wanted].slice(0, 5);
  wake();
}

function wake(): void {
  if (!timer && !busy) timer = setTimeout(step, 0);
}

function later(ms: number): void {
  timer = setTimeout(step, ms);
}

async function step(): Promise<void> {
  timer = undefined;
  if (busy || !scraping.value) return;
  const now = Date.now();
  const until = Number(load(PAUSE));
  if (until > now) return later(Math.min(until - now, 60 * 60 * 1000));
  const id = pickNext(library, wanted, averages.value, now);
  if (!id) return;
  busy = true;
  try {
    const page = await film(Number(id));
    if (page.status === 403 || page.status === 429) {
      pause(BLOCKED_FOR);
    } else {
      const ok = page.status === 200 && typeof page.rating === "number" && page.rating >= 0.5 && page.rating <= 5;
      const next = new Map(averages.value);
      next.set(id, {
        rating: ok ? page.rating : null,
        count: ok && typeof page.count === "number" && page.count >= 1 && page.count <= 1e9 ? page.count : null,
        at: Date.now(),
      });
      averages.value = next;
      save(KEY, JSON.stringify([...next].map(([key, v]) => [key, v.rating, v.count, v.at])));
      wanted = wanted.filter((entry) => entry !== id);
    }
    busy = false;
    later(GAP);
  } catch {
    // Off the TV, or the service didn't answer: try again later, quietly.
    busy = false;
    pause(FAILED_FOR);
    later(FAILED_FOR);
  }
}
