import { signal } from "@preact/signals";
import { useEffect, useRef, useState } from "preact/hooks";
import type { Session } from "../../api/auth";
import { search } from "../../api/library";
import { TextField } from "../../design/components/TextField";
import { useResource } from "../../data/resource";
import { Card } from "../browse/Card";
import { ItemShelf, Shelf } from "../browse/Shelf";
import { Status, Unreachable } from "../browse/Status";
import { useEnter } from "../shell/enter";
import { openItem } from "../shell/route";

const MIN_LENGTH = 2;
const PAUSE_MS = 400;

/// What was last typed, kept while the app runs so coming back to Search shows the same results.
const typed = signal("");

/// Search: type with the TV keyboard; results arrive a moment after typing stops, grouped into
/// Movies, Shows, Episodes and People. Results are not saved to the cache.
export function Search() {
  const screen = useRef<HTMLDivElement>(null);
  const [term, setTerm] = useState(typed.value.trim());
  useEnter(screen, true);

  useEffect(() => {
    const timer = setTimeout(() => setTerm(typed.value.trim()), PAUSE_MS);
    return () => clearTimeout(timer);
  }, [typed.value]);

  const asking = term.length >= MIN_LENGTH;
  const results = useResource(asking ? `search:${term.toLowerCase()}` : null, (current: Session) => search(current, term), false);
  const found = results.data;
  const none = found && !found.movies.length && !found.shows.length && !found.episodes.length && !found.people.length;

  return (
    <div ref={screen} class="screen" data-scroll="y">
      <header class="screen-head" data-scroll-anchor>
        <h1 class="display">Search</h1>
        <div class="row" data-focus-group>
          <TextField label="Movies, shows, episodes and people" value={typed.value} onChange={(value) => (typed.value = value)} autoFocus maxLength={80} />
        </div>
      </header>

      {found && (
        <>
          <ItemShelf title="Movies" items={found.movies} shape="poster" onOpen={openItem} />
          <ItemShelf title="Shows" items={found.shows} shape="poster" onOpen={openItem} />
          <ItemShelf title="Episodes" items={found.episodes} shape="thumb" onOpen={openItem} />
          {found.people.length > 0 && (
            <Shelf title="People">
              {found.people.map((person) => (
                <Card key={person.id} shape="person" art={person.art} title={person.name} detail="" onPress={() => openItem(person)} />
              ))}
            </Shelf>
          )}
        </>
      )}
      {asking && none && <Status title={`Nothing found for “${term}”`} />}
      {asking && !found && results.failed && <Unreachable />}
    </div>
  );
}
