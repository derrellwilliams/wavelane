import { describe, expect, it } from "vitest";
import { visibleRows, withFocus } from "./rows";

// A 1080 px view over rows 400 px apart.
describe("visibleRows", () => {
  it("covers the view plus spare rows, starting at the top", () => {
    expect(visibleRows(0, 1080, 400, 100, 2)).toEqual({ first: 0, last: 4 });
  });

  it("follows the scroll", () => {
    expect(visibleRows(4000, 1080, 400, 100, 2)).toEqual({ first: 8, last: 14 });
  });

  it("stops at the last row", () => {
    expect(visibleRows(39000, 1080, 400, 100, 2)).toEqual({ first: 95, last: 99 });
  });

  it("copes with a grid that starts lower down the page", () => {
    expect(visibleRows(-300, 1080, 400, 100, 2)).toEqual({ first: 0, last: 3 });
  });

  it("is empty for an empty grid", () => {
    const rows = visibleRows(0, 1080, 400, 0, 2);
    expect(rows.last).toBeLessThan(rows.first);
  });
});

describe("withFocus", () => {
  it("leaves rows alone when focus is among them", () => {
    expect(withFocus({ first: 8, last: 14 }, 10, 100, 2)).toEqual({ first: 8, last: 14 });
  });

  it("reaches out to the focused row and its neighbours", () => {
    expect(withFocus({ first: 8, last: 14 }, 14, 100, 2)).toEqual({ first: 8, last: 16 });
    expect(withFocus({ first: 8, last: 14 }, 3, 100, 2)).toEqual({ first: 1, last: 14 });
  });

  it("ignores a focused row that no longer exists", () => {
    expect(withFocus({ first: 0, last: 2 }, 50, 3, 2)).toEqual({ first: 0, last: 2 });
  });
});
