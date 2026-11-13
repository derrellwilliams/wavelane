import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { Menu } from "../../design/components/Menu";
import { artSrc, episodeCode } from "../../api/items";
import { useBack } from "../../nav/hooks";
import { groupSaved, sizeText, type Saved, type SavedGroup } from "../../downloads/plan";
import {
  discard,
  refreshSpace,
  retry,
  saved,
  savedArt,
  space,
} from "../../downloads/store";
import { Card } from "../browse/Card";
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
  const [acting, setActing] = useState<Saved | null>(null);
  useEnter(screen, true);
  useEffect(() => {
    void refreshSpace();
    const timer = setInterval(() => void refreshSpace(), 10000);
    return () => clearInterval(timer);
  }, []);

  const [show, setShow] = useState<string | null>(null);
  const leave = useCallback(() => setShow(null), []);
  useBack(show ? leave : null);

  const used = list.reduce((sum, entry) => sum + entry.bytes, 0);
  const groups = groupSaved(list);
  const open = show ? groups.find((group) => group.key === show) : undefined;
  // The last episode of an open show was deleted: back to the list.
  useEffect(() => {
    if (show && !open) setShow(null);
  }, [show, open]);

  return (
    <main ref={screen} class="page" data-scroll="y">
      <h1 class="display">{open ? showName(open) : "Downloads"}</h1>
      <p class="secondary mono">
        {sizeText(open ? open.entries.reduce((sum, entry) => sum + entry.bytes, 0) : used)} saved
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
      {list.length > 0 && (
        <div class="grid" data-focus-group>
          {open
            ? open.entries.map((entry, index) => (
                <DownloadCard
                  key={entry.id}
                  entry={entry}
                  title={`${episodeCode(entry.item)} ${entry.item.name}`.trim()}
                  detail={line(entry)}
                  progress={fraction(entry)}
                  autoFocus={index === 0}
                  onPress={() => setActing(entry)}
                />
              ))
            : groups.map((group, index) => {
                const first = group.entries[0]!;
                return (
                  <DownloadCard
                    key={group.key}
                    entry={first}
                    title={showName(group)}
                    detail={groupLine(group)}
                    progress={group.seriesId ? undefined : fraction(first)}
                    autoFocus={index === 0}
                    onPress={() => (group.seriesId ? setShow(group.key) : setActing(first))}
                  />
                );
              })}
        </div>
      )}
      {acting && (
        <Menu
          title={acting.item.type === "Episode" ? `${acting.item.seriesName ?? acting.item.name} ${episodeCode(acting.item)}`.trim() : acting.item.name}
          options={[
            ...(acting.state === "done"
              ? [
                  {
                    id: "play",
                    label:
                      acting.position || acting.item.progress
                        ? "Resume"
                        : "Play",
                  },
                ]
              : []),
            ...(acting.state === "failed"
              ? [{ id: "retry", label: "Try again" }]
              : []),
            { id: "details", label: "Details" },
            {
              id: "delete",
              label: acting.state === "done" ? "Delete" : "Cancel download",
            },
          ]}
          value=""
          onPick={(choice) => {
            if (choice === "play")
              play(acting.id, !!acting.position || !!acting.item.progress);
            else if (choice === "retry") retry(acting.id);
            else if (choice === "details") openItem(acting.item);
            else setAsking(acting);
          }}
          onClose={() => setActing(null)}
        />
      )}
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

function showName(group: SavedGroup): string {
  const item = group.entries[0]!.item;
  return group.seriesId ? (item.seriesName ?? item.name) : item.name;
}

function fraction(entry: Saved): number | undefined {
  const total = entry.total || entry.estimate;
  return entry.state === "running" && total ? Math.min(1, entry.bytes / total) : undefined;
}

/// A show's tile: how many episodes, how big, and whether any are still coming.
function groupLine(group: SavedGroup): string {
  if (!group.seriesId) return line(group.entries[0]!);
  const done = group.entries.filter((entry) => entry.state === "done");
  const count = `${done.length} episode${done.length === 1 ? "" : "s"}`;
  const coming = group.entries.length - done.length;
  return `${count}${coming ? ` · ${coming} on the way` : ""}`;
}

function DownloadCard({
  entry,
  title,
  detail,
  progress,
  autoFocus,
  onPress,
}: {
  entry: Saved;
  title: string;
  detail: string;
  progress: number | undefined;
  autoFocus: boolean;
  onPress: () => void;
}) {
  const src = useArt(entry);
  return (
    <Card
      shape="poster"
      art={undefined}
      src={src}
      title={title}
      detail={detail}
      onPress={onPress}
      progress={progress}
      autoFocus={autoFocus}
    />
  );
}
