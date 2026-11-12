/// The subtitle tracks a film has, as the picker shows them, and which ones the app can draw.

export type Delivery = "External" | "Embed" | "Encode" | "Hls" | "Drop";

export interface SubTrack {
  /// The server's stream number.
  index: number;
  label: string;
  language?: string;
  forced: boolean;
  sdh: boolean;
  external: boolean;
  /// A text format (SRT, ASS, ...) the app can draw; otherwise it is a picture the server must
  /// burn into the video.
  text: boolean;
  isDefault: boolean;
  delivery?: Delivery;
}

const DELIVERY: readonly string[] = ["External", "Embed", "Encode", "Hls", "Drop"];

function short(value: unknown, max: number): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : undefined;
}

/// The picker line: the server's title (or the language), plus Forced / SDH / External / Default
/// when the title doesn't say so already.
export function labelOf(title: string | undefined, language: string | undefined, tags: { forced: boolean; sdh: boolean; external: boolean; isDefault: boolean }, fallback: string): string {
  const base = title ?? language ?? fallback;
  const has = (word: string) => base.toLowerCase().includes(word.toLowerCase());
  const extra: string[] = [];
  if (tags.forced && !has("forced")) extra.push("Forced");
  if (tags.sdh && !has("sdh") && !has("hearing")) extra.push("SDH");
  if (tags.external && !has("external")) extra.push("External");
  if (tags.isDefault && !has("default")) extra.push("Default");
  return extra.length ? `${base} · ${extra.join(" · ")}` : base;
}

/// Subtitle tracks from a media source's streams, checked.
export function toSubTracks(streams: unknown): SubTrack[] {
  if (!Array.isArray(streams)) return [];
  const tracks: SubTrack[] = [];
  for (const raw of streams.slice(0, 300) as (Record<string, unknown> | null)[]) {
    const index = raw?.Index;
    if (!raw || raw.Type !== "Subtitle" || typeof index !== "number" || !Number.isInteger(index) || index < 0 || index > 1000) continue;
    if (tracks.length >= 100) break;
    const tags = { forced: raw.IsForced === true, sdh: raw.IsHearingImpaired === true, external: raw.IsExternal === true, isDefault: raw.IsDefault === true };
    const language = short(raw.Language, 12);
    tracks.push({
      index,
      label: labelOf(short(raw.DisplayTitle, 80), language, tags, `Track ${tracks.length + 1}`),
      language,
      ...tags,
      text: raw.IsTextSubtitleStream === true,
      delivery: DELIVERY.includes(raw.DeliveryMethod as string) ? (raw.DeliveryMethod as Delivery) : undefined,
    });
  }
  return tracks;
}

/// Burned in by the server (and so not drawn by the app): a picture format.
export const isBurned = (track: SubTrack | undefined): boolean => !!track && !track.text;

/// "Re-encodes video" is the price of picture subtitles; say so in the picker.
export function pickerLabel(track: SubTrack): string {
  return track.text ? track.label : `${track.label} · re-encodes video`;
}
