/// Where the user is: one of the rail's screens, with any number of detail pages opened on top.
/// Kept in signals (not component state) so it survives the setup check and screen swaps.
import { signal } from "@preact/signals";
import type { SubChoice } from "../../subtitles/choice";

export type Tab = "home" | "movies" | "shows" | "search" | "account";

export interface Page {
  id: string;
  /// What had focus when the page was opened, to go back to.
  from: Element | null;
}

const MAX_DEPTH = 30;

export const tab = signal<Tab>("home");
export const pages = signal<Page[]>([]);
/// The film or episode on screen in the player, if any. `resume` starts where it was left.
/// `subtitle` is the choice made on the detail page, if any.
export const playing = signal<{ id: string; resume: boolean; subtitle?: SubChoice } | null>(null);

export function play(id: string, resume: boolean, subtitle?: SubChoice): void {
  playing.value = { id, resume, subtitle };
}

/// Set by `goBack` for the shell to focus once the screen underneath is showing again.
export let returnTo: Element | null = null;

export function openItem(target: { id: string }): void {
  const open = pages.value;
  if (open.length >= MAX_DEPTH || open[open.length - 1]?.id === target.id) return;
  pages.value = [...open, { id: target.id, from: document.activeElement }];
}

/// One step back: close the top detail page, else return to Home. False when already there.
export function goBack(): boolean {
  if (playing.value) {
    playing.value = null;
    return true;
  }
  const open = pages.value;
  if (open.length) {
    returnTo = open[open.length - 1]!.from;
    pages.value = open.slice(0, -1);
    return true;
  }
  if (tab.value !== "home") {
    tab.value = "home";
    return true;
  }
  return false;
}

export function resetRoute(): void {
  returnTo = null;
  pages.value = [];
  playing.value = null;
  tab.value = "home";
}
