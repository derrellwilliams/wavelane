import { describe, expect, it } from "vitest";
import type { Item } from "../../api/items";
import { inKids, isKidsShow, kidsIds, looksKids, readOverrides, setKids, overrides } from "./kids";

const A = "a".repeat(32);
const B = "b".repeat(32);

function show(id: string, more: Partial<Item> = {}): Item {
  return { id, type: "Series", name: id, sortName: id, genres: [], played: false, favorite: false, ...more };
}

const NONE = readOverrides(null);

describe("looksKids", () => {
  it("recognises children's ratings in any case, with or without a country", () => {
    expect(looksKids({ certificate: "TV-Y", genres: [] })).toBe(true);
    expect(looksKids({ certificate: "tv-y7", genres: [] })).toBe(true);
    expect(looksKids({ certificate: "US:TV-Y7-FV", genres: [] })).toBe(true);
  });

  it("recognises the Children and Kids genres", () => {
    expect(looksKids({ genres: ["Animation", "Children"] })).toBe(true);
    expect(looksKids({ genres: ["kids"] })).toBe(true);
  });

  it("does not take general ratings or Family or Animation for kids", () => {
    expect(looksKids({ certificate: "TV-G", genres: ["Family", "Animation"] })).toBe(false);
    expect(looksKids({ certificate: "TV-14", genres: [] })).toBe(false);
    expect(looksKids({ genres: [] })).toBe(false);
  });
});

describe("overrides", () => {
  it("beat what the server says, in both directions", () => {
    const choices = { yes: new Set([A]), no: new Set([B]) };
    expect(isKidsShow(show(A), choices)).toBe(true);
    expect(isKidsShow(show(B, { certificate: "TV-Y" }), choices)).toBe(false);
  });

  it("are stored only when they differ from the server, and cleared when they match again", () => {
    const plain = show(A);
    setKids(plain, true);
    expect(overrides.value.yes.has(A)).toBe(true);
    setKids(plain, false);
    expect(overrides.value.yes.has(A)).toBe(false);
    expect(overrides.value.no.has(A)).toBe(false);
    const young = show(B, { certificate: "TV-Y" });
    setKids(young, false);
    expect(overrides.value.no.has(B)).toBe(true);
    setKids(young, true);
    expect(overrides.value.no.has(B)).toBe(false);
  });

  it("read back from storage, ignoring anything that is not an id", () => {
    const read = readOverrides(JSON.stringify({ yes: [A, 7, "<script>"], no: "x" }));
    expect([...read.yes]).toEqual([A]);
    expect(read.no.size).toBe(0);
    expect(readOverrides("not json")).toEqual(readOverrides(null));
  });
});

describe("inKids", () => {
  const shows = [show(A, { certificate: "TV-Y" }), show(B, { certificate: "TV-MA" })];
  const ids = kidsIds(shows, NONE);

  it("puts a kids' show and its episodes in Kids, and nothing else", () => {
    expect(ids).toEqual(new Set([A]));
    expect(inKids(shows[0]!, ids, NONE)).toBe(true);
    expect(inKids(show("e1", { type: "Episode", seriesId: A }), ids, NONE)).toBe(true);
    expect(inKids(show("e2", { type: "Episode", seriesId: B }), ids, NONE)).toBe(false);
    expect(inKids(show("m", { type: "Movie", certificate: "TV-Y" }), ids, NONE)).toBe(false);
  });
});
