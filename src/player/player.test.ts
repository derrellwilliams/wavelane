import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "../api/auth";
import { choosePlan, directUrl, plan, PlaybackError, reportStop, toSource, toTicks, trickplay, withToken } from "./playback";
import { deviceProfile } from "./profile";
import { clock, scrubStep, scrubTarget } from "./scrub";
import { activeSegment, skipLabel, toSegments } from "./segments";
import { pickTrickplay, thumbAt, type TrickInfo } from "./trickplay";

const ITEM = "0123456789abcdef0123456789abcdef";
const SESSION: Session = { server: "http://nas:8096", serverName: "Home", serverVersion: "12.4.0", userId: "9f8e7d6c00000000000000000000aaaa", userName: "Me", token: "tok123" };

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("deviceProfile", () => {
  const profile = deviceProfile();

  it("direct plays the usual containers and codecs, and offers HLS as the fallback", () => {
    const direct = profile.DirectPlayProfiles![0]!;
    expect(direct.Container).toContain("mkv");
    expect(direct.VideoCodec).toContain("hevc");
    expect(direct.AudioCodec).toContain("eac3");
    expect(direct.AudioCodec).not.toContain("dts");
    expect(profile.TranscodingProfiles![0]).toMatchObject({ Protocol: "hls", Container: "ts" });
  });

  it("has the server draw text subtitles itself and burn in picture ones", () => {
    const method = (format: string) => profile.SubtitleProfiles!.find((entry) => entry.Format === format)?.Method;
    expect(method("srt")).toBe("External");
    expect(method("ass")).toBe("External");
    expect(method("pgssub")).toBe("Encode");
    expect(method("dvdsub")).toBe("Encode");
  });

  it("carries the bitrate limit", () => {
    expect(deviceProfile(20_000_000).MaxStreamingBitrate).toBe(20_000_000);
  });
});

describe("addresses with the token", () => {
  it("adds the token once, only to paths on the server", () => {
    expect(withToken("http://nas:8096", "/Videos/x/stream?static=true", "t k")).toBe("http://nas:8096/Videos/x/stream?static=true&api_key=t%20k");
    expect(withToken("http://nas:8096", "/Videos/x/master.m3u8?ApiKey=abc", "tok")).toBe("http://nas:8096/Videos/x/master.m3u8?ApiKey=abc");
    expect(withToken("http://nas:8096", "/a", "tok")).toBe("http://nas:8096/a?api_key=tok");
    expect(withToken("http://nas:8096", "//evil.test/x", "tok")).toBeNull();
    expect(withToken("http://nas:8096", "http://evil.test/x", "tok")).toBeNull();
    expect(withToken("http://nas:8096", "/x\\y", "tok")).toBeNull();
  });

  it("points direct play at the file", () => {
    const source = toSource({ Id: "src1", ETag: "e1" })!;
    const url = new URL(directUrl(SESSION, ITEM, source, "ps1"));
    expect(url.pathname).toBe(`/Videos/${ITEM}/stream`);
    expect(url.searchParams.get("static")).toBe("true");
    expect(url.searchParams.get("mediaSourceId")).toBe("src1");
    expect(url.searchParams.get("tag")).toBe("e1");
    expect(url.searchParams.get("api_key")).toBe("tok123");
  });
});

describe("toSource", () => {
  it("keeps the audio tracks and a summary for the stats overlay", () => {
    const source = toSource({
      Id: "s1",
      SupportsDirectPlay: true,
      RunTimeTicks: 36_000_000_000,
      Container: "mkv",
      Bitrate: 25_000_000,
      DefaultAudioStreamIndex: 2,
      MediaStreams: [
        { Index: 0, Type: "Video", Codec: "hevc", Height: 2160, VideoRangeType: "DOVI" },
        { Index: 1, Type: "Audio", DisplayTitle: "English - Dolby Digital - 5.1" },
        { Index: 2, Type: "Audio", Language: "fre", Codec: "eac3" },
        { Index: 3, Type: "Subtitle" },
      ],
    });
    expect(source).toMatchObject({
      id: "s1",
      directPlay: true,
      seconds: 3600,
      container: "mkv",
      video: "hevc 2160p DOVI",
      audioCodec: "eac3",
      defaultAudio: 2,
      audio: [
        { index: 1, label: "English - Dolby Digital - 5.1" },
        { index: 2, label: "fre" },
      ],
    });
  });

  it("refuses a source whose ID could change a URL", () => {
    expect(toSource({ Id: "a/b" })).toBeNull();
    expect(toSource(null)).toBeNull();
  });
});

