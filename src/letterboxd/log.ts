// Local only. Builds one record per film from the export's four files.
import { readTable } from "./csv";

export interface Seen {
  name: string;
  year: number;
  /// The film's short link (from the first file that lists it).
  uri: string;
  watched: boolean;
  /// Stars, 0.5 to 5.
  rating?: number;
  /// ISO date of the latest diary entry.
  last?: string;
  /// Diary entries marked as rewatches.
  rewatches: number;
  watchlist: boolean;
}

export interface Files {
  watched?: string;
  ratings?: string;
  diary?: string;
  watchlist?: string;
}

const URI = /^https:\/\/boxd\.it\/[A-Za-z0-9]{1,12}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const year = (value: string | undefined): number | null => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1870 && n <= 2100 ? n : null;
};

const stars = (value: string | undefined): number | undefined => {
  const n = Number(value);
  return value && n >= 0.5 && n <= 5 && Number.isInteger(n * 2) ? n : undefined;
};

/// watched.csv is the master list; the others add to it. A film only in ratings, diary or the
/// watchlist is still kept, so nothing the user logged is lost.
export function buildLog(files: Files): Seen[] {
  const films = new Map<string, Seen>();
  const touch = (row: Record<string, string>): Seen | null => {
    const uri = row["Letterboxd URI"] ?? "";
    const y = year(row.Year);
    const name = (row.Name ?? "").trim();
    if (!URI.test(uri) || y === null || !name) return null;
    // The diary's links name the entry, not the film, so films are keyed by name and year.
    const key = `${name}\u0000${y}`;
    let film = films.get(key);
    if (!film) {
      film = { name, year: y, uri, watched: false, rewatches: 0, watchlist: false };
      films.set(key, film);
    }
    return film;
  };

  for (const row of files.watched ? readTable(files.watched) : []) {
    const film = touch(row);
    if (film) film.watched = true;
  }
  for (const row of files.ratings ? readTable(files.ratings) : []) {
    const film = touch(row);
    if (film) {
      film.watched = true;
      film.rating = stars(row.Rating) ?? film.rating;
    }
  }
  for (const row of files.diary ? readTable(files.diary) : []) {
    const film = touch(row);
    if (!film) continue;
    film.watched = true;
    if (row.Rewatch === "Yes") film.rewatches++;
    const date = row["Watched Date"] ?? "";
    if (DATE.test(date) && (!film.last || date > film.last)) film.last = date;
    film.rating ??= stars(row.Rating);
  }
  for (const row of files.watchlist ? readTable(files.watchlist) : []) {
    const film = touch(row);
    if (film && !film.watched) film.watchlist = true;
  }
  return [...films.values()];
}
