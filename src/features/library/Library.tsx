import { useMemo, useRef, useState } from "preact/hooks";
import type { Session } from "../../api/auth";
import { everything } from "../../api/library";
import { load, save } from "../../api/storage";
import { Button } from "../../design/components/Button";
import { Menu, type Option } from "../../design/components/Menu";
import { useResource } from "../../data/resource";
import { Grid } from "../browse/Grid";
import { Status, Unreachable } from "../browse/Status";
import { useEnter } from "../shell/enter";
import { openItem } from "../shell/route";
import { arrange, decadesOf, DEFAULT_VIEW, genresOf, isFiltered, readView, SORTS, type SortKey, type View } from "./arrange";

type Kind = "Movie" | "Series";
type Picking = "sort" | "genre" | "decade" | null;

const loaders: Record<Kind, (session: Session) => ReturnType<typeof everything>> = {
  Movie: (session) => everything(session, "Movie"),
  Series: (session) => everything(session, "Series"),
};

/// Movies or Shows: the whole library as a poster grid, with the order and filters chosen from
/// the row above it. The choice is remembered per library.
export function Library({ type }: { type: Kind }) {
  const screen = useRef<HTMLDivElement>(null);
  const library = useResource(`all:${type}`, loaders[type]);
  const [view, setView] = useState<View>(() => readView(load(`view.${type}`)));
  const [picking, setPicking] = useState<Picking>(null);

  const all = library.data;
  const shown = useMemo(() => arrange(all ?? [], view), [all, view]);
  const genres = useMemo(() => genresOf(all ?? []), [all]);
  const decades = useMemo(() => decadesOf(all ?? []), [all]);
  useEnter(screen, all !== undefined || library.failed);

  const change = (next: Partial<View>) => {
    const updated = { ...view, ...next };
    setView(updated);
    save(`view.${type}`, JSON.stringify(updated));
    if (screen.current) screen.current.scrollTop = 0;
  };

  const sorts = type === "Movie" ? SORTS : SORTS.filter((sort) => sort.id !== "runtime");
  const sortLabel = sorts.find((sort) => sort.id === view.sort)?.label ?? "Name";
  const menus: Record<Exclude<Picking, null>, { title: string; options: Option[]; value: string; pick: (id: string) => void }> = {
    sort: { title: "Sort by", options: sorts, value: view.sort, pick: (id) => change({ sort: id as SortKey }) },
    genre: {
      title: "Genre",
      options: [{ id: "", label: "All genres" }, ...genres.map((genre) => ({ id: genre, label: genre }))],
      value: view.genre,
      pick: (genre) => change({ genre }),
    },
    decade: {
      title: "Decade",
      options: [{ id: "", label: "Any decade" }, ...decades.map((decade) => ({ id: decade, label: `${decade}s` }))],
      value: view.decade,
      pick: (decade) => change({ decade }),
    },
  };
  const menu = picking && menus[picking];
  const noun = type === "Movie" ? "movies" : "shows";

  return (
    <>
      <div ref={screen} class="screen" data-scroll="y">
        <header class="screen-head" data-scroll-anchor>
          <div class="title-row">
            <h1 class="display">{type === "Movie" ? "Movies" : "Shows"}</h1>
            {all && <span class="mono secondary">{shown.length === all.length ? all.length : `${shown.length} of ${all.length}`}</span>}
          </div>
          <div class="row" data-focus-group>
            <Button icon="sort-ascending" onPress={() => setPicking("sort")}>
              {sortLabel}
            </Button>
            <Button icon="funnel" on={!!view.genre} onPress={() => setPicking("genre")}>
              {view.genre || "Genre"}
            </Button>
            <Button icon="calendar-blank" on={!!view.decade} onPress={() => setPicking("decade")}>
              {view.decade ? `${view.decade}s` : "Decade"}
            </Button>
            <Button icon={view.unwatched ? "check" : "eye"} on={view.unwatched} onPress={() => change({ unwatched: !view.unwatched })}>
              Unwatched
            </Button>
            <Button icon={view.favorites ? "check" : "heart"} on={view.favorites} onPress={() => change({ favorites: !view.favorites })}>
              Favorites
            </Button>
          </div>
        </header>

        {all && shown.length > 0 && <Grid items={shown} onOpen={openItem} />}
        {all && shown.length === 0 && (
          <Status title={isFiltered(view) ? `No ${noun} match these filters` : `No ${noun} in the library yet`}>
            {isFiltered(view) && (
              <div class="row" data-focus-group>
                <Button onPress={() => change({ ...DEFAULT_VIEW, sort: view.sort })}>Clear filters</Button>
              </div>
            )}
          </Status>
        )}
        {!all && library.failed && <Unreachable />}
      </div>
      {/* Outside the scrolling screen, so moving through the drawer never scrolls what is under it. */}
      {menu && <Menu title={menu.title} options={menu.options} value={menu.value} onPick={menu.pick} onClose={() => setPicking(null)} />}
    </>
  );
}
