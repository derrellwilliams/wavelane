/// Remote seeking: one press jumps 10 s; holding the arrow speeds up so a film can be crossed
/// in a few seconds. The jump is only made once the key is let go (see Player), so the bar and
/// thumbnail can run ahead without the video being asked to seek on every repeat.

/// Seconds to move for the nth key event of a press (0 = the first).
export function scrubStep(repeat: number): number {
  if (repeat < 4) return 10;
  if (repeat < 12) return 30;
  if (repeat < 30) return 60;
  return 180;
}

/// `base` moved by one step in `direction` (-1 or 1), kept inside the film.
export function scrubTarget(base: number, direction: -1 | 1, repeat: number, duration: number): number {
  const end = Math.max(0, duration - 1);
  return Math.min(end, Math.max(0, base + direction * scrubStep(repeat)));
}

/// "1:05:09" or "5:09".
export function clock(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
