import { describe, expect, it } from "vitest";
import type { Item } from "../../api/items";
import type { Average } from "../../letterboxd/average";
import { topUnwatched } from "./spotlight";

const art = { id: "a".repeat(32), tag: "t" } as unknown as Item["backdrop"];

function movie(name: string, tmdb: string, more: Partial<Item> = {}): Item {
  return { id: name, type: "Movie", name, sortName: name.toLowerCase(), genres: [], played: false, favorite: false, tmdb, backdrop: art, ...more };
}

const rate = (...entries: [string, number | null][]) =>
  new Map<string, Average>(entries.map(([id, rating]) => [id, { rating, count: 1000, at: 0 }]));

describe("topUnwatched", () => {
  const library = [
    movie("Low", "1"),
    movie("High", "2"),
    movie("Seen", "3", { played: true }),
    movie("NoArt", "4", { backdrop: undefined }),
    movie("Unrated", "5"),
    movie("Cartoon", "6", { genres: ["Children"] }),
    movie("Mid", "7"),
  ];
  const known = rate(["1", 3.1], ["2", 4.5], ["3", 4.9], ["4", 4.8], ["5", null], ["6", 4.7], ["7", 3.9]);

  it("lists unwatched movies with a backdrop and an average, best first, without children's movies", () => {
    expect(topUnwatched(library, new Map(), known).map((item) => item.name)).toEqual(["High", "Mid", "Low"]);
  });

  it("takes watched from Letterboxd once a log is loaded", () => {
    const marks = new Map([["High", { name: "High", year: 2000, uri: "https://boxd.it/x", watched: true, rewatches: 0, watchlist: false }]]);
    expect(topUnwatched(library, marks, known).map((item) => item.name)).toEqual(["Seen", "Mid", "Low"]); // Jellyfin's played flag no longer counts
  });

  it("stops at the count and copes with nothing known yet", () => {
    expect(topUnwatched(library, new Map(), known, 1)).toHaveLength(1);
    expect(topUnwatched(library, new Map(), new Map())).toEqual([]);
    expect(topUnwatched(undefined, new Map(), known)).toEqual([]);
  });
});
