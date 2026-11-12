import { artSrc, cardText, type Art, type Item } from "../../api/items";
import { Icon } from "../../design/components/Icon";
import { token } from "../../design/tokens";

export type Shape = "poster" | "thumb" | "person";

interface Props {
  shape: Shape;
  art: Art | undefined;
  title: string;
  detail: string;
  onPress: () => void;
  progress?: number;
  played?: boolean;
  autoFocus?: boolean;
  /// Position in a grid, so the grid can tell which row has focus.
  index?: number;
}

/// Artwork with a title under it: the thing every shelf and grid is made of. Focus frames the
/// artwork in tan and lifts it slightly. Until the image arrives (or if there is none) the title
/// shows in its place.
export function Card({ shape, art, title, detail, onPress, progress, played, autoFocus, index }: Props) {
  const src = artSrc(art, token(`--${shape}-w`), token(`--${shape}-h`));
  return (
    <button
      class={`card card-${shape}`}
      type="button"
      data-focusable
      data-autofocus={autoFocus || undefined}
      data-index={index}
      tabIndex={-1}
      onClick={onPress}
    >
      <span class="card-art">
        <span class="card-missing">{title}</span>
        {src && (
          <img
            class="art"
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={(event) => event.currentTarget.classList.add("is-loaded")}
          />
        )}
        {played && (
          <span class="card-badge">
            <Icon name="check" />
          </span>
        )}
        {progress !== undefined && (
          <span class="card-progress">
            <span style={{ transform: `scaleX(${progress})` }} />
          </span>
        )}
      </span>
      <span class="card-text">
        <span class="card-title">{title}</span>
        <span class="card-detail">{detail}</span>
      </span>
    </button>
  );
}

interface ItemProps {
  item: Item;
  shape: "poster" | "thumb";
  onOpen: (item: Item) => void;
  autoFocus?: boolean;
  index?: number;
  /// Episode lists inside a show: lead with the episode, not the show's name.
  ownTitle?: boolean;
}

export function ItemCard({ item, shape, onOpen, autoFocus, index, ownTitle }: ItemProps) {
  const text = ownTitle
    ? { title: item.name, detail: item.episode !== undefined ? `Episode ${item.episode}` : "" }
    : cardText(item);
  return (
    <Card
      shape={shape}
      art={shape === "poster" ? item.poster : (item.thumb ?? item.backdrop)}
      title={text.title}
      detail={text.detail}
      onPress={() => onOpen(item)}
      progress={item.progress}
      played={item.played}
      autoFocus={autoFocus}
      index={index}
    />
  );
}
