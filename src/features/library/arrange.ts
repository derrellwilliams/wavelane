/// Sorting and filtering a library on the TV. The whole list is already in memory (and in the
/// cache), so changing the order or a filter never waits for the server.
import type { Item } from "../../api/items";

export type SortKey = "name" | "added" | "year" | "rating" | "runtime";

export interface View {
  sort: SortKey;
  /// "" for all genres.
  genre: string;
  /// First year of the decade ("1990"), or "" for any.
  decade: string;
  unwatched: boolean;
  favorites: boolean;
}

export const DEFAULT_VIEW: View = { sort: "name", genre: "", decade: "", unwatched: false, favorites: false };

export const SORTS: { id: SortKey; label: string }[] = [
  { id: "name", label: "Name" },
  { id: "added", label: "Date added" },
  { id: "year", label: "Year" },
  { id: "rating", label: "Rating" },
  { id: "runtime", label: "Runtime" },
];

/// The value a sort compares, and whether larger comes first. Name is handled apart.
const BY: Record<Exclude<SortKey, "name">, { of: (item: Item) => number | undefined; descending: boolean }> = {
  added: { of: (item) => item.added, descending: true },
  year: { of: (item) => item.year, descending: true },
  rating: { of: (item) => item.rating, descending: true },
  runtime: { of: (item) => item.minutes, descending: false },
};

function byName(a: Item, b: Item): number {
  return a.sortName < b.sortName ? -1 : a.sortName > b.sortName ? 1 : 0;
}

const decadeOf = (item: Item) => (item.year === undefined ? "" : String(Math.floor(item.year / 10) * 10));

export function isFiltered(view: View): boolean {
  return !!view.genre || !!view.decade || view.unwatched || view.favorites;
}

/// The items to show, in order. Items missing the value being sorted on go last; ties go by name.
export function arrange(items: readonly Item[], view: View): Item[] {
  const shown = items.filter(
    (item) =>
      (!view.genre || item.genres.includes(view.genre)) &&
      (!view.decade || decadeOf(item) === view.decade) &&
      (!view.unwatched || !item.played) &&
      (!view.favorites || item.favorite),
  );
  if (view.sort === "name") return shown.sort(byName);
  const { of, descending } = BY[view.sort];
  return shown.sort((a, b) => {
    const x = of(a);
    const y = of(b);
    if (x === y) return byName(a, b);
    if (x === undefined) return 1;
    if (y === undefined) return -1;
    return descending ? y - x : x - y;
  });
}

/// Every genre in the list, A to Z.
export function genresOf(items: readonly Item[]): string[] {
  const all = new Set<string>();
  for (const item of items) for (const genre of item.genres) all.add(genre);
  return [...all].sort((a, b) => a.localeCompare(b));
}

/// Every decade in the list, newest first.
export function decadesOf(items: readonly Item[]): string[] {
  const all = new Set<string>();
  for (const item of items) if (item.year !== undefined) all.add(decadeOf(item));
  return [...all].sort((a, b) => Number(b) - Number(a));
}

/// A saved view read back from storage: anything unexpected falls back to the default.
export function readView(raw: string | null): View {
  if (!raw) return DEFAULT_VIEW;
  try {
    const saved = JSON.parse(raw) as Partial<Record<keyof View, unknown>> | null;
    if (!saved || typeof saved !== "object") return DEFAULT_VIEW;
    return {
      sort: SORTS.some((sort) => sort.id === saved.sort) ? (saved.sort as SortKey) : "name",
      genre: typeof saved.genre === "string" ? saved.genre.slice(0, 60) : "",
      decade: typeof saved.decade === "string" && /^\d{4}$/.test(saved.decade) ? saved.decade : "",
      unwatched: saved.unwatched === true,
      favorites: saved.favorites === true,
    };
  } catch {
    return DEFAULT_VIEW;
  }
}
