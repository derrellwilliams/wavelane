/// Intro, recap, preview and credits spans the server has found, and which one is showing now.
export type SegmentKind = "Intro" | "Recap" | "Preview" | "Outro";

export interface Segment {
  kind: SegmentKind;
  start: number; // seconds
  end: number;
}

const KINDS: readonly string[] = ["Intro", "Recap", "Preview", "Outro"];
const TICKS = 10_000_000;

/// Segments from the server's reply, checked and sorted by start. Other kinds (commercials,
/// unknown) are ignored.
export function toSegments(reply: unknown): Segment[] {
  const list = (reply as { Items?: unknown } | null)?.Items;
  if (!Array.isArray(list)) return [];
  const segments: Segment[] = [];
  for (const entry of list.slice(0, 50)) {
    const kind = (entry as { Type?: unknown } | null)?.Type;
    const start = (entry as { StartTicks?: unknown }).StartTicks;
    const end = (entry as { EndTicks?: unknown }).EndTicks;
    if (typeof kind !== "string" || !KINDS.includes(kind)) continue;
    if (typeof start !== "number" || typeof end !== "number" || !(start >= 0) || !(end > start) || end > 1e15) continue;
    segments.push({ kind: kind as SegmentKind, start: start / TICKS, end: end / TICKS });
  }
  return segments.sort((a, b) => a.start - b.start);
}

/// The segment the position is inside, with a second of grace at the end so the button doesn't
/// flash up just as the span finishes.
export function activeSegment(segments: readonly Segment[], seconds: number): Segment | undefined {
  return segments.find((segment) => seconds >= segment.start && seconds < segment.end - 1);
}

export function skipLabel(kind: SegmentKind): string {
  return { Intro: "Skip Intro", Recap: "Skip Recap", Preview: "Skip Preview", Outro: "Skip Credits" }[kind];
}
