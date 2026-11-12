import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { activeCues, parseJsonCues, parseTime, parseVtt, toLines, type Cue } from "./cues";
import { clampOffset, cycle, DEFAULT_STYLE, offsetLabel, readOffset, readStyle, saveOffset } from "./style";
import { describe as describeFound, explain, toFound } from "./remote";
import { isBurned, labelOf, pickerLabel, toSubTracks } from "./tracks";
import { ApiError } from "../api/client";

const text = (lines: ReturnType<typeof toLines>) => lines.map((line) => line.map((run) => run.text).join(""));

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("toLines", () => {
  it("keeps italic, bold and underline as data, and line breaks", () => {
    const lines = toLines("Hello <i>there</i><br>and <b>all</b> <u>you</u>");
    expect(text(lines)).toEqual(["Hello there", "and all you"]);
    expect(lines[0]![1]).toEqual({ text: "there", i: true });
    expect(lines[1]![1]).toEqual({ text: "all", b: true });
    expect(lines[1]![3]).toEqual({ text: "you", u: true });
  });

  it("never lets markup through: unknown tags go, their text stays", () => {
    const lines = toLines('<script>alert(1)</script>Hi <img src=x onerror="boom()"> <font color="red">there</font> <v Bob>yo</v> <c.loud>!</c>');
    expect(text(lines)).toEqual(["alert(1)Hi  there yo !"]);
    for (const line of lines) for (const run of line) expect(run.text).not.toMatch(/[<>]/);
  });

  it("treats decoded entities as text, not tags", () => {
    expect(text(toLines("a &lt;b&gt;bold&lt;/b&gt; &amp; &#233; &#x1F600; &nbsp;x"))).toEqual(["a <b>bold</b> & é 😀  x".replace("  ", "  ")]);
  });

  it("drops ASS override blocks and turns \\N into a break", () => {
    expect(text(toLines("{\\an8\\pos(10,20)}Top line\\NSecond"))).toEqual(["Top line", "Second"]);
  });

  it("drops timing tags and empty lines, trims, and caps size", () => {
    expect(text(toLines("<00:01.000>one<00:02.000> two\n\n  \n three  "))).toEqual(["one two", "three"]);
    expect(toLines("x\n".repeat(20))).toHaveLength(6);
    expect(text(toLines("y".repeat(900)))[0]).toHaveLength(300);
    expect(toLines("   ")).toEqual([]);
  });

  it("ignores impossible character codes", () => {
    expect(text(toLines("a&#0;b&#55357;c&#9999999;d"))).toEqual(["abcd"]);
  });
});

describe("parseTime", () => {
  it("reads the timestamp forms", () => {
    expect(parseTime("00:01:02.500")).toBe(62.5);
    expect(parseTime("01:02.500")).toBe(62.5);
    expect(parseTime("1:02:03,5")).toBe(3723.5);
    expect(parseTime("nonsense")).toBeNull();
    expect(parseTime("999:00:00.000")).toBeNull();
  });
});

const VTT = `WEBVTT
X-TIMESTAMP-MAP=MPEGTS:900000,LOCAL:00:00:00.000

NOTE a comment
that spans lines

1
00:00:01.000 --> 00:00:03.000 align:middle
First <i>cue</i>

00:00:02.500 --> 00:00:05.000
Overlaps
the first

STYLE
::cue { color: red }

00:00:09.000 --> 00:00:08.000
Backwards

bad --> time
Skipped
`;

describe("parseVtt", () => {
  const cues = parseVtt(VTT);

  it("reads cues with or without an ID, ignores notes, styles and bad ones", () => {
    expect(cues.map((cue) => [cue.start, cue.end])).toEqual([
      [1, 3],
      [2.5, 5],
    ]);
    expect(text(cues[0]!.lines)).toEqual(["First cue"]);
    expect(text(cues[1]!.lines)).toEqual(["Overlaps", "the first"]);
  });

  it("reads SRT too, with commas and CRLF", () => {
    const srt = "1\r\n00:00:01,000 --> 00:00:02,000\r\nHello\r\n\r\n2\r\n00:00:03,000 --> 00:00:04,000\r\nWorld\r\n";
    expect(parseVtt(srt).map((cue) => text(cue.lines)[0])).toEqual(["Hello", "World"]);
  });

  it("sorts by start and numbers the cues", () => {
    const sorted = parseVtt("WEBVTT\n\n00:00:05.000 --> 00:00:06.000\nb\n\n00:00:01.000 --> 00:00:02.000\na\n");
    expect(sorted.map((cue) => [cue.index, text(cue.lines)[0]])).toEqual([[0, "a"], [1, "b"]]);
  });

  it("copes with junk", () => {
    expect(parseVtt("")).toEqual([]);
    expect(parseVtt("not a subtitle file")).toEqual([]);
  });
});

describe("parseJsonCues", () => {
  it("reads the server's cue list and drops bad events", () => {
    const cues = parseJsonCues({
      TrackEvents: [
        { StartPositionTicks: 10_000_000, EndPositionTicks: 30_000_000, Text: "Hi<br />there" },
        { StartPositionTicks: -1, EndPositionTicks: 5, Text: "no" },
        { StartPositionTicks: "1", EndPositionTicks: 5, Text: "no" },
        { StartPositionTicks: 5, EndPositionTicks: 3, Text: "backwards" },
      ],
    });
    expect(cues).toHaveLength(1);
    expect(cues[0]).toMatchObject({ start: 1, end: 3 });
    expect(text(cues[0]!.lines)).toEqual(["Hi", "there"]);
    expect(parseJsonCues(null)).toEqual([]);
  });
});

