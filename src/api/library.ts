/// Every library question the browse screens ask, as one function each. All go through
/// `request()` and return checked `Item`s. Paths and parameter names follow the installed
/// `@jellyfin/sdk` (1.0.2); the user's server is a newer major version, so each screen copes with
/// a call failing on its own.
import { connectionOf, type Session } from "./auth";
import { request } from "./client";
import { toItem, toItems, type Item, type Person } from "./items";

type Query = Record<string, string>;

const SHELF = "24";
const PAGE = 2000;
const MAX_PAGES = 15;
/// Lists hold what sorting, filtering and (later) matching need. Overviews stay out: too heavy.
const LIST_FIELDS = "SortName,Genres,DateCreated,ProviderIds";
const SHELF_FIELDS = "Overview,Genres";
const DETAIL_FIELDS = "Overview,Genres,People,ProviderIds,DateCreated,SortName,MediaSources,Chapters";
const IMAGES: Query = { enableImageTypes: "Primary,Backdrop,Thumb,Logo", imageTypeLimit: "1" };

function get(session: Session, path: string, query: Query, timeoutMs?: number): Promise<unknown> {
  return request<unknown>(connectionOf(session), path, { query: { userId: session.userId, ...IMAGES, ...query }, timeoutMs });
}

async function list(session: Session, path: string, query: Query): Promise<Item[]> {
  return toItems(await get(session, path, query));
}

/// The whole library of one type, fetched in pages. Sorting and filtering then happen on the TV.
export async function everything(session: Session, type: "Movie" | "Series"): Promise<Item[]> {
  const items: Item[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const reply = await get(
      session,
      "/Items",
      {
        includeItemTypes: type,
        recursive: "true",
        fields: LIST_FIELDS,
        sortBy: "SortName",
        startIndex: String(page * PAGE),
        limit: String(PAGE),
        enableTotalRecordCount: "false",
      },
      30000,
    );
    const raw = (reply as { Items?: unknown } | null)?.Items;
    items.push(...toItems(reply));
    if (!Array.isArray(raw) || raw.length < PAGE) break;
  }
  return items;
}

export const resume = (session: Session, limit = SHELF) =>
  list(session, "/UserItems/Resume", { mediaTypes: "Video", limit, fields: SHELF_FIELDS });

export const nextUp = (session: Session, limit = SHELF) =>
  list(session, "/Shows/NextUp", { limit, fields: SHELF_FIELDS, enableResumable: "false" });

export const latest = (session: Session, type: "Movie" | "Series") =>
  list(session, "/Items/Latest", { includeItemTypes: type, limit: SHELF, fields: SHELF_FIELDS, groupItems: "true" });

export const favorites = (session: Session) =>
  list(session, "/Items", {
    includeItemTypes: "Movie,Series",
    recursive: "true",
    isFavorite: "true",
    sortBy: "SortName",
    limit: "60",
    fields: SHELF_FIELDS,
  });

export const collections = (session: Session) =>
  list(session, "/Items", { includeItemTypes: "BoxSet", recursive: "true", sortBy: "SortName", limit: "100" });

/// Forgets where you were in a film or episode, which takes it off Continue Watching. Whether it
/// counts as watched is left alone.
export async function clearProgress(session: Session, id: string): Promise<void> {
  await request<unknown>(connectionOf(session), `/UserItems/${id}/UserData`, {
    method: "POST",
    query: { userId: session.userId },
    body: { PlaybackPositionTicks: 0 },
  });
}

export async function item(session: Session, id: string): Promise<Item> {
  const found = toItem(await get(session, `/Items/${id}`, { fields: DETAIL_FIELDS }));
  if (!found) throw new Error("item not usable");
  return found;
}

export const seasons = (session: Session, seriesId: string) => list(session, `/Shows/${seriesId}/Seasons`, {});

export const episodes = (session: Session, seriesId: string, seasonId: string) =>
  list(session, `/Shows/${seriesId}/Episodes`, { seasonId, fields: "Overview" });

export const similar = (session: Session, id: string) => list(session, `/Items/${id}/Similar`, { limit: "16" });

/// What a collection holds.
export const children = (session: Session, parentId: string) =>
  list(session, "/Items", { parentId, sortBy: "PremiereDate,SortName", limit: "200" });

export const withPerson = (session: Session, personId: string) =>
  list(session, "/Items", {
    personIds: personId,
    includeItemTypes: "Movie,Series",
    recursive: "true",
    sortBy: "PremiereDate",
    sortOrder: "Descending",
    limit: "200",
  });

export interface SearchResults {
  movies: Item[];
  shows: Item[];
  episodes: Item[];
  people: Person[];
}

export async function search(session: Session, term: string): Promise<SearchResults> {
  const find = (types: string) =>
    list(session, "/Items", { searchTerm: term, includeItemTypes: types, recursive: "true", limit: SHELF });
  const [movies, shows, found, people] = await Promise.all([
    find("Movie"),
    find("Series"),
    find("Episode"),
    // People are optional: a server without the endpoint still gets its other results.
    list(session, "/Persons", { searchTerm: term, limit: SHELF }).catch(() => []),
  ]);
  return {
    movies,
    shows,
    episodes: found,
    people: people.map((person) => ({ id: person.id, name: person.name, role: "", art: person.poster })),
  };
}

async function mark(session: Session, path: string, on: boolean): Promise<void> {
  await request<unknown>(connectionOf(session), path, { method: on ? "POST" : "DELETE", query: { userId: session.userId } });
}

export const setFavorite = (session: Session, id: string, on: boolean) => mark(session, `/UserFavoriteItems/${id}`, on);
export const setPlayed = (session: Session, id: string, on: boolean) => mark(session, `/UserPlayedItems/${id}`, on);

/// What "Play" on a show starts: the episode to watch next (one part-watched counts), else the
/// first regular episode.
export async function episodeToPlay(session: Session, seriesId: string): Promise<Item | null> {
  const next = await list(session, "/Shows/NextUp", { seriesId, limit: "1", enableResumable: "true", fields: "" });
  if (next[0]) return next[0];
  const first = await list(session, `/Shows/${seriesId}/Episodes`, { isSpecialSeason: "false", limit: "1" });
  return first[0] ?? null;
}

/// Every regular episode of a show, in order (for saving a whole show).
export const allEpisodes = (session: Session, seriesId: string) =>
  list(session, `/Shows/${seriesId}/Episodes`, { isSpecialSeason: "false", fields: "Overview" });

/// The episode after this one in its show, if any.
export async function episodeAfter(session: Session, episode: Item): Promise<Item | null> {
  if (!episode.seriesId) return null;
  const around = await list(session, `/Shows/${episode.seriesId}/Episodes`, { adjacentTo: episode.id });
  const at = around.findIndex((entry) => entry.id === episode.id);
  return at >= 0 ? (around[at + 1] ?? null) : null;
}
