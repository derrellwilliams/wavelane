/// The rules for saving films to the tablet, kept free of the device so they can be tested:
/// what a saved item looks like, which transfer runs next, whether a film fits, the file name, and
/// the queue of watching progress made offline that waits to be sent to the server.
import type { Item } from "../api/items";
import type { SubTrack } from "../subtitles/tracks";

export type DownloadState = "queued" | "running" | "paused" | "done" | "failed";

/// How the file was made: the server's original, or a conversion the tablet can play.
export type DownloadKind = "original" | "converted";

export interface SavedSub {
  index: number;
  track: SubTrack;
}

export interface Saved {
  /// The Jellyfin item id (a film or an episode).
  id: string;
  item: Item;
  kind: DownloadKind;
  state: DownloadState;
  /// Android's id for the transfer, once it has been handed over.
  transfer?: number;
  /// File name inside the app's movie folder (also what the plugin was told).
  file: string;
  /// Full path, known when the transfer is done.
  path?: string;
  bytes: number;
  /// 0 when the server doesn't know the size (a conversion).
  total: number;
  /// Planned size, for the "will it fit" check.
  estimate: number;
  /// The media source on the server, needed to ask for its subtitles and to report progress.
  sourceId?: string;
  /// Subtitle tracks kept with the file (cues are stored beside it).
  subs: SubTrack[];
  /// Where watching stopped on the tablet, in seconds.
  position?: number;
  addedAt: number;
  /// Why it failed, in words.
  note?: string;
}

/// The one transfer allowed at a time: the first queued item, unless something is already moving.
export function nextToStart(list: readonly Saved[]): Saved | undefined {
  if (list.some((entry) => entry.state === "running")) return undefined;
  return list.find((entry) => entry.state === "queued");
}

/// Keep a margin so the tablet never fills to the last byte (it needs room to run).
export const SPARE_BYTES = 1_000_000_000;

/// Whether `need` bytes fit in `free`, once the other unfinished transfers have taken their share.
export function fits(need: number, free: number, list: readonly Saved[]): boolean {
  const owed = list.reduce((sum, entry) => (entry.state === "done" || entry.state === "failed" ? sum : sum + Math.max(0, entry.estimate - entry.bytes)), 0);
  return need + owed + SPARE_BYTES <= free;
}

/// A file name the plugin accepts (letters, digits, dot, dash, underscore; at most 100), made from
/// the item id so nothing from the server's text reaches the file system.
export function fileName(id: string, kind: DownloadKind, container?: string): string {
  const ext = /^[a-z0-9]{1,5}$/i.test(container ?? "") ? container!.toLowerCase() : "mp4";
  return `${id.replace(/[^0-9a-f-]/gi, "")}.${kind === "converted" ? "mp4" : ext}`.slice(0, 100);
}

/// The size to expect: the file's own size for an original, runtime times bitrate for a conversion.
export function estimateBytes(kind: DownloadKind, fileBytes: number | undefined, seconds: number | undefined, bitrate: number): number {
  if (kind === "original" && fileBytes && fileBytes > 0) return fileBytes;
  return Math.round(((seconds ?? 7200) * bitrate) / 8);
}

/// Conversion settings: 720p at 4 Mbps video and stereo AAC (about 1.8 GB for a two-hour film).
export const CONVERT = { videoBitrate: 4_000_000, audioBitrate: 160_000, width: 1280 } as const;

/// Progress made while offline, kept until the server can take it.
export interface Pending {
  id: string;
  seconds: number;
  /// Watched to the end (or near it), so the server marks it played.
  finished: boolean;
  at: number;
}

/// Watched past this share of the film counts as finished.
export const FINISHED_AT = 0.92;

export function isFinished(seconds: number, duration: number): boolean {
  return duration > 0 && seconds / duration >= FINISHED_AT;
}

/// Adds progress to the queue: one entry per film, the newest wins.
export function queueProgress(list: readonly Pending[], entry: Pending): Pending[] {
  return [...list.filter((other) => other.id !== entry.id), entry].slice(-200);
}

/// Where to start a saved film: the later of the tablet's position and the server's, unless the
/// film was finished, which starts over.
export function startPosition(saved: Pick<Saved, "position">, serverSeconds: number | undefined): number {
  return Math.max(saved.position ?? 0, serverSeconds ?? 0);
}

/// Episodes worth saving from a list: not watched yet and not already saved or queued.
export function toSave(episodes: readonly Item[], have: ReadonlySet<string>, onlyUnwatched: boolean): Item[] {
  return episodes.filter((episode) => !have.has(episode.id) && (!onlyUnwatched || !episode.played));
}

export function sizeText(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  return `${Math.max(1, Math.round(bytes / 1e6))} MB`;
}

/// One tile on the Downloads tab: a film, or every saved episode of one show.
export interface SavedGroup {
  key: string;
  /// The show's id when the tile is a show.
  seriesId?: string;
  /// A film is one entry; a show's episodes run in season and episode order.
  entries: Saved[];
}

/// Films stand alone; episodes gather under their show. Newest additions come first.
export function groupSaved(list: readonly Saved[]): SavedGroup[] {
  const groups = new Map<string, SavedGroup>();
  for (const entry of list) {
    const seriesId = entry.item.type === "Episode" ? entry.item.seriesId : undefined;
    const key = seriesId ? `show:${seriesId}` : `item:${entry.id}`;
    const group = groups.get(key) ?? { key, seriesId, entries: [] };
    group.entries.push(entry);
    groups.set(key, group);
  }
  const order = (entry: Saved) => (entry.item.season ?? 0) * 100000 + (entry.item.episode ?? 0);
  const newest = (group: SavedGroup) => Math.max(...group.entries.map((entry) => entry.addedAt));
  const out = [...groups.values()];
  for (const group of out) if (group.seriesId) group.entries.sort((a, b) => order(a) - order(b));
  return out.sort((a, b) => newest(b) - newest(a));
}