describe("choosePlan", () => {
  it("direct plays when the server says it can", () => {
    const made = choosePlan(SESSION, ITEM, { PlaySessionId: "ps", MediaSources: [{ Id: "s1", SupportsDirectPlay: true }] });
    expect(made).toMatchObject({ method: "DirectPlay", playSessionId: "ps" });
    expect(made.url).toContain("/stream?");
  });

  it("uses the server's HLS address otherwise, adding the token", () => {
    const made = choosePlan(SESSION, ITEM, { PlaySessionId: "ps", MediaSources: [{ Id: "s1", SupportsDirectPlay: false, TranscodingUrl: "/videos/x/master.m3u8?a=1" }] });
    expect(made).toMatchObject({ method: "Transcode", url: "http://nas:8096/videos/x/master.m3u8?a=1&api_key=tok123" });
  });

  it("explains when there is nothing to play, without the address", () => {
    expect(() => choosePlan(SESSION, ITEM, { MediaSources: [] })).toThrow(PlaybackError);
    expect(() => choosePlan(SESSION, ITEM, { MediaSources: [{ Id: "s1" }], ErrorCode: "NoCompatibleStream" })).toThrow("can't make this play");
    const hostile = { MediaSources: [{ Id: "s1", TranscodingUrl: "http://evil.test/x.m3u8" }] };
    expect(() => choosePlan(SESSION, ITEM, hostile)).toThrow(PlaybackError);
  });
});

describe("plan and reports", () => {
  it("asks with the TV's profile and the start position, and the token stays in the header", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ PlaySessionId: "ps", MediaSources: [{ Id: "s1", SupportsDirectPlay: true }] }), { status: 200 });
    });
    const made = await plan(SESSION, ITEM, { startSeconds: 90, audioIndex: 2, transcode: true });
    expect(made.method).toBe("DirectPlay");
    const body = JSON.parse(calls[0]!.init.body as string);
    expect(calls[0]!.url).toBe(`http://nas:8096/Items/${ITEM}/PlaybackInfo?userId=${SESSION.userId}`);
    expect(body).toMatchObject({ StartTimeTicks: 900_000_000, AudioStreamIndex: 2, EnableDirectPlay: false, EnableTranscoding: true });
    expect(body.DeviceProfile.Name).toBe("Wavelane LG webOS");
    expect(calls[0]!.url).not.toContain("tok123");
  });

  it("sends the stop position in ticks and never throws", async () => {
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(init.body as string) });
      return new Response(null, { status: 500 });
    });
    await expect(reportStop(SESSION, { itemId: ITEM, sourceId: "s1", playSessionId: "ps", method: "DirectPlay", seconds: 61.5, paused: true })).resolves.toBeUndefined();
    expect(calls[0]!.url).toBe("http://nas:8096/Sessions/Playing/Stopped");
    expect(calls[0]!.body).toMatchObject({ ItemId: ITEM, PositionTicks: 615_000_000, PlayMethod: "DirectPlay" });
    expect(calls[0]!.body).not.toHaveProperty("IsPaused");
  });

  it("finds the thumbnails of the right version, or none", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ Trickplay: { s1: { "320": { Width: 320, Height: 180, TileWidth: 10, TileHeight: 10, ThumbnailCount: 250, Interval: 10000 } } } }), { status: 200 }));
    expect(await trickplay(SESSION, ITEM, "s1")).toMatchObject({ width: 320, count: 250 });
    expect(await trickplay(SESSION, ITEM, "other")).toBeNull();
    expect(await trickplay(SESSION, ITEM, "__proto__")).toBeNull();
  });

  it("converts seconds to ticks", () => {
    expect(toTicks(1.5)).toBe(15_000_000);
    expect(toTicks(-4)).toBe(0);
  });
});

