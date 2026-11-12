import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Session } from "../../api/auth";
import { episodeCode, type Item } from "../../api/items";
import { collections, everything, favorites, latest, nextUp, resume } from "../../api/library";
import { Button } from "../../design/components/Button";
import { useResource } from "../../data/resource";
import { useMarks } from "../../letterboxd/marks";
import type { Seen } from "../../letterboxd/log";
import { Hero } from "../browse/Hero";
import { ItemShelf } from "../browse/Shelf";
import { Status, Unreachable } from "../browse/Status";
import { openItem, play } from "../shell/route";
import { looksKids, useKids } from "../kids/kids";
import { averages } from "../../letterboxd/average";
import { topUnwatched } from "./spotlight";
import { useEnter } from "../shell/enter";

/// How long each pick of the rotation stays up.
const SPOTLIGHT_MS = 12_000;

const latestMovies = (session: Session) => latest(session, "Movie");
const allMovies = (session: Session) => everything(session, "Movie");
const latestShows = (session: Session) => latest(session, "Series");

function pick(library: Item[] | undefined, marks: ReturnType<typeof useMarks>, keep: (mark: Seen) => boolean, order: (a: Seen, b: Seen) => number): Item[] | undefined {
  if (!library || marks.size === 0) return undefined;
  return library
    .filter((item) => {
      const mark = marks.get(item.id);
      return !!mark && keep(mark);
    })
    .sort((a, b) => order(marks.get(a.id)!, marks.get(b.id)!))
    .slice(0, 20);
}

/// Home: a spotlight on what to watch next, then shelves. Each shelf loads on its own from the
/// last visit's copy and refreshes behind it; a shelf with nothing in it isn't drawn.
export function Home() {
  const screen = useRef<HTMLDivElement>(null);
  const watching = useResource("resume", resume);
  const next = useResource("nextup", nextUp);
  const movies = useResource("latest:Movie", latestMovies);
  const shows = useResource("latest:Series", latestShows);
  const sets = useResource("collections", collections);
  const loved = useResource("favorites", favorites);
  // Kids' shows live on their own tab, so they stay off Home.
  const kids = useKids();
  const watchingNow = kids.without(watching.data);
  const nextNow = kids.without(next.data);
  const showsNow = kids.without(shows.data);
  const lovedNow = kids.without(loved.data);

  const library = useResource("all:Movie", allMovies);
  const marks = useMarks(library.data);
  // Films you logged most recently, and the ones you mean to see, among the library's movies.
  const lately = useMemo(() => pick(library.data, marks, (mark) => !!mark.last, (a, b) => (b.last ?? "").localeCompare(a.last ?? "")), [library.data, marks]);
  const planned = useMemo(() => pick(library.data, marks, (mark) => mark.watchlist, () => 0), [library.data, marks]);

  // With nothing to continue, the spotlight takes turns over the best-liked movies not yet seen.
  const known = averages.value;
  const top = useMemo(() => topUnwatched(library.data, marks, known), [library.data, marks, known]);
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    if (top.length < 2) return;
    const timer = setInterval(() => setTurn((now) => now + 1), SPOTLIGHT_MS);
    return () => clearInterval(timer);
  }, [top.length]);

  const all = [watching, next, movies, shows, sets, loved];
  const lists = [watchingNow, nextNow, movies.data, showsNow, sets.data, lovedNow].map((list) => list ?? []);
  const ready = all.some((shelf) => shelf.data !== undefined);
  const settled = all.every((shelf) => shelf.data !== undefined || shelf.failed);
  const empty = lists.every((list) => list.length === 0);
  useEnter(screen, ready && !empty);
  useEnter(screen, settled && empty);

  // Children's movies being watched don't take the spotlight either.
  const resuming = watchingNow?.find((item) => !(item.type === "Movie" && looksKids(item)));
  const spotlight: Item | undefined =
    resuming ?? nextNow?.[0] ?? top[turn % Math.max(top.length, 1)] ?? movies.data?.find((item) => item.backdrop) ?? movies.data?.[0] ?? showsNow?.[0];
  const kicker = !spotlight
    ? undefined
    : spotlight === resuming
      ? "Continue watching"
      : spotlight.type === "Episode"
        ? `Next up${episodeCode(spotlight) ? `  ·  ${episodeCode(spotlight)}` : ""}`
        : top.includes(spotlight)
          ? "Top rated on Letterboxd  ·  not watched yet"
          : "Recently added";

  return (
    <div ref={screen} class="screen has-hero" data-scroll="y">
      {spotlight && (
        <Hero item={spotlight} kicker={kicker} average={spotlight.tmdb ? known.get(spotlight.tmdb)?.rating : undefined}>
          {(spotlight.type === "Movie" || spotlight.type === "Episode") && (
            <Button icon="play" onPress={() => play(spotlight.id, !!spotlight.progress)} autoFocus>
              {spotlight.progress ? "Resume" : "Play"}
            </Button>
          )}
          <Button icon="arrow-right" onPress={() => openItem(spotlight)} autoFocus={spotlight.type !== "Movie" && spotlight.type !== "Episode"}>
            Details
          </Button>
        </Hero>
      )}
      <ItemShelf title="Continue Watching" items={watchingNow} shape="thumb" onOpen={openItem} />
      <ItemShelf title="Next Up" items={nextNow} shape="thumb" onOpen={openItem} />
      <ItemShelf title="Recently Added Movies" items={movies.data} shape="poster" onOpen={openItem} />
      <ItemShelf title="Recently Added Shows" items={showsNow} shape="poster" onOpen={openItem} />
      <ItemShelf title="Recently watched on Letterboxd" items={lately} shape="poster" onOpen={openItem} />
      <ItemShelf title="On your Letterboxd watchlist" items={planned} shape="poster" onOpen={openItem} />
      <ItemShelf title="Collections" items={sets.data} shape="poster" onOpen={openItem} />
      <ItemShelf title="Favorites" items={lovedNow} shape="poster" onOpen={openItem} />
      {settled && empty && (all.every((shelf) => shelf.failed) ? <Unreachable /> : <Status title="Nothing in the library yet" />)}
    </div>
  );
}
