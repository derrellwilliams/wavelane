import { describe, expect, it } from "vitest";
import { scrollOffset } from "./scroll";

// A 1000 px view over 3000 px of content (so it can scroll to 2000), 50 px of room each side.
const at = (start: number, end: number, current: number) => scrollOffset(start, end, current, 1000, 2000, 50, 50);

describe("scrollOffset", () => {
  it("stays put when the item is already in view", () => {
    expect(at(100, 300, 0)).toBe(0);
    expect(at(600, 800, 500)).toBe(500);
  });

  it("scrolls forward just far enough, leaving room after the item", () => {
    expect(at(900, 1100, 0)).toBe(150);
  });

  it("scrolls back just far enough, leaving room before the item", () => {
    expect(at(400, 600, 500)).toBe(350);
  });

  it("never scrolls past either end", () => {
    expect(at(0, 200, 300)).toBe(0);
    expect(at(2900, 3000, 0)).toBe(2000);
  });

  it("shows the start of an item larger than the view", () => {
    expect(at(1000, 2500, 0)).toBe(950);
  });

  it("doesn't scroll content that fits", () => {
    expect(scrollOffset(700, 900, 0, 1000, -100, 50, 50)).toBe(0);
  });
});
