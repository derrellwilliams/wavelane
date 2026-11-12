// Local only. Pairs export films (no IDs) with library movies by title and year.
import type { Item } from "../api/items";
import type { Seen } from "./log";

/// Lower case, accents and punctuation gone, "&" as "and", leading article dropped, spaces folded.
export function normalize(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^(the|a|an) /, "");
}

export interface Matches {
  /// Library item id to the film logged for it.
  byItem: Map<string, Seen>;
  /// Logged films with no library movie.
  missing: Seen[];
}

/// A title seen in more than one year (remakes) needs the exact year; others allow one year either
/// way, because the server and Letterboxd sometimes date a film by different releases. Each library
/// movie and each logged film is used once, exact years first.
export function matchLibrary(log: Seen[], library: Item[]): Matches {
  const movies = library.filter((item) => item.type === "Movie" && item.year !== undefined);
  const byTitle = new Map<string, Item[]>();
  for (const movie of movies) {
    const key = normalize(movie.name);
    byTitle.set(key, [...(byTitle.get(key) ?? []), movie]);
  }
  const years = new Map<string, Set<number>>();
  for (const film of log) {
    const key = normalize(film.name);
    years.set(key, (years.get(key) ?? new Set()).add(film.year));
  }

  const byItem = new Map<string, Seen>();
  const left: Seen[] = [];
  const pass = (loose: boolean) => {
    const next: Seen[] = [];
    for (const film of left) {
      const key = normalize(film.name);
      const strict = (years.get(key)?.size ?? 0) > 1;
      const found = (byTitle.get(key) ?? []).find(
        (movie) => !byItem.has(movie.id) && (loose ? !strict && Math.abs(movie.year! - film.year) === 1 : movie.year === film.year),
      );
      if (found) byItem.set(found.id, film);
      else next.push(film);
    }
    left.length = 0;
    left.push(...next);
  };
  left.push(...log);
  pass(false);
  pass(true);
  return { byItem, missing: left };
}