describe("activeCues", () => {
  const cues: Cue[] = parseVtt(VTT);

  it("finds what is on screen, including overlaps, and nothing in the gaps", () => {
    expect(activeCues(cues, 0.5)).toEqual([]);
    expect(activeCues(cues, 1).map((cue) => cue.index)).toEqual([0]);
    expect(activeCues(cues, 2.9).map((cue) => cue.index)).toEqual([0, 1]);
    expect(activeCues(cues, 3).map((cue) => cue.index)).toEqual([1]);
    expect(activeCues(cues, 5)).toEqual([]);
    expect(activeCues([], 1)).toEqual([]);
  });

  it("finds a long cue that started before many short ones", () => {
    const list = parseVtt("WEBVTT\n\n00:00:00.000 --> 00:01:00.000\nlong\n\n" + Array.from({ length: 5 }, (_, n) => `00:00:0${n + 1}.000 --> 00:00:0${n + 1}.500\ns${n}`).join("\n\n"));
    expect(activeCues(list, 3.2).map((cue) => text(cue.lines)[0])).toEqual(["long", "s2"]);
  });
});

describe("tracks", () => {
  const streams = [
    { Index: 0, Type: "Video" },
    { Index: 3, Type: "Subtitle", DisplayTitle: "English - SUBRIP", Language: "eng", IsTextSubtitleStream: true, IsExternal: true, IsDefault: true, DeliveryMethod: "External" },
    { Index: 4, Type: "Subtitle", Language: "spa", IsForced: true, IsTextSubtitleStream: true },
    { Index: 5, Type: "Subtitle", DisplayTitle: "French - PGSSUB", IsTextSubtitleStream: false, DeliveryMethod: "Encode" },
    { Index: "x", Type: "Subtitle" },
  ];

  it("reads the tracks and labels them", () => {
    const tracks = toSubTracks(streams);
    expect(tracks.map((track) => track.index)).toEqual([3, 4, 5]);
    expect(tracks[0]!.label).toBe("English - SUBRIP · External · Default");
    expect(tracks[1]!.label).toBe("spa · Forced");
    expect(tracks[0]).toMatchObject({ text: true, external: true, delivery: "External" });
  });

  it("flags picture tracks as re-encoding", () => {
    const [, , picture] = toSubTracks(streams);
    expect(isBurned(picture)).toBe(true);
    expect(pickerLabel(picture!)).toBe("French - PGSSUB · re-encodes video");
    expect(isBurned(toSubTracks(streams)[0])).toBe(false);
    expect(isBurned(undefined)).toBe(false);
  });

  it("doesn't repeat what the server's title already says", () => {
    const tags = { forced: true, sdh: true, external: true, isDefault: true };
    expect(labelOf("English (Forced) (SDH) External Default", undefined, tags, "x")).toBe("English (Forced) (SDH) External Default");
    expect(labelOf(undefined, undefined, { ...tags, forced: false }, "Track 2")).toBe("Track 2 · SDH · External · Default");
  });

  it("copes with no streams", () => {
    expect(toSubTracks(undefined)).toEqual([]);
  });
});

describe("appearance", () => {
  it("falls back to the default for anything unexpected", () => {
    expect(readStyle(null)).toEqual(DEFAULT_STYLE);
    expect(readStyle("{")).toEqual(DEFAULT_STYLE);
    expect(readStyle(JSON.stringify({ size: "huge", color: "white", edge: 5 }))).toEqual({ ...DEFAULT_STYLE, color: "white" });
  });

  it("cycles one choice and wraps", () => {
    expect(cycle(DEFAULT_STYLE, "size").size).toBe("xl");
    expect(cycle({ ...DEFAULT_STYLE, size: "xl" }, "size").size).toBe("s");
    expect(cycle(DEFAULT_STYLE, "color")).toEqual({ ...DEFAULT_STYLE, color: "white" });
  });

  it("keeps the sync offset to a tenth, within five minutes, per film", () => {
    expect(clampOffset(0.14)).toBe(0.1);
    expect(clampOffset(9999)).toBe(300);
    expect(clampOffset(Number.NaN)).toBe(0);
    saveOffset("a", 1.25);
    expect(readOffset("a")).toBe(1.3);
    expect(readOffset("b")).toBe(0);
    saveOffset("a", 0);
    expect(readOffset("a")).toBe(0);
    expect(offsetLabel(1.5)).toBe("+1.5 s");
    expect(offsetLabel(-0.1)).toBe("-0.1 s");
  });
});

describe("remote subtitle search", () => {
  it("checks results and puts exact matches and well-rated ones first", () => {
    const found = toFound([
      { Id: "a1", Name: "Rated", CommunityRating: 8, DownloadCount: 5, Format: "SRT" },
      { Id: "b2", Name: "Exact", IsHashMatch: true, Format: "srt" },
      { Id: "c3", Name: "Machine", AiTranslated: true, CommunityRating: 9.5 },
      { Id: "bad id/..", Name: "Hostile" },
      { Name: "No id" },
    ]);
    expect(found.map((entry) => entry.name)).toEqual(["Exact", "Rated", "Machine"]);
    expect(describeFound(found[0]!)).toBe("Exact match · srt");
    expect(describeFound(found[1]!)).toBe("8.0 · 5 downloads · srt");
    expect(toFound(null)).toEqual([]);
  });

  it("turns failures into advice", () => {
    expect(explain(new ApiError(403, "x"))).toContain("isn't allowed");
    expect(explain(new ApiError(0, "x"))).toContain("didn't answer");
    expect(explain(new ApiError(500, "x"))).toContain("plugin");
    expect(explain(new Error("?"))).toContain("plugin");
  });
});
