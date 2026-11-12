import { useEffect, useRef, useState } from "preact/hooks";
import type { Item } from "../../api/items";
import { token } from "../../design/tokens";
import { ItemCard } from "./Card";
import { visibleRows, withFocus, type Rows } from "./rows";

const SPARE_ROWS = 2;

/// The poster grid for a whole library. Only the rows near the screen exist (see rows.ts); the
/// grid keeps its full height so scrolling behaves as if they all did.
export function Grid({ items, onOpen, autoFocus = true }: { items: Item[]; onOpen: (item: Item) => void; autoFocus?: boolean }) {
  const grid = useRef<HTMLDivElement>(null);
  const columns = Math.max(1, Math.round(token("--grid-columns")));
  const pitch = token("--poster-h") + token("--card-art-gap") + token("--card-caption") + token("--card-gap");
  const count = Math.ceil(items.length / columns);
  const [seen, setSeen] = useState<Rows>({ first: 0, last: SPARE_ROWS + 2 });
  const [focusRow, setFocusRow] = useState(0);

  useEffect(() => {
    const element = grid.current;
    const page = element?.closest<HTMLElement>('[data-scroll="y"]');
    if (!element || !page) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const top = page.getBoundingClientRect().top - element.getBoundingClientRect().top;
      const next = visibleRows(top, page.clientHeight, pitch, count, SPARE_ROWS);
      setSeen((now) => (now.first === next.first && now.last === next.last ? now : next));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    page.addEventListener("scroll", onScroll, { passive: true });
    measure();
    return () => {
      page.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [count, pitch]);

  const rows = withFocus({ first: Math.min(seen.first, Math.max(0, count - 1)), last: Math.min(seen.last, count - 1) }, focusRow, count, SPARE_ROWS);
  const start = rows.first * columns;

  return (
    <div
      ref={grid}
      class="grid"
      data-focus-group
      style={{ height: `${count * pitch}px`, paddingTop: `${rows.first * pitch}px` }}
      onFocusIn={(event) => {
        const card = (event.target as Element).closest<HTMLElement>("[data-index]");
        if (card) setFocusRow(Math.floor(Number(card.dataset.index) / columns));
      }}
    >
      {items.slice(start, (rows.last + 1) * columns).map((item, offset) => (
        <ItemCard key={item.id} item={item} shape="poster" onOpen={onOpen} index={start + offset} autoFocus={autoFocus && start + offset === 0} />
      ))}
    </div>
  );
}
