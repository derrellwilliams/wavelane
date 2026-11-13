import { useState } from "preact/hooks";
import type { Item } from "../../api/items";
import { clearProgress, item as fetchItem, setFavorite, setPlayed } from "../../api/library";
import { session } from "../../api/session";
import { Menu, type Option } from "../../design/components/Menu";
import { refreshAll, useResource } from "../../data/resource";
import { dismiss, undismiss } from "./dismissed";

async function removeFromContinue(item: Item, played = false): Promise<void> {
  const current = session.value;
  if (!current) return;
  dismiss(item.id);
  try {
    if (played) await setPlayed(current, item.id, true);
    else await clearProgress(current, item.id);
    refreshAll();
  } catch {
    undismiss(item.id);
  }
}

async function toggleFavorite(id: string, on: boolean): Promise<void> {
  const current = session.value;
  if (!current) return;
  try {
    await setFavorite(current, id, on);
    refreshAll();
  } catch {
    // The card keeps its old state; nothing was changed.
  }
}

/// Hold OK on a card or the spotlight: `ask(item)` opens a drawer to add or remove it from
/// Favorites or mark a movie/episode played. Something in Continue Watching (`ask(item, true)`)
/// can also be removed without marking it watched. An episode's favorite is its
/// show. Render `menu` outside any scrolling container.
export function useItemMenu() {
  const [asking, setAsking] = useState<{ item: Item; continuing: boolean } | null>(null);
  const item = asking?.item;
  // Favorites are kept for the show, so an episode needs its show's own state.
  const seriesId = item?.type === "Episode" ? item.seriesId : undefined;
  const series = useResource(seriesId ? `item:${seriesId}` : null, (current) => fetchItem(current, seriesId!));

  let menu = null;
  if (asking && item) {
    const target = seriesId ? series.data : item;
    const options: Option[] = [];
    if (target) {
      const name = item.seriesName ?? item.name;
      options.push({ id: "favorite", label: target.favorite ? `Remove ${name} from Favorites` : `Add ${name} to Favorites` });
    }
    if (item.type === "Movie" || item.type === "Episode") options.push({ id: "played", label: "Mark as played" });
    if (asking.continuing) options.push({ id: "continue", label: "Remove from Continue Watching" });
    // Wait for the show's own state before opening, so the drawer never opens empty.
    if (options.length)
      menu = (
        <Menu
          title={item.seriesName ?? item.name}
          options={options}
          value=""
          onPick={(id) => {
            if (id === "played") void removeFromContinue(item, true);
            else if (id === "continue") void removeFromContinue(item);
            else if (target) void toggleFavorite(target.id, !target.favorite);
          }}
          onClose={() => setAsking(null)}
        />
      );
  }
  return { ask: (found: Item, continuing = false) => setAsking({ item: found, continuing }), menu };
}
