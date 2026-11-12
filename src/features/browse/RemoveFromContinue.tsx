import { useState } from "preact/hooks";
import type { Item } from "../../api/items";
import { clearProgress } from "../../api/library";
import { session } from "../../api/session";
import { Menu } from "../../design/components/Menu";
import { refreshAll } from "../../data/resource";
import { dismiss, undismiss } from "./dismissed";

async function remove(item: Item): Promise<void> {
  const current = session.value;
  if (!current) return;
  dismiss(item.id);
  try {
    await clearProgress(current, item.id);
    refreshAll();
  } catch {
    undismiss(item.id);
  }
}

/// Long-press on something in Continue Watching: `ask(item)` opens a drawer to confirm. Render
/// `menu` outside any scrolling container. Removing forgets where you were, not that you watched it.
export function useRemoveFromContinue() {
  const [asking, setAsking] = useState<Item | null>(null);
  const menu = asking && (
    <Menu
      title="Continue Watching"
      options={[
        { id: "remove", label: `Remove ${asking.seriesName ?? asking.name}` },
        { id: "keep", label: "Keep it" },
      ]}
      value="keep"
      onPick={(id) => {
        if (id === "remove") void remove(asking);
      }}
      onClose={() => setAsking(null)}
    />
  );
  return { ask: setAsking, menu };
}
