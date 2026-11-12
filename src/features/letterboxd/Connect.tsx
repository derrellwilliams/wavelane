import { useMemo, useRef, useState } from "preact/hooks";
import type { Session } from "../../api/auth";
import { everything } from "../../api/library";
import { useResource } from "../../data/resource";
import { TextField } from "../../design/components/TextField";
import { Button } from "../../design/components/Button";
import { useBack } from "../../nav/hooks";
import { matchLibrary } from "../../letterboxd/match";
import { isUsername, setUsername, username } from "../../letterboxd/feed";
import { averages, pausedUntil, scraping, setScraping, libraryTotal } from "../../letterboxd/average";
import { forgetWatchLog, watchLog } from "../../letterboxd/store";
import { useEnter } from "../shell/enter";

const loadMovies = (session: Session) => everything(session, "Movie");
const MAX_SHOWN = 300;

/// Letterboxd: how much of the export is in, how much of it the library has, and the films with no
/// match. The export comes from the build (`npm run seed`). Nothing here writes to Letterboxd.
export function Connect({ onClose }: { onClose: () => void }) {
  const screen = useRef<HTMLElement>(null);
  const log = watchLog.value;
  const movies = useResource("all:Movie", loadMovies);
  const [listing, setListing] = useState(false);
  const [typed, setTyped] = useState(username.value);
  useBack(onClose);
  useEnter(screen, true);

  const found = useMemo(() => (movies.data && log.length ? matchLibrary(log, movies.data) : null), [movies.data, log]);
  const got = [...averages.value.values()].filter((entry) => entry.rating !== null).length;
  const waiting = pausedUntil.value > Date.now() ? new Date(pausedUntil.value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  const watched = log.filter((film) => film.watched).length;
  const rated = log.filter((film) => film.rating !== undefined).length;
  const listed = log.filter((film) => film.watchlist).length;

  if (listing && found) {
    return (
      <main ref={screen} class="page" data-scroll="y">
        <h1 class="display">Not in your library</h1>
        <p class="secondary">
          {found.missing.length} of {log.length} films{found.missing.length > MAX_SHOWN ? `, showing the first ${MAX_SHOWN}` : ""}.
        </p>
        <div class="list" data-focus-group>
          {found.missing.slice(0, MAX_SHOWN).map((film) => (
            <button key={film.name + film.year} class="button" type="button" data-focusable tabIndex={-1}>
              <span>{film.name}</span>
              <span class="mono secondary">{film.year}</span>
            </button>
          ))}
        </div>
        <div class="row actions" data-focus-group>
          <Button icon="arrow-left" onPress={() => setListing(false)} autoFocus>
            Back
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main ref={screen} class="page">
      <h1 class="display">Letterboxd</h1>
      {log.length > 0 ? (
        <dl class="facts">
          <dt class="secondary">Watched</dt>
          <dd class="mono">{watched}</dd>
          <dt class="secondary">Rated</dt>
          <dd class="mono">{rated}</dd>
          <dt class="secondary">Watchlist</dt>
          <dd class="mono">{listed}</dd>
          <dt class="secondary">In your library</dt>
          <dd class="mono">{found ? `${log.length - found.missing.length} of ${log.length}` : "…"}</dd>
        </dl>
      ) : (
        <p class="secondary">No export in this build. Put the export folder in scratch/, run npm run seed, then rebuild.</p>
      )}

      <div class="row" data-focus-group>
        <TextField label="Letterboxd username (recent films)" value={typed} onChange={setTyped} onDone={() => setUsername(typed)} mono maxLength={41} />
        <Button icon="check" onPress={() => setUsername(typed)} disabled={typed.trim() !== "" && !isUsername(typed.trim().replace(/^@/, ""))}>
          Save
        </Button>
      </div>
      <p class="mono secondary">
        {scraping.value ? `Averages read: ${got} of ${libraryTotal.value} movies${waiting ? `  ·  paused until ${waiting}` : ""}` : "Averages are off"}
      </p>
      <div class="row actions" data-focus-group>
        {found && found.missing.length > 0 && (
          <Button icon="film-reel" onPress={() => setListing(true)}>
            Not in your library
          </Button>
        )}
        <Button icon={scraping.value ? "check" : "star"} on={scraping.value} onPress={() => setScraping(!scraping.value)}>
          Average ratings
        </Button>
        {log.length > 0 && (
          <Button icon="x" onPress={forgetWatchLog}>
            Forget Letterboxd data
          </Button>
        )}
        <Button icon="arrow-left" onPress={onClose}>
          Back
        </Button>
      </div>
    </main>
  );
}