describe("segments", () => {
  const list = toSegments({
    Items: [
      { Type: "Outro", StartTicks: 33_000_000_000, EndTicks: 36_000_000_000 },
      { Type: "Intro", StartTicks: 600_000_000, EndTicks: 1_500_000_000 },
      { Type: "Commercial", StartTicks: 1, EndTicks: 2 },
      { Type: "Intro", StartTicks: 5, EndTicks: 3 },
      { Type: "Recap", StartTicks: "0", EndTicks: 9 },
    ],
  });

  it("keeps the kinds the player skips, in order, and drops bad ones", () => {
    expect(list).toEqual([
      { kind: "Intro", start: 60, end: 150 },
      { kind: "Outro", start: 3300, end: 3600 },
    ]);
    expect(toSegments(null)).toEqual([]);
  });

  it("is active inside a span, not after it", () => {
    expect(activeSegment(list, 59)).toBeUndefined();
    expect(activeSegment(list, 60)?.kind).toBe("Intro");
    expect(activeSegment(list, 149.5)).toBeUndefined();
    expect(activeSegment(list, 3400)?.kind).toBe("Outro");
    expect(skipLabel("Outro")).toBe("Skip Credits");
  });
});

describe("trickplay", () => {
  const info: TrickInfo = { width: 320, height: 180, tileWidth: 10, tileHeight: 5, count: 120, interval: 10000 };

  it("finds the sheet and spot for a moment", () => {
    expect(thumbAt(info, 0)).toEqual({ sheet: 0, x: 0, y: 0 });
    expect(thumbAt(info, 35)).toEqual({ sheet: 0, x: 960, y: 0 });
    expect(thumbAt(info, 125)).toEqual({ sheet: 0, x: 640, y: 180 });
    expect(thumbAt(info, 500)).toEqual({ sheet: 1, x: 0, y: 0 });
    expect(thumbAt(info, 99999)).toEqual({ sheet: 2, x: 2880, y: 180 }); // the last picture (119)
    expect(thumbAt(info, -5)).toEqual({ sheet: 0, x: 0, y: 0 });
  });

  it("picks the size nearest the one wanted and ignores broken entries", () => {
    const sizes = {
      "160": { Width: 160, Height: 90, TileWidth: 10, TileHeight: 10, ThumbnailCount: 10, Interval: 10000 },
      "320": { Width: 320, Height: 180, TileWidth: 10, TileHeight: 10, ThumbnailCount: 10, Interval: 10000 },
      "bad": { Width: 320, Height: 180, TileWidth: 0, TileHeight: 10, ThumbnailCount: 10, Interval: 10000 },
    };
    expect(pickTrickplay(sizes, 300)?.width).toBe(320);
    expect(pickTrickplay(sizes, 100)?.width).toBe(160);
    expect(pickTrickplay({ bad: sizes.bad }, 300)).toBeNull();
    expect(pickTrickplay(undefined, 300)).toBeNull();
  });
});

describe("scrub", () => {
  it("speeds up the longer the key is held", () => {
    expect([0, 3, 4, 11, 12, 29, 30].map(scrubStep)).toEqual([10, 10, 30, 30, 60, 60, 180]);
  });

  it("moves from where it is and stays inside the film", () => {
    expect(scrubTarget(100, 1, 0, 3600)).toBe(110);
    expect(scrubTarget(100, -1, 4, 3600)).toBe(70);
    expect(scrubTarget(5, -1, 0, 3600)).toBe(0);
    expect(scrubTarget(3595, 1, 40, 3600)).toBe(3599);
  });

  it("writes times", () => {
    expect(clock(309)).toBe("5:09");
    expect(clock(3909)).toBe("1:05:09");
    expect(clock(Number.NaN)).toBe("0:00");
  });
});
