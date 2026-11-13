/// Chapter marks the server read from the file: a name and where each starts.
export interface Chapter {
  name: string;
  /// Seconds from the start.
  start: number;
}

const TICKS = 10_000_000;
const MAX_CHAPTERS = 200;

/// Chapters from the server's list, checked and sorted by start. Unnamed ones get "Chapter N".
export function toChapters(raw: unknown): Chapter[] {
  if (!Array.isArray(raw)) return [];
  const chapters: Chapter[] = [];
  for (const entry of raw.slice(0, MAX_CHAPTERS)) {
    const ticks = (entry as { StartPositionTicks?: unknown } | null)
      ?.StartPositionTicks;
    if (typeof ticks !== "number" || !(ticks >= 0) || ticks > 1e15) continue;
    const name = (entry as { Name?: unknown }).Name;
    const text = typeof name === "string" ? name.trim().slice(0, 80) : "";
    chapters.push({
      name: text,
      start: ticks / TICKS,
    });
  }
  return chapters
    .sort((a, b) => a.start - b.start)
    .map((chapter, position) => ({
      ...chapter,
      name: chapter.name || `Chapter ${position + 1}`,
    }));
}

/// The chapter a position falls in, or -1 before the first.
export function chapterAt(
  chapters: readonly Chapter[],
  seconds: number,
): number {
  let found = -1;
  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i]!.start <= seconds) found = i;
    else break;
  }
  return found;
}
