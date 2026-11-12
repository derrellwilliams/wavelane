import { useMemo } from "preact/hooks";
import type { Item } from "../api/items";
import { entries, type Entry } from "./feed";
import type { Seen } from "./log";
import { matchLibrary } from "./match";
import { watchLog } from "./store";

const NONE = new Map();

/// What the Letterboxd history says about each movie in `library`, by item id. Empty until an
/// export has been loaded. Matching 600 films takes a few milliseconds, so it runs when either
/// side changes.
export function useMarks(library: readonly Item[] | undefined) {
  const log = watchLog.value;
  const recent = entries.value;
  return useMemo(() => (library && (log.length || recent.length) ? withFeed(matchLibrary(log, library as Item[]).byItem, library, recent) : NONE), [library, log, recent]);
}

/// The export's matches, with the recent feed laid over them. Feed entries match by TMDB ID, so
/// they also cover films the export never had; where both have the film the feed is newer.
export function withFeed(base: Map<string, Seen>, library: readonly Item[], recent: readonly Entry[]): Map<string, Seen> {
  if (!recent.length) return base;
  const byTmdb = new Map(recent.map((entry) => [entry.tmdb, entry]));
  const out = new Map(base);
  for (const movie of library) {
    const entry = movie.tmdb ? byTmdb.get(movie.tmdb) : undefined;
    if (!entry) continue;
    const before = out.get(movie.id);
    const last = entry.date && (!before?.last || entry.date >= before.last) ? entry.date : before?.last;
    out.set(movie.id, {
      name: before?.name ?? movie.name,
      year: before?.year ?? movie.year ?? 0,
      uri: before?.uri ?? "",
      watched: true,
      rating: entry.rating ?? before?.rating,
      last,
      rewatches: (before?.rewatches ?? 0) + (entry.rewatch && (!before?.last || (entry.date ?? "") > before.last) ? 1 : 0),
      watchlist: false,
    });
  }
  return out;
}

/// One line about a film for its detail page, or null when the log has nothing on it.
export function describeSeen(film: { watched: boolean; rating?: number; last?: string; rewatches: number; watchlist: boolean } | undefined): string | null {
  if (!film) return null;
  const parts: string[] = [];
  if (film.rating !== undefined) parts.push(`You rated it ${film.rating} of 5`);
  if (film.watched && film.last) parts.push(`watched ${film.last}`);
  else if (film.watched && film.rating === undefined) parts.push("You've watched it");
  if (film.rewatches > 0) parts.push(`${film.rewatches} rewatch${film.rewatches === 1 ? "" : "es"}`);
  if (film.watchlist) parts.push("On your watchlist");
  return parts.length ? `Letterboxd: ${parts.join("  ·  ")}` : null;
}
