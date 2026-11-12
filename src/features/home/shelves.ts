/// What Home's movie shelves hold, worked out from the cached library on the TV.
import type { Item } from "../../api/items";
import type { Average } from "../../letterboxd/average";
import { looksKids } from "../kids/kids";
import { watched, type Marks } from "../library/arrange";

export const SHELF_COUNT = 24;

/// Movies not watched yet (by Letterboxd once a log is loaded, else by Jellyfin), highest
/// Letterboxd average first, those without a known average after them, newest first.
/// Children's movies are left out.
export function unwatchedMovies(
  library: readonly Item[] | undefined,
  marks: Marks,
  averages: ReadonlyMap<string, Average>,
  count = SHELF_COUNT,
): Item[] {
  if (!library) return [];
  const rating = (item: Item) => (item.tmdb ? (averages.get(item.tmdb)?.rating ?? null) : null);
  return library
    .filter((item) => !watched(item, marks) && !looksKids(item))
    .sort((a, b) => {
      const x = rating(a);
      const y = rating(b);
      if (x !== null && y !== null && x !== y) return y - x;
      if ((x === null) !== (y === null)) return x === null ? 1 : -1;
      return (b.added ?? 0) - (a.added ?? 0);
    })
    .slice(0, count);
}

/// The newest movies and shows added to the library, mixed, newest first.
export function recentlyAdded(movies: readonly Item[] | undefined, shows: readonly Item[] | undefined, count = SHELF_COUNT): Item[] {
  return [...(movies ?? []), ...(shows ?? [])].sort((a, b) => (b.added ?? 0) - (a.added ?? 0)).slice(0, count);
}
