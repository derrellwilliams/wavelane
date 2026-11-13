/// Touch gestures that are decisions rather than DOM: how far a finger may drift before a press
/// stops being a press, and what counts as a swipe from the left edge (the back gesture). The
/// listeners at the bottom are the only part that touches the page.

/// A press that moves more than this many CSS pixels is a scroll or a swipe, not a long press.
export const SLOP = 10;
/// The back gesture starts this close to the left edge, travels at least SWIPE across, stays
/// roughly level, and is quick.
export const EDGE = 24;
export const SWIPE = 72;
export const SWIPE_MS = 600;

export interface Point {
  x: number;
  y: number;
  t: number;
}

export function exceedsSlop(dx: number, dy: number, slop = SLOP): boolean {
  return Math.hypot(dx, dy) > slop;
}

export function isBackSwipe(start: Point, end: Point): boolean {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return start.x <= EDGE && dx >= SWIPE && Math.abs(dy) <= dx / 2 && end.t - start.t <= SWIPE_MS;
}

/// Calls `onBack` for a swipe in from the left edge.
export function startTouch(onBack: () => void): () => void {
  let start: Point | null = null;
  const down = (event: TouchEvent) => {
    const touch = event.touches.length === 1 ? event.touches[0] : undefined;
    start = touch ? { x: touch.clientX, y: touch.clientY, t: event.timeStamp } : null;
  };
  const up = (event: TouchEvent) => {
    const touch = event.changedTouches[0];
    if (start && touch && isBackSwipe(start, { x: touch.clientX, y: touch.clientY, t: event.timeStamp })) onBack();
    start = null;
  };
  const cancel = () => (start = null);
  document.addEventListener("touchstart", down, { passive: true });
  document.addEventListener("touchend", up, { passive: true });
  document.addEventListener("touchcancel", cancel, { passive: true });
  return () => {
    document.removeEventListener("touchstart", down);
    document.removeEventListener("touchend", up);
    document.removeEventListener("touchcancel", cancel);
  };
}
