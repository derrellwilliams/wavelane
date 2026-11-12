/// Asking the server how to play something, and telling it how playback is going. The server
/// decides (direct play, copy the video and convert the audio, or full transcode) from the TV's
/// profile; this checks its answer and builds the address for the `<video>`.
///
/// The video element can't send headers, so its address carries the token (`api_key`). That
/// address is never logged or put in an error: failures here carry only a message.
import type { PlaybackInfoResponse } from "@jellyfin/sdk/lib/generated-client/models";
import { connectionOf, type Session } from "../api/auth";
import { request } from "../api/client";
import { deviceId } from "../api/storage";
import { deviceProfile } from "./profile";
import { pickTrickplay, type TrickInfo } from "./trickplay";
import { parseJsonCues, parseVtt, type Cue } from "../subtitles/cues";
import { toSubTracks, type SubTrack } from "../subtitles/tracks";
import { toSegments, type Segment } from "./segments";

const TICKS = 10_000_000;
export const toTicks = (seconds: number) => Math.max(0, Math.round(seconds * TICKS));

export class PlaybackError extends Error {}

export interface AudioTrack {
  /// The server's stream number, used to ask for this track.
  index: number;
  label: string;
}

export interface Source {
  id: string;
  etag?: string;
  directPlay: boolean;
  transcodeUrl?: string;
  seconds?: number;
  audio: AudioTrack[];
  defaultAudio?: number;
  subs: SubTrack[];
  /// The track the server chose from the user's subtitle settings (none when absent).
  defaultSub?: number;
  /// For the stats overlay.
  container?: string;
  video?: string;
  audioCodec?: string;
  bitrate?: number;
}

export interface Plan {
  url: string;
  /// "DirectPlay", or "Transcode" (which includes copying the video and converting the audio).
  method: "DirectPlay" | "Transcode";
  source: Source;
  playSessionId: string;
  audioIndex?: number;
}

const safeId = (value: unknown): string | undefined =>
  typeof value === "string" && /^[\w-]{1,128}$/.test(value) ? value : undefined;
const short = (value: unknown, max = 80): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
const count = (value: unknown, min: number, max: number): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : undefined;

/// What the app keeps of the server's description of one version of a film.
export function toSource(raw: unknown): Source | null {
  const value = raw as Record<string, unknown> | null;
  const id = safeId(value?.Id);
  if (!value || !id) return null;
  const streams = Array.isArray(value.MediaStreams) ? (value.MediaStreams.slice(0, 200) as Record<string, unknown>[]) : [];
  const audio: AudioTrack[] = [];
  let video: string | undefined;
  let audioCodec: string | undefined;
  for (const stream of streams) {
    const index = count(stream?.Index, 0, 1000);
    if (index === undefined) continue;
    if (stream.Type === "Audio") {
      audio.push({ index, label: short(stream.DisplayTitle) ?? short(stream.Language) ?? `Track ${audio.length + 1}` });
      if (stream.Index === value.DefaultAudioStreamIndex) audioCodec = short(stream.Codec, 20);
    } else if (stream.Type === "Video" && !video) {
      video = [short(stream.Codec, 20), count(stream.Height, 1, 10000) ? `${stream.Height}p` : undefined, short(stream.VideoRangeType, 20)]
        .filter(Boolean)
        .join(" ");
    }
  }
  const transcodeUrl = typeof value.TranscodingUrl === "string" ? value.TranscodingUrl : undefined;
  return {
    id,
    etag: safeId(value.ETag),
    directPlay: value.SupportsDirectPlay === true,
    transcodeUrl: transcodeUrl && transcodeUrl.length < 4000 ? transcodeUrl : undefined,
    seconds: count(value.RunTimeTicks, 1, 1e15) ? (value.RunTimeTicks as number) / TICKS : undefined,
    audio,
    defaultAudio: count(value.DefaultAudioStreamIndex, 0, 1000),
    subs: toSubTracks(streams),
    defaultSub: count(value.DefaultSubtitleStreamIndex, 0, 1000),
    container: short(value.Container, 40),
    video,
    audioCodec,
    bitrate: count(value.Bitrate, 1, 1e10),
  };
}

