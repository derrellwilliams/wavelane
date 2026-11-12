/// Subtitle cues: parsing what the server sends and cleaning it. Cue text is untrusted (it comes
/// from files anyone can upload), so the only markup that survives is italic, bold, underline
/// and line breaks, kept as data (`Run`s) that the screen draws as plain text nodes. Nothing here
/// produces HTML.

export interface Run {
  text: string;
  i?: true;
  b?: true;
  u?: true;
}

export interface Cue {
  /// Position in the track, to tell cues apart.
  index: number;
  start: number; // seconds
  end: number;
  lines: Run[][];
}

const MAX_CUES = 20_000;
const MAX_LINES = 6;
const MAX_LINE = 300;
const MAX_TEXT = 1000;
const MAX_SECONDS = 360_000; // 100 hours
const MAX_FILE = 5_000_000;

const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", lrm: "", rlm: "" };

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z]{2,6});/gi, (whole, name: string) => {
    if (name[0] === "#") {
      const code = name[1]!.toLowerCase() === "x" ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
      return code >= 32 && code < 0x110000 && !(code >= 0xd800 && code < 0xe000) ? String.fromCodePoint(code) : "";
    }
    return NAMED[name.toLowerCase()] ?? whole;
  });
}

/// Cue text to lines of runs. Handles WebVTT tags, the HTML-ish tags SRT files carry, and ASS
/// override blocks and `\N` breaks. Everything else (`<c>`, `<v>`, `<font>`, timestamps, unknown
/// tags) is dropped and its text kept.
export function toLines(raw: string): Run[][] {
  const source = raw
    .slice(0, MAX_TEXT * 3)
    .replace(/\{[^}]*\}/g, "")
    .replace(/\\[Nn]/g, "\n")
    .replace(/\r\n?/g, "\n");

  const lines: Run[][] = [[]];
  const style = { i: false, b: false, u: false };
  let at = 0;
  let total = 0;

  const add = (text: string) => {
    if (!text) return;
    const line = lines[lines.length - 1]!;
    const run: Run = { text: decode(text) };
    if (style.i) run.i = true;
    if (style.b) run.b = true;
    if (style.u) run.u = true;
    if (run.text) line.push(run);
  };
  const addWithBreaks = (text: string) => {
    const parts = text.split("\n");
    parts.forEach((part, n) => {
      if (n > 0) lines.push([]);
      add(part);
    });
  };

  for (const tag of source.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9]*)(?:[.\s][^<>]*)?\/?>|<\d{1,2}:\d{2}(?::\d{2})?[.,]\d{1,3}>/g)) {
    addWithBreaks(source.slice(at, tag.index));
    at = tag.index + tag[0].length;
    const name = tag[1]?.toLowerCase();
    if (name === "br") lines.push([]);
    else if (name === "i" || name === "b" || name === "u") style[name] = !tag[0].startsWith("</");
  }
  addWithBreaks(source.slice(at));

  const kept: Run[][] = [];
  for (const line of lines) {
    // Trim the ends of the line and drop it if nothing is left.
    while (line.length && !line[0]!.text.trim()) line.shift();
    while (line.length && !line[line.length - 1]!.text.trim()) line.pop();
    if (!line.length) continue;
    line[0]!.text = line[0]!.text.trimStart();
    line[line.length - 1]!.text = line[line.length - 1]!.text.trimEnd();
    let room = MAX_LINE;
    const cut: Run[] = [];
    for (const run of line) {
      if (room <= 0) break;
      cut.push(run.text.length > room ? { ...run, text: run.text.slice(0, room) } : run);
      room -= run.text.length;
    }
    total += MAX_LINE - room;
    if (total > MAX_TEXT || kept.length >= MAX_LINES) break;
    kept.push(cut);
  }
  return kept;
}

/// "00:01:02.500", "01:02.500", "1:02,5" to seconds, or null.
export function parseTime(text: string): number | null {
  const found = /^(?:(\d{1,3}):)?(\d{1,2}):(\d{2})[.,](\d{1,3})$/.exec(text.trim());
  if (!found) return null;
  const [, h, m, s, fraction] = found;
  const seconds = Number(h ?? 0) * 3600 + Number(m) * 60 + Number(s) + Number(`0.${fraction}`);
  return seconds <= MAX_SECONDS ? seconds : null;
}

function build(entries: { start: number; end: number; text: string }[]): Cue[] {
  const cues: Cue[] = [];
  for (const entry of entries) {
    if (cues.length >= MAX_CUES) break;
    if (!(entry.end > entry.start)) continue;
    const lines = toLines(entry.text);
    if (lines.length) cues.push({ index: 0, start: entry.start, end: entry.end, lines });
  }
  cues.sort((a, b) => a.start - b.start);
  cues.forEach((cue, n) => (cue.index = n));
  return cues;
}

/// WebVTT (and, since the timing line is the same, SRT) to cues sorted by start.
export function parseVtt(file: string): Cue[] {
  if (file.length > MAX_FILE) return [];
  const entries: { start: number; end: number; text: string }[] = [];
  for (const block of file.replace(/^﻿/, "").replace(/\r\n?/g, "\n").split(/\n{2,}/)) {
    const rows = block.split("\n");
    const at = rows.findIndex((row) => row.includes("-->"));
    if (at < 0 || at > 1) continue;
    const [from, rest] = rows[at]!.split("-->");
    const start = parseTime(from ?? "");
    const end = parseTime((rest ?? "").trim().split(/\s+/)[0] ?? "");
    if (start === null || end === null) continue;
    entries.push({ start, end, text: rows.slice(at + 1).join("\n") });
  }
  return build(entries);
}

/// The server's JSON cue list (`{ TrackEvents: [{ StartPositionTicks, EndPositionTicks, Text }] }`).
export function parseJsonCues(reply: unknown): Cue[] {
  const events = (reply as { TrackEvents?: unknown } | null)?.TrackEvents;
  if (!Array.isArray(events)) return [];
  const entries: { start: number; end: number; text: string }[] = [];
  for (const event of events.slice(0, MAX_CUES)) {
    const e = event as { StartPositionTicks?: unknown; EndPositionTicks?: unknown; Text?: unknown } | null;
    if (typeof e?.StartPositionTicks !== "number" || typeof e.EndPositionTicks !== "number" || typeof e.Text !== "string") continue;
    if (!(e.StartPositionTicks >= 0) || e.EndPositionTicks > MAX_SECONDS * 1e7) continue;
    entries.push({ start: e.StartPositionTicks / 1e7, end: e.EndPositionTicks / 1e7, text: e.Text });
  }
  return build(entries);
}

/// The cues showing at `seconds` (at most three, in order). `cues` must be sorted by start.
export function activeCues(cues: readonly Cue[], seconds: number): Cue[] {
  let low = 0;
  let high = cues.length - 1;
  let last = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (cues[mid]!.start <= seconds) {
      last = mid;
      low = mid + 1;
    } else high = mid - 1;
  }
  const found: Cue[] = [];
  // Cues can overlap, so a few earlier ones may still be showing.
  for (let at = last; at >= 0 && at > last - 8 && found.length < 3; at--) {
    if (cues[at]!.end > seconds) found.unshift(cues[at]!);
  }
  return found;
}
