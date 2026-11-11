import { useEffect } from "preact/hooks";
import { focusFirst, onBack } from "./focus";

/// Focuses the screen's starting item when it appears, and again whenever `key` changes (a screen
/// that swaps its contents passes its current step).
export function useAutoFocus(key?: unknown): void {
  useEffect(() => {
    focusFirst();
  }, [key]);
}

/// Sets what Back does while the calling component is on screen. Pass null for "nothing special".
export function useBack(handler: (() => void) | null): void {
  useEffect(() => (handler ? onBack(handler) : undefined), [handler]);
}
