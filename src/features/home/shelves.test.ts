import { describe, expect, it } from "vitest";
import type { Item } from "../../api/items";
import type { Average } from "../../letterboxd/average";
import { recentlyAdded, unwatchedMovies } from "./shelves";

function film(name: string, tmdb: string, more: Partial<Item> = {}): Item {
  return { id: name, type: "Movie", name, sortName: name.toLowerCase(), genres: [], played: false, favorite: false, tmdb, ...more };
}
const rate = (...entries: [string, number][]) => new Map<string, Average>(entries.map(([id, rating]) => [id, { rating, count: 1, at: 0 }]));
const names = (items: Item[]) => items.map((item) => item.name);

describe("unwatchedMovies", () => {
  const library = [
    film("Low", "1", { added: 10 }),
    film("High", "2", { added: 20 }),
    film("Seen", "3", { played: true }),
    film("OldUnrated", "4", { added: 5 }),
    film("NewUnrated", "5", { added: 50 }),
    film("Cartoon", "6", { genres: ["Kids"] }),
  ];
  const known = rate(["1", 3.1], ["2", 4.5], ["3", 4.9], ["6", 4.8]);

  it("puts rated movies first by average, then unrated ones newest first, and drops watched and kids' movies", () => {
    expect(names(unwatchedMovies(library, new Map(), known))).toEqual(["High", "Low", "NewUnrated", "OldUnrated"]);
  });

  it("stops at the count", () => {
    expect(unwatchedMovies(library, new Map(), known, 2)).toHaveLength(2);
    expect(unwatchedMovies(undefined, new Map(), known)).toEqual([]);
  });
});

describe("recentlyAdded", () => {
  it("mixes movies and shows, newest first, up to the count", () => {
    const shows = [film("Show", "9", { type: "Series", added: 30 })];
    const movies = [film("A", "1", { added: 10 }), film("B", "2", { added: 40 })];
    expect(names(recentlyAdded(movies, shows))).toEqual(["B", "Show", "A"]);
    expect(recentlyAdded(movies, shows, 2)).toHaveLength(2);
    expect(recentlyAdded(undefined, undefined)).toEqual([]);
  });
});
