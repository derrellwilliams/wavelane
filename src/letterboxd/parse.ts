/// Reads what Wavetile TV needs out of Letterboxd pages on the tablet (the TV's service has its own
/// copy in `service/parse.js`). Page text is untrusted: every number is range-checked and nothing
/// else is kept.
import type { Entry } from "./feed";

/// Average rating (0.5 to 5) and rating count from a film page's structured data.
export function parseFilmRating(html: string): { rating: number | null; count: number | null } {
  const value = /"ratingValue"\s*:\s*"?([0-9]+(?:\.[0-9]+)?)/.exec(html);
  const count = /"ratingCount"\s*:\s*"?([0-9]+)/.exec(html);
  const rating = value ? Number(value[1]) : NaN;
  if (!(rating >= 0.5 && rating <= 5)) return { rating: null, count: null };
  const total = count ? Number(count[1]) : NaN;
  return { rating: Math.round(rating * 100) / 100, count: total >= 1 && total <= 1e9 ? total : null };
}

/// The films in an RSS feed: TMDB ID, star rating, watched date and rewatch flag. Entries that
/// are not films (lists) have no TMDB ID and are skipped. At most 100.
export function parseFeed(xml: string): Entry[] {
  const out: Entry[] = [];
  const tag = (block: string, name: string) => new RegExp(`<${name}>([^<]*)</${name}>`).exec(block)?.[1] ?? null;
  for (const block of xml.split("<item>").slice(1, 101)) {
    const tmdb = tag(block, "tmdb:movieId");
    if (!tmdb || !/^[0-9]{1,9}$/.test(tmdb)) continue;
    const rating = Number(tag(block, "letterboxd:memberRating"));
    const date = tag(block, "letterboxd:watchedDate");
    out.push({
      tmdb,
      rating: rating >= 0.5 && rating <= 5 ? rating : null,
      date: date && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date) ? date : null,
      rewatch: tag(block, "letterboxd:rewatch") === "Yes",
    });
  }
  return out;
}
