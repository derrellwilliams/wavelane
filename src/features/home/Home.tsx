import { useRef } from "preact/hooks";
import type { Session } from "../../api/auth";
import { episodeCode, type Item } from "../../api/items";
import { collections, favorites, latest, nextUp, resume } from "../../api/library";
import { Button } from "../../design/components/Button";
import { useResource } from "../../data/resource";
import { Hero } from "../browse/Hero";
import { ItemShelf } from "../browse/Shelf";
import { Status, Unreachable } from "../browse/Status";
import { openItem, play } from "../shell/route";
import { useEnter } from "../shell/enter";

const latestMovies = (session: Session) => latest(session, "Movie");
const latestShows = (session: Session) => latest(session, "Series");

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

  const all = [watching, next, movies, shows, sets, loved];
  const lists = all.map((shelf) => shelf.data ?? []);
  const ready = all.some((shelf) => shelf.data !== undefined);
  const settled = all.every((shelf) => shelf.data !== undefined || shelf.failed);
  const empty = lists.every((list) => list.length === 0);
  useEnter(screen, ready && !empty);
  useEnter(screen, settled && empty);

  const resuming = watching.data?.[0];
  const spotlight: Item | undefined =
    resuming ?? next.data?.[0] ?? movies.data?.find((item) => item.backdrop) ?? movies.data?.[0] ?? shows.data?.[0];
  const kicker = !spotlight
    ? undefined
    : spotlight === resuming
      ? "Continue watching"
      : spotlight.type === "Episode"
        ? `Next up${episodeCode(spotlight) ? `  ·  ${episodeCode(spotlight)}` : ""}`
        : "Recently added";

  return (
    <div ref={screen} class="screen has-hero" data-scroll="y">
      {spotlight && (
        <Hero item={spotlight} kicker={kicker}>
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
      <ItemShelf title="Continue Watching" items={watching.data} shape="thumb" onOpen={openItem} />
      <ItemShelf title="Next Up" items={next.data} shape="thumb" onOpen={openItem} />
      <ItemShelf title="Recently Added Movies" items={movies.data} shape="poster" onOpen={openItem} />
      <ItemShelf title="Recently Added Shows" items={shows.data} shape="poster" onOpen={openItem} />
      <ItemShelf title="Collections" items={sets.data} shape="poster" onOpen={openItem} />
      <ItemShelf title="Favorites" items={loved.data} shape="poster" onOpen={openItem} />
      {settled && empty && (all.every((shelf) => shelf.failed) ? <Unreachable /> : <Status title="Nothing in the library yet" />)}
    </div>
  );
}
