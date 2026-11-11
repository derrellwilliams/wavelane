/// What the LG remote sends, with keyboard stand-ins so the app can be driven on a desktop.
import type { Direction } from "./geometry";

const ARROWS: Record<number, Direction> = { 37: "left", 38: "up", 39: "right", 40: "down" };
const OK = 13;
const BACK = 461; // the remote's Back button
const ESCAPE = 27;
const BACKSPACE = 8;

export function directionOf(event: KeyboardEvent): Direction | null {
  return ARROWS[event.keyCode] ?? null;
}

export function isOK(event: KeyboardEvent): boolean {
  return event.keyCode === OK;
}

/// Backspace only counts as Back when the user isn't typing.
export function isBack(event: KeyboardEvent, typing: boolean): boolean {
  return event.keyCode === BACK || event.keyCode === ESCAPE || (event.keyCode === BACKSPACE && !typing);
}
