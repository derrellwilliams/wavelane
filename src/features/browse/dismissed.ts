/// Items just removed from Continue Watching, hidden at once while the server catches up. Playing
/// one again brings it back (see `play` in the route).
import { signal } from "@preact/signals";
import type { Item } from "../../api/items";

export const dismissed = signal<ReadonlySet<string>>(new Set());

export function dismiss(id: string): void {
  dismissed.value = new Set(dismissed.value).add(id);
}

export function undismiss(id: string): void {
  if (!dismissed.value.has(id)) return;
  const next = new Set(dismissed.value);
  next.delete(id);
  dismissed.value = next;
}

export function withoutDismissed(items: Item[] | undefined): Item[] | undefined {
  const hidden = dismissed.value;
  return items && hidden.size ? items.filter((item) => !hidden.has(item.id)) : items;
}
