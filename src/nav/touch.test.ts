import { describe, expect, it } from "vitest";
import { EDGE, SLOP, SWIPE, exceedsSlop, isBackSwipe } from "./touch";

const at = (x: number, y: number, t: number) => ({ x, y, t });

describe("press slop", () => {
  it("lets a finger drift a little", () => {
    expect(exceedsSlop(6, 6)).toBe(false);
    expect(exceedsSlop(SLOP, 0)).toBe(false);
  });
  it("calls a longer move a scroll", () => {
    expect(exceedsSlop(0, SLOP + 1)).toBe(true);
    expect(exceedsSlop(9, 9)).toBe(true);
  });
});

describe("back swipe", () => {
  it("accepts a quick, level swipe in from the left edge", () => {
    expect(isBackSwipe(at(4, 300, 0), at(4 + SWIPE + 20, 310, 250))).toBe(true);
  });
  it("ignores a swipe that starts away from the edge", () => {
    expect(isBackSwipe(at(EDGE + 1, 300, 0), at(300, 300, 200))).toBe(false);
  });
  it("ignores a short one, a slow one and one going left", () => {
    expect(isBackSwipe(at(4, 300, 0), at(4 + SWIPE - 1, 300, 200))).toBe(false);
    expect(isBackSwipe(at(4, 300, 0), at(200, 300, 900))).toBe(false);
    expect(isBackSwipe(at(4, 300, 0), at(-100, 300, 100))).toBe(false);
  });
  it("ignores a mostly vertical drag", () => {
    expect(isBackSwipe(at(4, 100, 0), at(100, 400, 300))).toBe(false);
  });
});
