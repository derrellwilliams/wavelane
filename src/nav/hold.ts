/// Press-and-hold for a button or card: OK held (or a pointer pressed) for HOLD_MS calls `onHold`;
/// a normal press calls `onPress` as before. Without `onHold` it is just a click.
import type { JSX } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { isOK } from "./keys";

export const HOLD_MS = 700;

export function useHold(onHold: (() => void) | undefined, onPress: () => void): JSX.IntrinsicElements["button"] {
  const timer = useRef(0);
  const fired = useRef(false);
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
    }, HOLD_MS);
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
    onPointerDown: start,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onClick() {
      // The click that ends a long pointer press is not a press.
      if (fired.current) fired.current = false;
      else onPress();
    },
  };
}
