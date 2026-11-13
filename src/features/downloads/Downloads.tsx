import { useEffect, useRef, useState } from "preact/hooks";
import { Button } from "../../design/components/Button";
import { Menu } from "../../design/components/Menu";
import { artSrc, episodeCode } from "../../api/items";
import { sizeText, type Saved } from "../../downloads/plan";
import {
  discard,
  refreshSpace,
  retry,
  saved,
  savedArt,
  space,
} from "../../downloads/store";
import { Status } from "../browse/Status";
import { useEnter } from "../shell/enter";
import { openItem, play } from "../shell/route";

/// The poster kept on the tablet (works with no server), else the server's picture.
function useArt(entry: Saved): string | null {
  const [kept, setKept] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    let gone = false;
    void savedArt(entry.id).then((blob) => {
      if (gone || !blob) return;
      url = URL.createObjectURL(blob);
      setKept(url);
    });
    return () => {
      gone = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [entry.id]);
  return kept ?? artSrc(entry.item.poster ?? entry.item.thumb, 80, 120);
}

function line(entry: Saved): string {
  if (entry.state === "done")
    return `${sizeText(entry.bytes)}${entry.kind === "converted" ? " · converted to 720p" : ""}`;
  if (entry.state === "failed") return entry.note ?? "Failed";
  if (entry.state === "queued") return "Waiting";
  const total = entry.total || entry.estimate;
  const share = total
    ? Math.min(99, Math.round((entry.bytes / total) * 100))
    : 0;
  return `${share}% · ${sizeText(entry.bytes)}${entry.total ? ` of ${sizeText(entry.total)}` : ""}`;
}

/// What is saved on the tablet, what is on its way, and how much room is left. It works with no
/// server: everything here is read from the tablet.
export function Downloads() {
  const screen = useRef<HTMLElement>(null);
  const list = saved.value;
  const room = space.value;
  const [asking, setAsking] = useState<Saved | null>(null);
  useEnter(screen, true);
  useEffect(() => {
    void refreshSpace();
    const timer = setInterval(() => void refreshSpace(), 10000);
    return () => clearInterval(timer);
  }, []);

  const used = list.reduce((sum, entry) => sum + entry.bytes, 0);
  const ready = list.filter((entry) => entry.state === "done");
  const rest = list.filter((entry) => entry.state !== "done");

  return (
    <main ref={screen} class="page" data-scroll="y">
      <h1 class="display">Downloads</h1>
      <p class="secondary mono">
        {sizeText(used)} saved
        {room
          ? ` · ${sizeText(room.free)} free of ${sizeText(room.total)}`
          : ""}
      </p>
      {!list.length && (
        <Status title="Nothing saved yet">
          <p class="secondary">
            Open a film or an episode and press Download. Saved films play with
            no connection to the server.
          </p>
        </Status>
      )}
      {rest.length > 0 && <h2 class="section">On their way</h2>}
      {rest.map((entry) => (
        <Row key={entry.id} entry={entry} onAsk={setAsking} />
      ))}
      {ready.length > 0 && <h2 class="section">Saved on this tablet</h2>}
      {ready.map((entry) => (
        <Row key={entry.id} entry={entry} onAsk={setAsking} />
      ))}
      {asking && (
        <Menu
          title={
            asking.state === "done"
              ? "Delete this download?"
              : "Cancel this download?"
          }
          options={[
            {
              id: "yes",
              label:
                asking.state === "done"
                  ? `Delete and free ${sizeText(asking.bytes)}`
                  : "Cancel and remove",
            },
            { id: "no", label: "Keep it" },
          ]}
          value="no"
          onPick={(choice) => choice === "yes" && void discard(asking.id)}
          onClose={() => setAsking(null)}
        />
      )}
    </main>
  );
}

function Row({
  entry,
  onAsk,
}: {
  entry: Saved;
  onAsk: (entry: Saved) => void;
}) {
  const item = entry.item;
  const title =
    item.type === "Episode"
      ? `${item.seriesName ?? item.name} · ${episodeCode(item)} ${item.name}`
      : item.name;
  const src = useArt(entry);
  return (
    <div class="download" data-focus-group>
      <span class="download-art">
        {src && (
          <img
            class="art is-loaded"
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
          />
        )}
      </span>
      <div class="download-text">
        <span class="download-title">{title}</span>
        <span class="secondary mono">{line(entry)}</span>
        {entry.state === "running" && (
          <span class="download-bar">
            <span
              style={{
                transform: `scaleX(${Math.min(1, entry.bytes / (entry.total || entry.estimate || 1))})`,
              }}
            />
          </span>
        )}
        <div class="download-actions">
          {entry.state === "done" && (
            <Button
              icon="play"
              onPress={() =>
                play(entry.id, !!entry.position || !!item.progress)
              }
            >
              {entry.position || item.progress ? "Resume" : "Play"}
            </Button>
          )}
          {entry.state === "failed" && (
            <Button icon="arrow-clockwise" onPress={() => retry(entry.id)}>
              Try again
            </Button>
          )}
          <Button icon="info" onPress={() => openItem(item)}>
            Details
          </Button>
          <Button icon="trash" onPress={() => onAsk(entry)}>
            {entry.state === "done" ? "Delete" : "Cancel"}
          </Button>
        </div>
      </div>
    </div>
  );
}
