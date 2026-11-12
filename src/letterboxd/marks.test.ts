import { describe, expect, it } from "vitest";
import type { Item } from "../api/items";
import { withFeed } from "./marks";

const movie = (id: string, tmdb: string): Item => ({ id, type: "Movie", name: id, sortName: id, year: 2000, tmdb, genres: [], played: false, favorite: false }) as Item;
const seen = (more: object) => ({ name: "A", year: 2000, uri: "", watched: true, rewatches: 0, watchlist: false, ...more });

describe("withFeed", () => {
  it("adds films the export lacks and lets newer entries win", () => {
    const base = new Map([["a", seen({ rating: 3, last: "2020-01-01", watchlist: false })]]);
    const out = withFeed(base, [movie("a", "1"), movie("b", "2"), movie("c", "3")], [
      { tmdb: "1", rating: 4.5, date: "2026-01-01", rewatch: true },
      { tmdb: "2", rating: null, date: "2026-02-02", rewatch: false },
    ]);
    expect(out.get("a")).toMatchObject({ rating: 4.5, last: "2026-01-01", rewatches: 1 });
    expect(out.get("b")).toMatchObject({ watched: true, rating: undefined, last: "2026-02-02" });
    expect(out.has("c")).toBe(false);
  });
  it("does not count a feed entry already in the export as another rewatch", () => {
    const base = new Map([["a", seen({ last: "2026-01-01", rewatches: 1 })]]);
    const out = withFeed(base, [movie("a", "1")], [{ tmdb: "1", rating: null, date: "2026-01-01", rewatch: true }]);
    expect(out.get("a")?.rewatches).toBe(1);
  });
});
