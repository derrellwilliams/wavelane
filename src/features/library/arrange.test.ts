import { describe, expect, it } from "vitest";
import type { Item } from "../../api/items";
import { arrange, decadesOf, DEFAULT_VIEW, isFiltered, readView } from "./arrange";

function movie(name: string, more: Partial<Item> = {}): Item {
  return { id: name, type: "Movie", name, sortName: name.toLowerCase(), genres: [], played: false, favorite: false, ...more };
}

const LIBRARY = [
  movie("Heat", { year: 1995, rating: 8.3, minutes: 170, added: 300, genres: ["Crime", "Drama"], played: true }),
  movie("Alien", { year: 1979, rating: 8.5, minutes: 117, added: 100, genres: ["Horror"], favorite: true }),
  movie("Zodiac", { year: 2007, rating: 7.7, minutes: 157, added: 200, genres: ["Crime"] }),
  movie("Mystery", { genres: ["Drama"] }),
];
const names = (items: Item[]) => items.map((item) => item.name);

describe("arrange", () => {
  it("sorts by name without changing the list it was given", () => {
    const before = names(LIBRARY);
    expect(names(arrange(LIBRARY, DEFAULT_VIEW))).toEqual(["Alien", "Heat", "Mystery", "Zodiac"]);
    expect(names(LIBRARY)).toEqual(before);
  });

  it("puts newest, best and shortest first, and items missing the value last", () => {
    expect(names(arrange(LIBRARY, { ...DEFAULT_VIEW, sort: "added" }))).toEqual(["Heat", "Zodiac", "Alien", "Mystery"]);
    expect(names(arrange(LIBRARY, { ...DEFAULT_VIEW, sort: "year" }))).toEqual(["Zodiac", "Heat", "Alien", "Mystery"]);
    expect(names(arrange(LIBRARY, { ...DEFAULT_VIEW, sort: "rating" }))).toEqual(["Alien", "Heat", "Zodiac", "Mystery"]);
    expect(names(arrange(LIBRARY, { ...DEFAULT_VIEW, sort: "runtime" }))).toEqual(["Alien", "Zodiac", "Heat", "Mystery"]);
  });

  it("breaks ties by name", () => {
    const tied = [movie("B", { year: 2000 }), movie("A", { year: 2000 })];
    expect(names(arrange(tied, { ...DEFAULT_VIEW, sort: "year" }))).toEqual(["A", "B"]);
  });

  it("takes watched from Letterboxd, not Jellyfin, once there is a log", () => {
    const zodiac = LIBRARY.find((item) => item.name === "Zodiac")!;
    const marks = new Map([[zodiac.id, { name: "Zodiac", year: 2007, uri: "", watched: true, rewatches: 0, watchlist: false }]]);
    // Heat is played in Jellyfin but not in the log, so it still counts as unwatched.
    expect(names(arrange(LIBRARY, { ...DEFAULT_VIEW, unwatched: true }, marks))).toEqual(["Alien", "Heat", "Mystery"]);
    // With no log, Jellyfin's flag is used.
    expect(names(arrange(LIBRARY, { ...DEFAULT_VIEW, unwatched: true }))).toEqual(["Alien", "Mystery", "Zodiac"]);
  });

  it("filters by decade, unwatched and favorites together", () => {
    expect(names(arrange(LIBRARY, { ...DEFAULT_VIEW, decade: "2000", unwatched: true }))).toEqual(["Zodiac"]);
    expect(names(arrange(LIBRARY, { ...DEFAULT_VIEW, decade: "1990" }))).toEqual(["Heat"]);
    expect(names(arrange(LIBRARY, { ...DEFAULT_VIEW, favorites: true }))).toEqual(["Alien"]);
    expect(arrange(LIBRARY, { ...DEFAULT_VIEW, favorites: true, decade: "2000" })).toEqual([]);
  });
});

describe("filter choices", () => {
  it("lists decades newest first", () => {
    expect(decadesOf(LIBRARY)).toEqual(["2000", "1990", "1970"]);
  });

  it("knows when a filter is on", () => {
    expect(isFiltered(DEFAULT_VIEW)).toBe(false);
    expect(isFiltered({ ...DEFAULT_VIEW, sort: "year" })).toBe(false);
    expect(isFiltered({ ...DEFAULT_VIEW, unwatched: true })).toBe(true);
  });
});

describe("arrange with a Letterboxd log", () => {
  const seen = (more: object) => ({ name: "", year: 2000, uri: "", watched: true, rewatches: 0, watchlist: false, ...more });
  const marks = new Map([
    ["Heat", seen({ rating: 4, last: "2021-05-01" })],
    ["Alien", seen({ rating: 5, last: "2020-01-01" })],
    ["Mystery", seen({ watched: false, watchlist: true })],
  ]);
  it("sorts by your rating and by the date you watched, unlogged last", () => {
    expect(names(arrange(LIBRARY, { ...DEFAULT_VIEW, sort: "mine" }, marks))).toEqual(["Alien", "Heat", "Mystery", "Zodiac"]);
    expect(names(arrange(LIBRARY, { ...DEFAULT_VIEW, sort: "seen" }, marks))).toEqual(["Heat", "Alien", "Mystery", "Zodiac"]);
  });
  it("filters watched, not watched and watchlist", () => {
    expect(names(arrange(LIBRARY, { ...DEFAULT_VIEW, seeing: "watched" }, marks))).toEqual(["Alien", "Heat"]);
    expect(names(arrange(LIBRARY, { ...DEFAULT_VIEW, seeing: "unwatched" }, marks))).toEqual(["Mystery", "Zodiac"]);
    expect(names(arrange(LIBRARY, { ...DEFAULT_VIEW, seeing: "watchlist" }, marks))).toEqual(["Mystery"]);
    expect(isFiltered({ ...DEFAULT_VIEW, seeing: "watched" })).toBe(true);
  });
});

describe("readView", () => {
  it("reads back a saved view", () => {
    const view = { sort: "rating", decade: "1990", unwatched: true, favorites: false, seeing: "watchlist" } as const;
    expect(readView(JSON.stringify(view))).toEqual(view);
  });

  it("falls back to the default for anything unexpected", () => {
    expect(readView(null)).toEqual(DEFAULT_VIEW);
    expect(readView("{not json")).toEqual(DEFAULT_VIEW);
    expect(readView("null")).toEqual(DEFAULT_VIEW);
    expect(readView(JSON.stringify({ sort: "__proto__", decade: "199", unwatched: "yes" }))).toEqual(DEFAULT_VIEW);
  });
});
