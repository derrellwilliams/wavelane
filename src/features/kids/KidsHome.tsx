import { useMemo } from "preact/hooks";
import type { Session } from "../../api/auth";
import { episodeCode, type Item } from "../../api/items";
import { nextUp, resume } from "../../api/library";
import { Button } from "../../design/components/Button";
import { useResource } from "../../data/resource";
import { withoutDismissed } from "../browse/dismissed";
import { Hero } from "../browse/Hero";
import { useRemoveFromContinue } from "../browse/RemoveFromContinue";
import { ItemShelf } from "../browse/Shelf";
import { Library } from "../library/Library";
import { openItem, play } from "../shell/route";
import { isKidsShow, useKids } from "./kids";

/// Wide enough that kids' episodes still show up when grown-up shows fill the server's lists.
const WIDE = "100";
const SHELF = 20;
const resumeWide = (session: Session) => resume(session, WIDE);
const nextWide = (session: Session) => nextUp(session, WIDE);

/// The Kids tab as its own home screen: a spotlight on what to watch, Continue Watching, Next Up
/// and Recently Added for kids' shows, then every kids' show in the grid below.
export function KidsHome() {
  const kids = useKids();
  const watching = useResource("resume:wide", resumeWide);
  const next = useResource("nextup:wide", nextWide);

  const remove = useRemoveFromContinue();
  const continuing = withoutDismissed(kids.only(watching.data));
  const upNext = kids.only(next.data);
  const added = useMemo(
    () =>
      kids.shows
        ?.filter((show) => isKidsShow(show, kids.choices))
        .sort((a, b) => (b.added ?? 0) - (a.added ?? 0))
        .slice(0, SHELF),
    [kids.shows, kids.choices],
  );

  const resuming = continuing?.[0];
  const spotlight: Item | undefined = resuming ?? upNext?.[0] ?? added?.find((show) => show.backdrop) ?? added?.[0];
  const kicker = !spotlight
    ? undefined
    : spotlight === resuming
      ? "Continue watching"
      : spotlight.type === "Episode"
        ? `Next up${episodeCode(spotlight) ? `  ·  ${episodeCode(spotlight)}` : ""}`
        : "Recently added";
  const playable = spotlight?.type === "Episode" || spotlight?.type === "Movie";

  const intro = (
    <>
      {spotlight && (
        <Hero item={spotlight} kicker={kicker}>
          {playable && (
            <Button
              icon="play"
              onPress={() => play(spotlight.id, !!spotlight.progress)}
              onHold={spotlight === resuming ? () => remove.ask(spotlight) : undefined}
              autoFocus
            >
              {spotlight.progress ? "Resume" : "Play"}
            </Button>
          )}
          <Button icon="arrow-right" onPress={() => openItem(spotlight)} autoFocus={!playable}>
            Details
          </Button>
        </Hero>
      )}
      <ItemShelf title="Continue Watching" items={continuing} shape="thumb" onOpen={openItem} onHold={remove.ask} />
      <ItemShelf title="Next Up" items={upNext} shape="thumb" onOpen={openItem} />
      <ItemShelf title="Recently Added" items={added} shape="poster" onOpen={openItem} />
    </>
  );

  return <Library type="Kids" intro={intro} hero={!!spotlight} after={remove.menu} />;
}
