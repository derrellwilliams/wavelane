import { describe, expect, it } from "vitest";
import { pickNext, readAverages, type Average } from "./average";

const NOW = 1_000_000_000_000;
const DAY = 24 * 60 * 60 * 1000;
const known = (entries: [string, Partial<Average>][]) => new Map(entries.map(([id, v]) => [id, { rating: 4, count: 10, at: NOW, ...v }]));

describe("pickNext", () => {
  it("takes the film being looked at first, then the library in order, skipping fresh ones", () => {
    const have = known([["1", {}], ["2", { at: NOW - 31 * DAY }]]);
    expect(pickNext(["1", "2", "3"], [], have, NOW)).toBe("2");
    expect(pickNext(["1", "2", "3"], ["3"], have, NOW)).toBe("3");
    expect(pickNext(["1"], ["1"], have, NOW)).toBeNull();
  });
  it("ignores anything that is not a TMDB ID", () => {
    expect(pickNext(["../x", "12"], ["a/b"], new Map(), NOW)).toBe("12");
  });
});

describe("readAverages", () => {
  it("keeps good rows and drops the rest", () => {
    const raw = JSON.stringify([["5", 4.5, 100, NOW], ["x", 4, 1, NOW], ["6", 9, 0, NOW], ["7", null, null, 0], "junk"]);
    const map = readAverages(raw);
    expect([...map.keys()].sort()).toEqual(["5", "6"]);
    expect(map.get("6")).toEqual({ rating: null, count: null, at: NOW });
    expect(readAverages("{bad").size).toBe(0);
  });
});

