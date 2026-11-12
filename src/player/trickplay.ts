/// Scrub thumbnails. The server cuts the film into small pictures laid out in tile sheets;
/// this works out which sheet and which spot on it show a given moment.

export interface TrickInfo {
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  count: number;
  /// Milliseconds between pictures.
  interval: number;
}

export interface Thumb {
  /// Which sheet (the number in the sheet's address).
  sheet: number;
  /// Where the picture sits on the sheet, in pixels from its top left.
  x: number;
  y: number;
}

export function thumbAt(info: TrickInfo, seconds: number): Thumb {
  const index = Math.min(info.count - 1, Math.max(0, Math.floor((Math.max(0, seconds) * 1000) / info.interval)));
  const perSheet = info.tileWidth * info.tileHeight;
  const within = index % perSheet;
  return {
    sheet: Math.floor(index / perSheet),
    x: (within % info.tileWidth) * info.width,
    y: Math.floor(within / info.tileWidth) * info.height,
  };
}

function bounded(value: unknown, min: number, max: number): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : undefined;
}

/// The picture sizes the server made for one version of a film (`{ "320": { Width, ... } }`),
/// checked, as the one closest to `wanted` wide. Null when there are none.
export function pickTrickplay(sizes: unknown, wanted: number): TrickInfo | null {
  if (!sizes || typeof sizes !== "object") return null;
  let best: TrickInfo | null = null;
  for (const entry of Object.values(sizes as Record<string, Record<string, unknown> | null>)) {
    const info = {
      width: bounded(entry?.Width, 16, 4096),
      height: bounded(entry?.Height, 16, 4096),
      tileWidth: bounded(entry?.TileWidth, 1, 100),
      tileHeight: bounded(entry?.TileHeight, 1, 100),
      count: bounded(entry?.ThumbnailCount, 1, 1_000_000),
      interval: bounded(entry?.Interval, 100, 3_600_000),
    };
    if (Object.values(info).some((value) => value === undefined)) continue;
    const found = info as TrickInfo;
    if (!best || Math.abs(found.width - wanted) < Math.abs(best.width - wanted)) best = found;
  }
  return best;
}
