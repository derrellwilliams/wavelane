import { describe, expect, it } from "vitest";
import { pickNext, type Box } from "./geometry";

const box = (left: number, top: number, width = 100, height = 100): Box => ({
  left,
  top,
  right: left + width,
  bottom: top + height,
});

describe("pickNext", () => {
  it("moves along a row to the nearest item", () => {
    const row = [box(0, 0), box(120, 0), box(240, 0)];
    expect(pickNext(row[0]!, row, "right")).toBe(1);
    expect(pickNext(row[2]!, row, "left")).toBe(1);
  });

  it("returns -1 at the edge", () => {
    const row = [box(0, 0), box(120, 0)];
    expect(pickNext(row[0]!, row, "left")).toBe(-1);
    expect(pickNext(row[1]!, row, "right")).toBe(-1);
    expect(pickNext(row[0]!, row, "up")).toBe(-1);
  });

  it("prefers the item in the same row over a nearer one off to the side", () => {
    const from = box(0, 0);
    const sameRowFar = box(600, 0);
    const otherRowNear = box(120, 300);
    expect(pickNext(from, [from, sameRowFar, otherRowNear], "right")).toBe(1);
  });

  it("moves down a stacked form, including to a narrower control", () => {
    const field = box(0, 0, 800, 84);
    const button = box(0, 110, 240, 84);
    const second = box(260, 110, 240, 84);
    expect(pickNext(field, [field, button, second], "down")).toBe(1);
    expect(pickNext(second, [field, button, second], "up")).toBe(0);
    expect(pickNext(button, [field, button, second], "right")).toBe(2);
  });

  it("drops from a grid row to the item directly below", () => {
    const grid = [box(0, 0), box(120, 0), box(240, 0), box(0, 120), box(120, 120), box(240, 120)];
    expect(pickNext(grid[1]!, grid, "down")).toBe(4);
    expect(pickNext(grid[5]!, grid, "up")).toBe(2);
  });

  it("reaches a rail beside a shelf that sits lower on the screen", () => {
    const rail = box(0, 0, 80, 80);
    const poster = box(200, 400, 200, 300);
    expect(pickNext(rail, [rail, poster], "right")).toBe(1);
    expect(pickNext(poster, [rail, poster], "left")).toBe(0);
  });

  it("ignores the box it started from", () => {
    const only = box(0, 0);
    expect(pickNext(only, [only], "right")).toBe(-1);
  });
});