/// Adds the token to an address for the video element, unless the server already put one there.
/// Only addresses on the server itself are accepted.
export function withToken(server: string, path: string, token: string): string | null {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return null;
  const url = server + path;
  if (/[?&](api_key|apikey)=/i.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}api_key=${encodeURIComponent(token)}`;
}

/// The address of the untouched file.
export function directUrl(session: Session, itemId: string, source: Source, playSessionId: string): string {
  const query = new URLSearchParams({ static: "true", mediaSourceId: source.id, deviceId: deviceId(), playSessionId });
  if (source.etag) query.set("tag", source.etag);
  return withToken(session.server, `/Videos/${itemId}/stream?${query}`, session.token)!;
}

/// Picks how to play from the server's answer. Throws PlaybackError with a message for the user.
export function choosePlan(session: Session, itemId: string, reply: PlaybackInfoResponse | null, preferred?: number): Plan {
  const sources = (Array.isArray(reply?.MediaSources) ? reply.MediaSources : []).map(toSource).filter((s): s is Source => !!s);
  const playSessionId = safeId(reply?.PlaySessionId) ?? "";
  const source = sources[0];
  if (!source) {
    throw new PlaybackError(
      reply?.ErrorCode === "NoCompatibleStream" ? "The server can't make this play on the TV." : "The server has no playable version of this.",
    );
  }
  if (source.directPlay) {
    return { url: directUrl(session, itemId, source, playSessionId), method: "DirectPlay", source, playSessionId, audioIndex: preferred ?? source.defaultAudio };
  }
  const url = source.transcodeUrl && withToken(session.server, source.transcodeUrl, session.token);
  if (!url) throw new PlaybackError("The server can't make this play on the TV.");
  return { url, method: "Transcode", source, playSessionId, audioIndex: preferred ?? source.defaultAudio };
}

export interface PlanOptions {
  startSeconds: number;
  audioIndex?: number;
  /// A subtitle track to have burned in, or -1 for none; leave out to let the server choose.
  subtitleIndex?: number;
  /// Skip direct play (it failed on the TV).
  transcode?: boolean;
  maxBitrate?: number;
}

export async function plan(session: Session, itemId: string, options: PlanOptions): Promise<Plan> {
  const connection = connectionOf(session);
  const profile = deviceProfile(options.maxBitrate);
  const reply = await request<PlaybackInfoResponse>(connection, `/Items/${itemId}/PlaybackInfo`, {
    method: "POST",
    query: { userId: session.userId },
    timeoutMs: 20000,
    body: {
      UserId: session.userId,
      StartTimeTicks: toTicks(options.startSeconds),
      MaxStreamingBitrate: profile.MaxStreamingBitrate,
      AudioStreamIndex: options.audioIndex,
      SubtitleStreamIndex: options.subtitleIndex,
      AlwaysBurnInSubtitleWhenTranscoding: false,
      DeviceProfile: profile,
      EnableDirectPlay: !options.transcode,
      EnableDirectStream: true,
      EnableTranscoding: true,
      AutoOpenLiveStream: false,
    },
  });
  return choosePlan(session, itemId, reply, options.audioIndex);
}

/// A subtitle file for the app to draw: WebVTT from the server, else its JSON cue list. The
/// address is built here rather than taken from the server's reply.
export async function subtitleCues(session: Session, itemId: string, sourceId: string, index: number): Promise<Cue[]> {
  const base = `/Videos/${itemId}/${encodeURIComponent(sourceId)}/Subtitles/${index}/0/Stream`;
  const connection = connectionOf(session);
  try {
    return parseVtt(await request<string>(connection, `${base}.vtt`, { as: "text", timeoutMs: 30000 }));
  } catch {
    return parseJsonCues(await request<unknown>(connection, `${base}.js`, { timeoutMs: 30000 }));
  }
}

/// Intro / credits spans. A server without them (or without the feature) just gives none.
export async function segments(session: Session, itemId: string): Promise<Segment[]> {
  try {
    return toSegments(await request<unknown>(connectionOf(session), `/MediaSegments/${itemId}`, { query: { includeSegmentTypes: "Intro,Recap,Preview,Outro" } }));
  } catch {
    return [];
  }
}

/// Scrub thumbnails for one version of the film, or null when the server hasn't made them.
export async function trickplay(session: Session, itemId: string, sourceId: string): Promise<TrickInfo | null> {
  try {
    const item = await request<{ Trickplay?: Record<string, unknown> | null } | null>(connectionOf(session), `/Items/${itemId}`, {
      query: { userId: session.userId },
    });
    const sizes = item?.Trickplay && Object.prototype.hasOwnProperty.call(item.Trickplay, sourceId) ? item.Trickplay[sourceId] : undefined;
    return pickTrickplay(sizes, 320);
  } catch {
    return null;
  }
}

/// The address of one sheet of scrub thumbnails.
export function trickplayUrl(session: Session, itemId: string, info: TrickInfo, sourceId: string, sheet: number): string {
  return withToken(session.server, `/Videos/${itemId}/Trickplay/${info.width}/${sheet}.jpg?mediaSourceId=${encodeURIComponent(sourceId)}`, session.token)!;
}

export interface Report {
  itemId: string;
  sourceId: string;
  playSessionId: string;
  method: Plan["method"];
  seconds: number;
  paused: boolean;
  audioIndex?: number;
  /// The subtitle track in use, so the server can remember the choice.
  subtitleIndex?: number | null;
}

function body(report: Report) {
  return {
    ItemId: report.itemId,
    MediaSourceId: report.sourceId,
    PlaySessionId: report.playSessionId,
    PositionTicks: toTicks(report.seconds),
    IsPaused: report.paused,
    PlayMethod: report.method,
    AudioStreamIndex: report.audioIndex,
    SubtitleStreamIndex: report.subtitleIndex ?? -1,
    CanSeek: true,
  };
}

/// Reports go out best effort: a failure never interrupts the film.
async function send(session: Session, path: string, payload: unknown, timeoutMs = 4000): Promise<void> {
  try {
    await request<unknown>(connectionOf(session), path, { method: "POST", body: payload, timeoutMs });
  } catch {
    // The server will catch up at the next report.
  }
}

export const reportStart = (session: Session, report: Report) => send(session, "/Sessions/Playing", body(report));
export const reportProgress = (session: Session, report: Report) => send(session, "/Sessions/Playing/Progress", body(report));
export const reportStop = (session: Session, report: Report) => {
  const { IsPaused: _paused, CanSeek: _seek, ...stop } = body(report);
  return send(session, "/Sessions/Playing/Stopped", stop);
};
