/// Which shows are kids' shows. A show counts as one when its rating is a children's rating
/// (TV-Y, TV-Y7) or the server lists it under the Children / Kids genre. The user can overrule
/// either way for a single show from its detail page; those choices live in app storage.
import { signal } from "@preact/signals";
import { useMemo } from "preact/hooks";
import type { Session } from "../../api/auth";
import type { Item } from "../../api/items";
import { everything } from "../../api/library";
import { load, save } from "../../api/storage";
import { useResource } from "../../data/resource";

const KEY = "kids";
const CERTIFICATES: ReadonlySet<string> = new Set(["TV-Y", "TV-Y7", "TV-Y7-FV"]);
const GENRES: ReadonlySet<string> = new Set(["children", "kids"]);
const ID = /^[0-9a-f-]{32,36}$/i;
const MAX_IDS = 1000;

export interface Overrides {
  /// Shows put in Kids by hand.
  yes: ReadonlySet<string>;
  /// Shows kept out of Kids by hand.
  no: ReadonlySet<string>;
}

const NONE: Overrides = { yes: new Set(), no: new Set() };

/// What the server says about a show, ignoring any choice made here.
export function looksKids(show: Pick<Item, "certificate" | "genres">): boolean {
  const certificate = (show.certificate ?? "").trim().toUpperCase().replace(/^[A-Z]{2}:/, "");
  return CERTIFICATES.has(certificate) || show.genres.some((genre) => GENRES.has(genre.trim().toLowerCase()));
}

export function isKidsShow(show: Pick<Item, "id" | "certificate" | "genres">, overrides: Overrides): boolean {
  if (overrides.no.has(show.id)) return false;
  if (overrides.yes.has(show.id)) return true;
  return looksKids(show);
}

/// A saved choice read back from storage: anything unexpected is ignored.
export function readOverrides(raw: string | null): Overrides {
  if (!raw) return NONE;
  try {
    const saved = JSON.parse(raw) as { yes?: unknown; no?: unknown } | null;
    const ids = (value: unknown) =>
      new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && ID.test(id)).slice(0, MAX_IDS) : []);
    return saved && typeof saved === "object" ? { yes: ids(saved.yes), no: ids(saved.no) } : NONE;
  } catch {
    return NONE;
  }
}

/// The overrides, as a signal so every screen showing kids content updates when one changes.
export const overrides = signal<Overrides>(readOverrides(load(KEY)));

/// Puts a show in Kids or out of it. Choosing what the server's data already says clears the override.
export function setKids(show: Pick<Item, "id" | "certificate" | "genres">, kids: boolean): void {
  const yes = new Set(overrides.value.yes);
  const no = new Set(overrides.value.no);
  yes.delete(show.id);
  no.delete(show.id);
  if (kids !== looksKids(show)) (kids ? yes : no).add(show.id);
  overrides.value = { yes, no };
  save(KEY, JSON.stringify({ yes: [...yes].slice(0, MAX_IDS), no: [...no].slice(0, MAX_IDS) }));
}

/// The ids of the kids' shows among these shows.
export function kidsIds(shows: readonly Item[], choices: Overrides): Set<string> {
  return new Set(shows.filter((show) => isKidsShow(show, choices)).map((show) => show.id));
}

/// Whether an item belongs in Kids: a show on its own data, an episode or season through its show.
export function inKids(item: Item, ids: ReadonlySet<string>, choices: Overrides): boolean {
  if (item.type === "Series") return isKidsShow(item, choices);
  return !!item.seriesId && ids.has(item.seriesId);
}

const allShows = (session: Session) => everything(session, "Series");

/// The shows split into kids' and the rest, from the same list the Shows tab keeps.
export function useKids() {
  const shows = useResource("all:Series", allShows);
  const choices = overrides.value;
  const ids = useMemo(() => (shows.data ? kidsIds(shows.data, choices) : undefined), [shows.data, choices]);
  const known = ids !== undefined;

  return {
    shows: shows.data,
    choices,
    /// Items without kids' shows. Episodes can only be told apart once the show list is here, so a
    /// shelf holding some waits for it (unless the list can't be loaded at all).
    without(items: Item[] | undefined): Item[] | undefined {
      if (!items) return items;
      if (!known && !shows.failed && items.some((item) => item.type !== "Series" && item.type !== "Movie")) return undefined;
      return items.filter((item) => !inKids(item, ids ?? new Set(), choices));
    },
    /// Only the kids' shows and their episodes (the Kids tab's own shelves).
    only(items: Item[] | undefined): Item[] | undefined {
      if (!items) return items;
      if (!known && !shows.failed && items.some((item) => item.type !== "Series")) return undefined;
      return items.filter((item) => inKids(item, ids ?? new Set(), choices));
    },
  };
}
