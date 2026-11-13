import { describe, expect, it } from "vitest";
import type { Item } from "../api/items";
import { estimateBytes, fileName, fits, isFinished, nextToStart, queueProgress, SPARE_BYTES, startPosition, toSave, type Saved } from "./plan";

const item = (id: string, played = false) => ({ id, type: "Episode", name: id, sortName: id, genres: [], played, favorite: false }) as Item;
const saved = (id: string, state: Saved["state"], over: Partial<Saved> = {}): Saved => ({
  id,
  item: item(id),
  kind: "original",
  state,
  file: `${id}.mkv`,
  bytes: 0,
  total: 0,
  estimate: 1000,
  subs: [],
  addedAt: 0,
  ...over,
});

describe("nextToStart", () => {
  it("starts the first queued item", () => {
    expect(nextToStart([saved("a", "done"), saved("b", "queued"), saved("c", "queued")])?.id).toBe("b");
  });
  it("waits while one is running", () => {
    expect(nextToStart([saved("a", "running"), saved("b", "queued")])).toBeUndefined();
  });
  it("does not restart a failed or paused one", () => {
    expect(nextToStart([saved("a", "failed"), saved("b", "paused")])).toBeUndefined();
  });
});

describe("fits", () => {
  it("keeps a spare margin", () => {
    expect(fits(1000, 1000 + SPARE_BYTES, [])).toBe(true);
    expect(fits(1001, 1000 + SPARE_BYTES, [])).toBe(false);
  });
  it("counts what unfinished transfers still need", () => {
    const list = [saved("a", "running", { estimate: 600, bytes: 100 }), saved("b", "done", { estimate: 9999 })];
    expect(fits(501, 1000 + SPARE_BYTES, list)).toBe(false);
    expect(fits(500, 1000 + SPARE_BYTES, list)).toBe(true);
  });
});

describe("fileName", () => {
  it("is made from the id and a safe extension", () => {
    expect(fileName("0a1b-2c", "original", "mkv")).toBe("0a1b-2c.mkv");
    expect(fileName("0a1b", "converted", "mkv")).toBe("0a1b.mp4");
    expect(fileName("0a1b", "original", "../x")).toBe("0a1b.mp4");
    expect(fileName("../../etc", "original", "mp4")).not.toContain("/");
  });
});

describe("estimateBytes", () => {
  it("uses the file size for an original", () => {
    expect(estimateBytes("original", 5e9, 7200, 4e6)).toBe(5e9);
  });
  it("uses runtime times bitrate for a conversion", () => {
    expect(estimateBytes("converted", undefined, 3600, 4_000_000)).toBe(1_800_000_000);
  });
});

describe("offline progress", () => {
  it("keeps the newest entry per film", () => {
    const list = queueProgress(queueProgress([], { id: "a", seconds: 10, finished: false, at: 1 }), { id: "a", seconds: 99, finished: false, at: 2 });
    expect(list).toEqual([{ id: "a", seconds: 99, finished: false, at: 2 }]);
  });
  it("calls a film finished near the end", () => {
    expect(isFinished(92, 100)).toBe(true);
    expect(isFinished(50, 100)).toBe(false);
    expect(isFinished(5, 0)).toBe(false);
  });
  it("starts from the later position", () => {
    expect(startPosition({ position: 300 }, 100)).toBe(300);
    expect(startPosition({}, 100)).toBe(100);
  });
});

describe("toSave", () => {
  it("skips saved and, when asked, watched episodes", () => {
    const list = [item("a"), item("b", true), item("c")];
    expect(toSave(list, new Set(["a"]), false).map((e) => e.id)).toEqual(["b", "c"]);
    expect(toSave(list, new Set(), true).map((e) => e.id)).toEqual(["a", "c"]);
  });
});
