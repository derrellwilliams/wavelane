/// Focus engine: moves real DOM focus between elements marked `data-focusable`, by where they sit
/// on screen. Arrows move, OK presses, Back goes to the newest back handler, and the Magic Remote
/// pointer focuses whatever it is over. One instance for the whole app, started from main.tsx.
///
/// Text fields are a focusable frame around an <input>. The input only takes focus (and opens the
/// TV keyboard) after OK on the frame; Up, Down, Back or closing the keyboard return to the frame.
import { pickNext, type Direction } from "./geometry";
import { directionOf, isBack, isOK } from "./keys";

const FOCUSABLE = "[data-focusable]";

type BackHandler = () => void;

const scopes: HTMLElement[] = [];
const backHandlers: BackHandler[] = [];

declare global {
  interface Window {
    PalmSystem?: { platformBack?: () => void };
  }
}

/// Where navigation is confined: the newest open scope (a drawer or dialog), else the whole page.
function root(): ParentNode {
  return scopes[scopes.length - 1] ?? document;
}

function usable(element: HTMLElement): boolean {
  return !element.matches(":disabled") && element.getClientRects().length > 0;
}

function focusables(): HTMLElement[] {
  return Array.from(root().querySelectorAll<HTMLElement>(FOCUSABLE)).filter(usable);
}

/// The focusable that holds focus now (for a text field being edited, its frame).
function current(): HTMLElement | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return null;
  const owner = active.closest<HTMLElement>(FOCUSABLE);
  return owner && root().contains(owner) ? owner : null;
}

function focus(element: HTMLElement) {
  element.focus({ preventScroll: true });
}

/// Puts focus on the item marked `data-autofocus`, or the first one. Screens call this when they
/// appear or swap their contents, since the element that had focus is gone.
export function focusFirst(container: ParentNode = root()): void {
  const items = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(usable);
  const target = items.find((item) => item.hasAttribute("data-autofocus")) ?? items[0];
  if (target) focus(target);
}

export function move(direction: Direction): void {
  const from = current();
  if (!from) {
    focusFirst();
    return;
  }
  const items = focusables().filter((item) => item !== from);
  const next = items[pickNext(from.getBoundingClientRect(), items.map((item) => item.getBoundingClientRect()), direction)];
  if (next) focus(next);
}

/// Confines navigation to `element` until the returned function is called, then puts focus back
/// where it was.
export function pushScope(element: HTMLElement): () => void {
  const before = document.activeElement;
  scopes.push(element);
  focusFirst(element);
  return () => {
    const index = scopes.lastIndexOf(element);
    if (index >= 0) scopes.splice(index, 1);
    if (before instanceof HTMLElement && before.isConnected) focus(before);
    else focusFirst();
  };
}

/// Registers what Back does while a screen or overlay is showing. The newest handler wins.
export function onBack(handler: BackHandler): () => void {
  backHandlers.push(handler);
  return () => {
    const index = backHandlers.lastIndexOf(handler);
    if (index >= 0) backHandlers.splice(index, 1);
  };
}

function back() {
  const handler = backHandlers[backHandlers.length - 1];
  if (handler) handler();
  // Nothing left to go back to: hand Back to the TV, which leaves the app.
  else window.PalmSystem?.platformBack?.();
}

function onKeyDown(event: KeyboardEvent) {
  const active = document.activeElement;
  const typing = active instanceof HTMLInputElement;
  const direction = directionOf(event);

  if (typing) {
    const frame = active.closest<HTMLElement>(FOCUSABLE);
    // Left and Right move the caret. OK is the field's own business (see TextField).
    if (direction === "up" || direction === "down") {
      event.preventDefault();
      if (frame) focus(frame);
      move(direction);
    } else if (isBack(event, true)) {
      event.preventDefault();
      if (frame) focus(frame);
    }
    return;
  }

  if (direction) {
    event.preventDefault();
    move(direction);
  } else if (isOK(event)) {
    // Buttons click themselves on OK. Other focusables (text field frames) need the click sent.
    const item = current();
    if (item && !(item instanceof HTMLButtonElement)) {
      event.preventDefault();
      if (!event.repeat) item.click();
    } else if (!item) {
      focusFirst();
    }
  } else if (isBack(event, false)) {
    event.preventDefault();
    back();
  }
}

/// Magic Remote: the pointer focuses what it is over, so OK and a click always agree.
function onMouseMove(event: MouseEvent) {
  if (!(event.target instanceof Element)) return;
  const item = event.target.closest<HTMLElement>(FOCUSABLE);
  if (!item || !usable(item) || !root().contains(item) || item.contains(document.activeElement)) return;
  focus(item);
}

/// The TV keyboard was dismissed with its own close key: leave the input so arrows navigate again.
function onKeyboardState(event: Event) {
  const visible = (event as CustomEvent<{ visibility?: boolean }>).detail?.visibility;
  const active = document.activeElement;
  if (visible === false && active instanceof HTMLInputElement) {
    const frame = active.closest<HTMLElement>(FOCUSABLE);
    if (frame) focus(frame);
  }
}

export function startFocusEngine(): () => void {
  window.addEventListener("keydown", onKeyDown);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("keyboardStateChange", onKeyboardState);
  return () => {
    window.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("keyboardStateChange", onKeyboardState);
  };
}
