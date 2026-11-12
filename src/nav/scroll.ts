/// Keeps the focused item on screen. Nothing in the app scrolls by itself: containers marked
/// `data-scroll="x"` or `data-scroll="y"` clip their contents, and when the remote moves focus
/// each one scrolls just far enough to show the item (the browser's own smooth scroll, which runs
/// off the main thread like a transform).
///
/// Down the page an item brings its whole section into view: the nearest `data-scroll-anchor`
/// (a shelf with its title). The room left around an item is the container's `scroll-padding`,
/// or its padding when that isn't set.

/// Where a container should scroll to so `start..end` (in content coordinates) is visible with
/// `before` and `after` to spare. Returns `current` when it already is.
export function scrollOffset(
  start: number,
  end: number,
  current: number,
  view: number,
  max: number,
  before: number,
  after: number,
): number {
  let next = current;
  if (end + after > next + view) next = end + after - view;
  // Checked last so the start wins when the item is larger than the view.
  if (start - before < next) next = start - before;
  return Math.min(Math.max(0, max), Math.max(0, next));
}

/// The remote moved focus last (true) or the pointer did (false). The pointer never scrolls by
/// hovering: an item under it at the screen edge would pull the next one in, and so on.
let byKey = true;

function room(scrollPadding: string, padding: string): number {
  const set = Number.parseFloat(scrollPadding);
  return Number.isFinite(set) ? set : Number.parseFloat(padding) || 0;
}

function reveal(target: HTMLElement): void {
  for (let node = target.parentElement; node; node = node.parentElement) {
    const axis = node.dataset.scroll;
    if (axis !== "x" && axis !== "y") continue;
    const horizontal = axis === "x";
    const anchor = horizontal ? target : (target.closest<HTMLElement>("[data-scroll-anchor]") ?? target);
    const subject = node.contains(anchor) && anchor !== node ? anchor : target;
    const box = subject.getBoundingClientRect();
    const frame = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    const current = horizontal ? node.scrollLeft : node.scrollTop;
    const start = (horizontal ? box.left - frame.left : box.top - frame.top) + current;
    const size = horizontal ? box.width : box.height;
    const view = horizontal ? node.clientWidth : node.clientHeight;
    const max = (horizontal ? node.scrollWidth : node.scrollHeight) - view;
    const before = room(horizontal ? style.scrollPaddingLeft : style.scrollPaddingTop, horizontal ? style.paddingLeft : style.paddingTop);
    const after = room(horizontal ? style.scrollPaddingRight : style.scrollPaddingBottom, horizontal ? style.paddingRight : style.paddingBottom);
    const next = scrollOffset(start, start + size, current, view, max, before, after);
    if (Math.abs(next - current) >= 1) node.scrollTo(horizontal ? { left: next, behavior: "smooth" } : { top: next, behavior: "smooth" });
  }
}

function onFocusIn(event: FocusEvent) {
  if (byKey && event.target instanceof HTMLElement) reveal(event.target);
}

/// The Magic Remote's wheel scrolls the page under the pointer.
function onWheel(event: WheelEvent) {
  if (!(event.target instanceof Element)) return;
  const page = event.target.closest<HTMLElement>('[data-scroll="y"]');
  if (page) page.scrollBy({ top: event.deltaY });
}

export function startScrolling(): () => void {
  const key = () => (byKey = true);
  const pointer = () => (byKey = false);
  // Capture: runs before the focus engine moves focus for the same key press.
  window.addEventListener("keydown", key, true);
  document.addEventListener("mousemove", pointer);
  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("wheel", onWheel, { passive: true });
  return () => {
    window.removeEventListener("keydown", key, true);
    document.removeEventListener("mousemove", pointer);
    document.removeEventListener("focusin", onFocusIn);
    document.removeEventListener("wheel", onWheel);
  };
}
