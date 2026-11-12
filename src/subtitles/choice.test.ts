import { describe, expect, it } from "vitest";
import { describeChoice, readChoice, resolveChoice } from "./choice";
import type { SubTrack } from "./tracks";

const track = (index: number, more: Partial<SubTrack> = {}): SubTrack => ({ index, label: `Track ${index}`, forced: false, sdh: false, external: false, text: true, isDefault: false, ...more });
const TRACKS = [track(2, { language: "eng", forced: true }), track(3, { language: "eng", sdh: true }), track(4, { language: "eng" }), track(5, { language: "spa" })];

describe("readChoice", () => {
  it("reads the three kinds and rejects anything else", () => {
    expect(readChoice('{"off":true}')).toEqual({ off: true });
    expect(readChoice('{"index":4}')).toEqual({ index: 4 });
    expect(readChoice('{"language":"ENG"}')).toEqual({ language: "eng" });
    for (const bad of [null, "", "x", "null", '{"index":-1}', '{"index":1.5}', '{"language":"e n"}', '{"language":5}', "[]"]) expect(readChoice(bad)).toBeNull();
  });
});

describe("resolveChoice", () => {
  it("leaves the server's choice alone with no choice", () => expect(resolveChoice(TRACKS, null)).toBeUndefined());
  it("turns subtitles off", () => expect(resolveChoice(TRACKS, { off: true })).toBeNull());
  it("uses a named track only if the film has it", () => {
    expect(resolveChoice(TRACKS, { index: 3 })).toBe(3);
    expect(resolveChoice(TRACKS, { index: 9 })).toBeUndefined();
  });
  it("picks full dialogue over forced and hearing-impaired tracks in a language", () => {
    expect(resolveChoice(TRACKS, { language: "eng" })).toBe(4);
    expect(resolveChoice(TRACKS, { language: "spa" })).toBe(5);
    expect(resolveChoice(TRACKS, { language: "fra" })).toBeUndefined();
  });
});

describe("describeChoice", () => {
  it("names the choice", () => {
    expect(describeChoice(TRACKS, null)).toBe("Default");
    expect(describeChoice(TRACKS, { off: true })).toBe("Off");
    expect(describeChoice(TRACKS, { index: 5 })).toBe("Track 5");
    expect(describeChoice(TRACKS, { language: "spa" })).toBe("Spanish");
  });
});
