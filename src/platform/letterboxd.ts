/// Letterboxd reads that a web page can't make (no CORS headers). On the TV its service makes
/// them; on the tablet Wavelane's own native plugin does, to letterboxd.com only. Both give the
/// same answers, so the average and feed code doesn't know which one ran.
import { parseFeed, parseFilmRating } from "../letterboxd/parse";
import type { Entry } from "../letterboxd/feed";
import { isAndroid } from "./platform";
import { loadNative } from "./native-load";
import { callService } from "./service";

export interface FilmPage {
  status: number;
  rating: number | null;
  count: number | null;
}

export async function film(tmdbId: number): Promise<FilmPage> {
  if (isAndroid) {
    if (!Number.isInteger(tmdbId) || tmdbId <= 0 || tmdbId >= 1e9) throw new Error("Not a TMDB ID");
    const native = await loadNative();
    const page = await native!.Downloads.letterboxd({ path: `/tmdb/${tmdbId}/` });
    return { status: page.status, ...(page.status === 200 ? parseFilmRating(page.body) : { rating: null, count: null }) };
  }
  return callService<FilmPage>("film", { tmdbId }, 20000);
}

export async function feed(user: string): Promise<{ status: number; entries: Entry[] }> {
  if (isAndroid) {
    if (!/^[A-Za-z0-9_]{1,40}$/.test(user)) throw new Error("Not a Letterboxd username");
    const native = await loadNative();
    const page = await native!.Downloads.letterboxd({ path: `/${user}/rss/` });
    return { status: page.status, entries: page.status === 200 ? parseFeed(page.body) : [] };
  }
  return callService<{ status: number; entries: Entry[] }>("feed", { user }, 20000);
}
