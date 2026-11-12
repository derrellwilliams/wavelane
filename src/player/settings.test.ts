import { describe, expect, it } from "vitest";
import { autoplayOn, QUALITIES, readQuality } from "./settings";
import { DEFAULT_MAX_BITRATE } from "./profile";

describe("playback settings", () => {
  it("defaults to original quality and autoplay on", () => {
    expect(readQuality(null).bitrate).toBe(DEFAULT_MAX_BITRATE);
    expect(autoplayOn(null)).toBe(true);
  });
  it("reads a saved quality and ignores unknown values", () => {
    expect(readQuality("10").bitrate).toBe(10_000_000);
    expect(readQuality("bogus").id).toBe("auto");
  });
  it("turns autoplay off only on 'off'", () => {
    expect(autoplayOn("off")).toBe(false);
    expect(autoplayOn("on")).toBe(true);
  });
  it("lists qualities from high to low", () => {
    const rates = QUALITIES.map((quality) => quality.bitrate);
    expect(rates).toEqual([...rates].sort((a, b) => b - a));
  });
});
