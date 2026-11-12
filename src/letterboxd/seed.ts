/// An export baked into this build (see `npm run seed`), used for the owner's own TV so no upload
/// is needed. The data file is git-ignored; without it this does nothing. It loads once per
/// different export, so choosing "Forget Letterboxd data" stays forgotten until a newer one is built in.
import { load, save } from "../api/storage";
import { buildLog, type Files } from "./log";
import { setWatchLog } from "./store";

const modules = import.meta.glob<{ seed: Files }>("./seed.local.ts", { eager: true });
const FLAG = "letterboxd.seeded";

export function applySeed(): void {
  const seed = Object.values(modules)[0]?.seed;
  if (!seed) return;
  const stamp = `${seed.watched?.length}:${seed.ratings?.length}:${seed.diary?.length}:${seed.watchlist?.length}`;
  if (load(FLAG) === stamp) return;
  const films = buildLog(seed);
  if (films.length) setWatchLog(films);
  save(FLAG, stamp);
}
