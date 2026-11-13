/// Press-and-hold for a button or card: OK held (or a pointer or finger pressed) for the hold time
/// calls `onHold`; a normal press calls `onPress` as before. Without `onHold` it is just a click.
/// A finger that moves (scrolling) or lifts early never holds.
import type { JSX } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { input } from "../platform/platform";
import { isOK } from "./keys";
import { exceedsSlop } from "./touch";

export const HOLD_MS = 700;
/// Fingers are quicker than a remote's OK button.
export const HOLD_TOUCH_MS = 500;

export function useHold(onHold: (() => void) | undefined, onPress: () => void): JSX.IntrinsicElements["button"] {
  const timer = useRef(0);
  const fired = useRef(false);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const cancel = () => {
    clearTimeout(timer.current);
    timer.current = 0;
  };
  const start = () => {
    cancel();
    fired.current = false;
    timer.current = window.setTimeout(() => {
      timer.current = 0;
      fired.current = true;
      onHold?.();
    }, input.touch ? HOLD_TOUCH_MS : HOLD_MS);
  };
  useEffect(() => cancel, []);

  if (!onHold) return { onClick: onPress };
  return {
    // The key press is held back until it is known to be short, so it can't also click.
    onKeyDown(event) {
      if (!isOK(event)) return;
      event.preventDefault();
      if (!event.repeat) start();
    },
    onKeyUp(event) {
      if (!isOK(event)) return;
      event.preventDefault();
      const short = timer.current !== 0;
      cancel();
      if (short) onPress();
      fired.current = false;
    },
    onBlur: cancel,
    onPointerDown(event) {
      origin.current = { x: event.clientX, y: event.clientY };
      start();
    },
    onPointerMove(event) {
      const from = origin.current;
      if (from && timer.current && exceedsSlop(event.clientX - from.x, event.clientY - from.y)) cancel();
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    // A long press on a touch screen would open the browser's own menu over ours.
    onContextMenu(event) {
      event.preventDefault();
    },
    onClick() {
      // The click that ends a long pointer press is not a press.
      if (fired.current) fired.current = false;
      else onPress();
    },
  };
}
