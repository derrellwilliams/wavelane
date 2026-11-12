/// The subtitle choice made on a detail page, kept for the next time that film or show plays.
/// A film or episode can name one track; a show names a language, since each episode numbers its
/// tracks differently. Everything read back from storage is checked.
import { load, save } from "../api/storage";
import type { SubTrack } from "./tracks";

export type SubChoice = { off: true } | { index: number } | { language: string };

const LANGUAGE = /^[A-Za-z]{2,12}$/;
const ID = /^[\w-]{1,128}$/;
const key = (id: string) => `subtitle.${id}`;

export function readChoice(raw: string | null): SubChoice | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown> | null;
    if (!value || typeof value !== "object") return null;
    if (value.off === true) return { off: true };
    if (typeof value.index === "number" && Number.isInteger(value.index) && value.index >= 0 && value.index <= 1000) return { index: value.index };
    if (typeof value.language === "string" && LANGUAGE.test(value.language)) return { language: value.language.toLowerCase() };
  } catch {
    // Unreadable: no choice.
  }
  return null;
}

export const loadChoice = (id: string): SubChoice | null => (ID.test(id) ? readChoice(load(key(id))) : null);

export function saveChoice(id: string, choice: SubChoice | null): void {
  if (ID.test(id)) save(key(id), choice ? JSON.stringify(choice) : null);
}

/// The track to start with: a stream number, null for Off, or undefined to leave it to the
/// server's own settings (no choice made, or the chosen track isn't on this film).
export function resolveChoice(tracks: readonly SubTrack[], choice: SubChoice | null | undefined): number | null | undefined {
  if (!choice) return undefined;
  if ("off" in choice) return null;
  if ("index" in choice) return tracks.some((track) => track.index === choice.index) ? choice.index : undefined;
  const same = tracks.filter((track) => track.language?.toLowerCase() === choice.language);
  // Full dialogue before forced signs, and plain before hearing-impaired.
  const best = same.find((track) => !track.forced && !track.sdh) ?? same.find((track) => !track.forced) ?? same[0];
  return best?.index;
}

/// The one-line name of a choice for the button, given the tracks the film has.
export function describeChoice(tracks: readonly SubTrack[], choice: SubChoice | null): string {
  if (!choice) return "Default";
  if ("off" in choice) return "Off";
  if ("language" in choice) return languageName(choice.language);
  return tracks.find((track) => track.index === choice.index)?.label.split(" · ")[0] ?? "Default";
}

export function languageName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}
