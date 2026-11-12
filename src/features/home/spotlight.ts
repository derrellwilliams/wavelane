/// Home's spotlight when there is nothing to continue: the best-liked movies you haven't seen,
/// by Letterboxd's average rating, taking turns.
import type { Item } from "../../api/items";
import type { Average } from "../../letterboxd/average";
import { looksKids } from "../kids/kids";
import { watched, type Marks } from "../library/arrange";

export const SPOTLIGHT_COUNT = 8;

/// Movies not yet watched (by Letterboxd once a log is loaded, else by Jellyfin) with a known
/// average and a backdrop, highest average first. Children's movies are left out.
export function topUnwatched(
  library: readonly Item[] | undefined,
  marks: Marks,
  averages: ReadonlyMap<string, Average>,
  count = SPOTLIGHT_COUNT,
): Item[] {
  if (!library) return [];
  const rated: { item: Item; rating: number }[] = [];
  for (const item of library) {
    const rating = item.tmdb ? averages.get(item.tmdb)?.rating : null;
    if (rating == null || !item.backdrop || watched(item, marks) || looksKids(item)) continue;
    rated.push({ item, rating });
  }
  return rated
    .sort((a, b) => b.rating - a.rating || (a.item.sortName < b.item.sortName ? -1 : 1))
    .slice(0, count)
    .map((entry) => entry.item);
}
