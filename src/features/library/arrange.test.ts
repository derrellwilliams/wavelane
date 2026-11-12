import { describe, expect, it } from "vitest";
import type { Item } from "../../api/items";
import { arrange, decadesOf, DEFAULT_VIEW, genresOf, isFiltered, readView } from "./arrange";

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

  it("filters by genre, decade, unwatched and favorites together", () => {
    expect(names(arrange(LIBRARY, { ...DEFAULT_VIEW, genre: "Crime" }))).toEqual(["Heat", "Zodiac"]);
    expect(names(arrange(LIBRARY, { ...DEFAULT_VIEW, genre: "Crime", unwatched: true }))).toEqual(["Zodiac"]);
    expect(names(arrange(LIBRARY, { ...DEFAULT_VIEW, decade: "1990" }))).toEqual(["Heat"]);
    expect(names(arrange(LIBRARY, { ...DEFAULT_VIEW, favorites: true }))).toEqual(["Alien"]);
    expect(arrange(LIBRARY, { ...DEFAULT_VIEW, favorites: true, genre: "Crime" })).toEqual([]);
  });
});

describe("filter choices", () => {
  it("lists genres A to Z and decades newest first", () => {
    expect(genresOf(LIBRARY)).toEqual(["Crime", "Drama", "Horror"]);
    expect(decadesOf(LIBRARY)).toEqual(["2000", "1990", "1970"]);
  });

  it("knows when a filter is on", () => {
    expect(isFiltered(DEFAULT_VIEW)).toBe(false);
    expect(isFiltered({ ...DEFAULT_VIEW, sort: "year" })).toBe(false);
    expect(isFiltered({ ...DEFAULT_VIEW, unwatched: true })).toBe(true);
  });
});

describe("readView", () => {
  it("reads back a saved view", () => {
    const view = { sort: "rating", genre: "Crime", decade: "1990", unwatched: true, favorites: false } as const;
    expect(readView(JSON.stringify(view))).toEqual(view);
  });

  it("falls back to the default for anything unexpected", () => {
    expect(readView(null)).toEqual(DEFAULT_VIEW);
    expect(readView("{not json")).toEqual(DEFAULT_VIEW);
    expect(readView("null")).toEqual(DEFAULT_VIEW);
    expect(readView(JSON.stringify({ sort: "__proto__", genre: 5, decade: "199", unwatched: "yes" }))).toEqual(DEFAULT_VIEW);
  });
});
