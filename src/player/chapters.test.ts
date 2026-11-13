import { describe, expect, it } from "vitest";
import { chapterAt, toChapters } from "./chapters";

const tick = (seconds: number) => seconds * 10_000_000;

describe("toChapters", () => {
  it("keeps valid chapters in order and names the unnamed", () => {
    const list = toChapters([
      { Name: "Second", StartPositionTicks: tick(600) },
      { StartPositionTicks: tick(0) },
      { Name: "Bad", StartPositionTicks: -5 },
      { Name: "Worse", StartPositionTicks: "x" },
      null,
    ]);
    expect(list).toEqual([
      { name: "Chapter 1", start: 0 },
      { name: "Second", start: 600 },
    ]);
  });
  it("gives nothing for a non-list", () => {
    expect(toChapters(undefined)).toEqual([]);
    expect(toChapters({})).toEqual([]);
  });
});

describe("chapterAt", () => {
  const list = toChapters([{ StartPositionTicks: tick(10) }, { StartPositionTicks: tick(100) }]);
  it("finds the chapter holding a position", () => {
    expect(chapterAt(list, 5)).toBe(-1);
    expect(chapterAt(list, 10)).toBe(0);
    expect(chapterAt(list, 99)).toBe(0);
    expect(chapterAt(list, 500)).toBe(1);
  });
});
