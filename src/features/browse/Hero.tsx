import type { ComponentChildren } from "preact";
import { artSrc, facts, type Item } from "../../api/items";
import { token } from "../../design/tokens";

interface Props {
  item: Item;
  /// The detail page shows genres and a longer description.
  full?: boolean;
  /// A line above the title ("Continue watching", a show's name).
  kicker?: string;
  /// One more line under the facts (what Letterboxd says about it).
  notes?: (string | null)[];
  children?: ComponentChildren;
}

/// Backdrop, logo (or the title in type), facts, description and a row of buttons: Home's
/// spotlight and the head of every detail page.
export function Hero({ item, full, kicker, notes, children }: Props) {
  const backdrop = artSrc(item.backdrop, 1920, 1080, false);
  const logo = artSrc(item.logo, token("--logo-w"), token("--logo-h"), false);
  const line = facts(item);
  // An episode is headed by its show (whose logo this is), with its own name on the next line.
  const heading = item.type === "Episode" ? (item.seriesName ?? item.name) : item.name;

  return (
    <header class="hero" data-scroll-anchor>
      {backdrop && (
        <img
          key={backdrop}
          class="art hero-art"
          src={backdrop}
          alt=""
          decoding="async"
          onLoad={(event) => event.currentTarget.classList.add("is-loaded")}
        />
      )}
      <div class="hero-shade" />
      <div class="hero-body">
        {kicker && <p class="secondary">{kicker}</p>}
        {logo ? <img key={logo} class="hero-logo" src={logo} alt={heading} /> : <h1 class="display">{heading}</h1>}
        {heading !== item.name && <p class="section">{item.name}</p>}
        {line.length > 0 && <p class="mono secondary">{line.join("  ·  ")}</p>}
        {notes?.map((note) => note && <p key={note} class="mono secondary">{note}</p>)}
        {full && item.genres.length > 0 && <p class="secondary">{item.genres.slice(0, 4).join(", ")}</p>}
        {item.overview && <p class={full ? "hero-overview" : "hero-overview is-short"}>{item.overview}</p>}
        {children && (
          <div class="row hero-actions" data-focus-group>
            {children}
          </div>
        )}
      </div>
    </header>
  );
}
