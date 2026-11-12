import { useEffect, useRef, useState } from "preact/hooks";
import type { Item } from "../../api/items";
import { children, episodeToPlay, episodes, item as fetchItem, seasons, setFavorite, setPlayed, similar, withPerson } from "../../api/library";
import { session } from "../../api/session";
import { Button } from "../../design/components/Button";
import { refreshAll, useResource } from "../../data/resource";
import { Card } from "../browse/Card";
import { Hero } from "../browse/Hero";
import { ItemShelf, Shelf } from "../browse/Shelf";
import { Unreachable } from "../browse/Status";
import { averages, wantAverage } from "../../letterboxd/average";
import { describeSeen, useMarks } from "../../letterboxd/marks";
import { watchLog } from "../../letterboxd/store";
import { useEnter } from "../shell/enter";
import { openItem, play } from "../shell/route";

type Mark = "played" | "favorite";

/// One movie, show, episode, collection or person: the header with its actions, then the shelves
/// that belong to it (episodes by season, cast, more like this, what a collection holds, what a
/// person is in). Each shelf loads on its own.
export function Detail({ id }: { id: string }) {
  const screen = useRef<HTMLDivElement>(null);
  const main = useResource(`item:${id}`, (current) => fetchItem(current, id));
  const item = main.data;
  const type = item?.type;

  const seasonList = useResource(type === "Series" ? `seasons:${id}` : null, (current) => seasons(current, id));
  const [chosen, setChosen] = useState<string | null>(null);
  // Start on the first season with something left to watch.
  const season =
    seasonList.data?.find((entry) => entry.id === chosen) ??
    seasonList.data?.find((entry) => !entry.played && entry.season !== 0) ??
    seasonList.data?.[0];
  const seasonId = season?.id;
  const episodeList = useResource(seasonId ? `episodes:${id}:${seasonId}` : null, (current) => episodes(current, id, seasonId!));
  const mine = useMarks(item?.type === "Movie" ? [item] : undefined);
  const tmdb = item?.type === "Movie" ? item.tmdb : undefined;
  useEffect(() => wantAverage(tmdb), [tmdb]);
  const alike = useResource(type === "Movie" || type === "Series" ? `similar:${id}` : null, (current) => similar(current, id));
  const held = useResource(type === "BoxSet" ? `children:${id}` : null, (current) => children(current, id));
  const credits = useResource(type === "Person" ? `person:${id}` : null, (current) => withPerson(current, id));

  // Shown at once, then confirmed by the server (and put back if it refuses).
  const [local, setLocal] = useState<Partial<Record<Mark, boolean>>>({});
  useEnter(screen, !!item || main.failed);

  if (!item) return <div ref={screen} class="detail">{main.failed && <Unreachable />}</div>;

  const state: Record<Mark, boolean> = { played: local.played ?? item.played, favorite: local.favorite ?? item.favorite };
  const toggle = async (mark: Mark) => {
    const current = session.value;
    if (!current) return;
    const next = !state[mark];
    setLocal((now) => ({ ...now, [mark]: next }));
    try {
      await (mark === "played" ? setPlayed : setFavorite)(current, id, next);
      refreshAll();
    } catch {
      setLocal((now) => ({ ...now, [mark]: !next }));
    }
  };

  const start = async (resume: boolean) => {
    const current = session.value;
    if (!current) return;
    if (type === "Series") {
      // A show plays the episode to watch next.
      const episode = await episodeToPlay(current, id).catch(() => null);
      if (episode) play(episode.id, !!episode.progress);
    } else {
      play(id, resume);
    }
  };

  const playable = type === "Movie" || type === "Episode";
  const watchable = playable || type === "Series";
  const seriesId = type === "Episode" ? item.seriesId : undefined;
  const open = (target: Item) => openItem(target);

  return (
    <div ref={screen} class="detail" data-scroll="y">
      <Hero item={item} full average={tmdb ? averages.value.get(tmdb)?.rating : undefined} notes={[describeSeen(mine.get(item.id))]}>
        {(playable || type === "Series") && (
          <Button icon="play" onPress={() => void start(item.progress ? true : false)} autoFocus>
            {item.progress ? "Resume" : "Play"}
          </Button>
        )}
        {playable && item.progress && (
          <Button icon="arrow-counter-clockwise" onPress={() => play(id, false)}>
            Restart
          </Button>
        )}
        {/* Movies take watched from Letterboxd, so Jellyfin's own toggle is hidden once a log is loaded. */}
        {watchable && !(type === "Movie" && watchLog.value.length > 0) && (
          <Button icon={state.played ? "check" : "eye"} on={state.played} onPress={() => void toggle("played")} autoFocus={!playable && type !== "Series"}>
            Watched
          </Button>
        )}
        <Button icon={state.favorite ? "check" : "heart"} on={state.favorite} onPress={() => void toggle("favorite")} autoFocus={!watchable && !playable}>
          Favorite
        </Button>
        {seriesId && (
          <Button icon="television-simple" onPress={() => openItem({ id: seriesId })}>
            Go to show
          </Button>
        )}
      </Hero>

      {type === "Series" && seasonList.data && seasonList.data.length > 1 && (
        <Shelf title="Seasons">
          {seasonList.data.map((entry) => (
            <Button key={entry.id} on={entry.id === seasonId} onPress={() => setChosen(entry.id)}>
              {entry.name}
            </Button>
          ))}
        </Shelf>
      )}
      {type === "Series" && (
        <ItemShelf title={season?.name ?? "Episodes"} items={episodeList.data} shape="thumb" onOpen={open} ownTitle />
      )}
      <ItemShelf title="In this collection" items={held.data} shape="poster" onOpen={open} />
      <ItemShelf title="Movies and shows" items={credits.data} shape="poster" onOpen={open} />
      {item.people && (
        <Shelf title="Cast and crew">
          {item.people.map((person) => (
            <Card
              key={person.id}
              shape="person"
              art={person.art}
              title={person.name}
              detail={person.role}
              onPress={() => openItem(person)}
            />
          ))}
        </Shelf>
      )}
      <ItemShelf title="More like this" items={alike.data} shape="poster" onOpen={open} />
    </div>
  );
}
