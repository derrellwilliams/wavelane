import type { RefObject } from "preact";
import { useEffect } from "preact/hooks";
import { focusFirst } from "../../nav/focus";
import { input } from "../../platform/platform";

/// The rail icon of the screen that is showing.
export const ACTIVE = ".rail-item.is-active";

/// Moves focus into a screen once it has something to show, when focus is nowhere or still on the
/// rail icon that opened it, or on something no longer showing (the card under a detail page).
/// Focus the user has since moved elsewhere is left alone.
export function useEnter(screen: RefObject<HTMLElement | null>, ready: boolean): void {
  useEffect(() => {
    const active = document.activeElement;
    const idle = !active || active === document.body || active.matches(ACTIVE) || active.getClientRects().length === 0;
    if (input.dpad && ready && idle && screen.current) focusFirst(screen.current);
  }, [ready]);
}
