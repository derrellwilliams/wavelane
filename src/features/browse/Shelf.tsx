import type { ComponentChildren } from "preact";
import type { Item } from "../../api/items";
import { ItemCard } from "./Card";

/// A titled row that scrolls sideways as focus moves along it. Focus stays in the row for Left and
/// Right; Up and Down go to whatever is above or below.
export function Shelf({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <section class="shelf" data-scroll-anchor>
      <h2 class="section shelf-title">{title}</h2>
      <div class="shelf-row" data-scroll="x" data-focus-group>
        {children}
      </div>
    </section>
  );
}

interface Props {
  title: string;
  items: Item[] | undefined;
  shape: "poster" | "thumb";
  onOpen: (item: Item) => void;
  ownTitle?: boolean;
}

/// A shelf of items. Draws nothing while it has nothing to show, so empty shelves don't appear.
export function ItemShelf({ title, items, shape, onOpen, ownTitle }: Props) {
  if (!items?.length) return null;
  return (
    <Shelf title={title}>
      {items.map((item) => (
        <ItemCard key={item.id} item={item} shape={shape} onOpen={onOpen} ownTitle={ownTitle} />
      ))}
    </Shelf>
  );
}
