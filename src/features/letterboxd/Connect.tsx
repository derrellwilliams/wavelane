import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Session } from "../../api/auth";
import { everything } from "../../api/library";
import { useResource } from "../../data/resource";
import { TextField } from "../../design/components/TextField";
import { Button } from "../../design/components/Button";
import { Icon } from "../../design/components/Icon";
import { useBack } from "../../nav/hooks";
import { callService, onTV } from "../../platform/service";
import { buildLog } from "../../letterboxd/log";
import { matchLibrary } from "../../letterboxd/match";
import { isUsername, setUsername, username } from "../../letterboxd/feed";
import { averages, pausedUntil, scraping, setScraping, libraryTotal } from "../../letterboxd/average";
import { forgetWatchLog, setWatchLog, watchLog } from "../../letterboxd/store";
import { useEnter } from "../shell/enter";

type Phase = { name: "idle" } | { name: "open"; url: string; code: string; locked: boolean } | { name: "failed"; why: string };

interface UploadStatus {
  state: "off" | "waiting" | "locked" | "received";
  files?: Record<string, string>;
}

const loadMovies = (session: Session) => everything(session, "Movie");
const MAX_SHOWN = 300;

/// Letterboxd: how much of the export is in, how much of it the library has, a way to send a new
/// export from a phone, and the films with no match. Nothing here writes to Letterboxd.
export function Connect({ onClose }: { onClose: () => void }) {
  const screen = useRef<HTMLElement>(null);
  const log = watchLog.value;
  const movies = useResource("all:Movie", loadMovies);
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
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

  // While the page is open, ask the TV's service every 2 s whether the export has arrived. Leaving
  // the screen (or finishing) closes the page.
  const open = phase.name === "open";
  useEffect(() => {
    if (!open) return;
    let live = true;
    const timer = setInterval(async () => {
      try {
        const now = await callService<UploadStatus>("uploadStatus", {}, 8000);
        if (!live) return;
        if (now.state === "received" && now.files) {
          const films = buildLog({
            watched: now.files["watched.csv"],
            ratings: now.files["ratings.csv"],
            diary: now.files["diary.csv"],
            watchlist: now.files["watchlist.csv"],
          });
          if (films.length === 0) throw new Error("That export had no films in it");
          setWatchLog(films);
          setPhase({ name: "idle" });
        } else if (now.state === "locked") {
          setPhase((current) => (current.name === "open" ? { ...current, locked: true } : current));
        } else if (now.state === "off") {
          setPhase({ name: "idle" });
        }
      } catch (error) {
        if (live) setPhase({ name: "failed", why: error instanceof Error ? error.message : "Something went wrong" });
      }
    }, 2000);
    return () => {
      live = false;
      clearInterval(timer);
      void callService("uploadClose", {}, 5000).catch(() => undefined);
    };
  }, [open]);

  const start = async () => {
    try {
      const info = await callService<{ url: string; code: string }>("uploadOpen", {}, 10000);
      setPhase({ name: "open", url: info.url, code: info.code, locked: false });
    } catch (error) {
      setPhase({ name: "failed", why: error instanceof Error ? error.message : "Could not open the page" });
    }
  };

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
        <p class="secondary">No export yet. Download your data from your Letterboxd account settings, then send the zip file from your phone.</p>
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
      {phase.name === "open" && (
        <div class="stack">
          <p>
            On your phone, open <span class="mono">{phase.url}</span> and type the code <span class="mono display">{phase.code}</span>.
          </p>
          {phase.locked && <p class="secondary">Too many wrong codes. Choose Cancel and start again.</p>}
        </div>
      )}
      {phase.name === "failed" && (
        <p class="notice secondary">
          <Icon name="warning" />
          {phase.why}
        </p>
      )}
      {!onTV && <p class="secondary">Sending an export works on the TV only.</p>}

      <div class="row actions" data-focus-group>
        {phase.name === "open" ? (
          <Button icon="x" onPress={() => setPhase({ name: "idle" })} autoFocus>
            Cancel
          </Button>
        ) : (
          <Button icon="qr-code" onPress={() => void start()} disabled={!onTV} autoFocus>
            {log.length > 0 ? "Send a new export" : "Send export from phone"}
          </Button>
        )}
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
