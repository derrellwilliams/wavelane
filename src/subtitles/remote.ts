/// Finding and downloading subtitles through the server's subtitle plugin (OpenSubtitles or
/// similar). The server does the work; this checks what comes back and turns failures into
/// something a person can act on.
import { connectionOf, type Session } from "../api/auth";
import { ApiError, request } from "../api/client";

export interface Language {
  code: string; // ISO 639-2, as the server wants it
  label: string;
}

export const LANGUAGES: Language[] = [
  { code: "eng", label: "English" },
  { code: "spa", label: "Spanish" },
  { code: "fre", label: "French" },
  { code: "ger", label: "German" },
  { code: "ita", label: "Italian" },
  { code: "por", label: "Portuguese" },
  { code: "dut", label: "Dutch" },
  { code: "swe", label: "Swedish" },
  { code: "pol", label: "Polish" },
  { code: "rus", label: "Russian" },
  { code: "jpn", label: "Japanese" },
  { code: "kor", label: "Korean" },
  { code: "chi", label: "Chinese" },
  { code: "ara", label: "Arabic" },
  { code: "hin", label: "Hindi" },
];

export interface Found {
  id: string;
  name: string;
  format: string;
  downloads: number;
  rating?: number;
  hashMatch: boolean;
  sdh: boolean;
  forced: boolean;
  machine: boolean;
}

const text = (value: unknown, max: number): string => (typeof value === "string" ? value.trim().slice(0, max) : "");

/// Search results, checked and best first: exact file matches, then rating and downloads.
export function toFound(reply: unknown): Found[] {
  if (!Array.isArray(reply)) return [];
  const found: Found[] = [];
  for (const raw of reply.slice(0, 100) as (Record<string, unknown> | null)[]) {
    const id = text(raw?.Id, 200);
    if (!raw || !id || !/^[\w.:~+=%-]+$/.test(id)) continue;
    const rating = raw.CommunityRating;
    const downloads = raw.DownloadCount;
    found.push({
      id,
      name: text(raw.Name, 120) || "Subtitles",
      format: text(raw.Format, 10).toLowerCase(),
      downloads: typeof downloads === "number" && downloads >= 0 && downloads < 1e12 ? Math.round(downloads) : 0,
      rating: typeof rating === "number" && rating >= 0 && rating <= 10 ? rating : undefined,
      hashMatch: raw.IsHashMatch === true,
      sdh: raw.HearingImpaired === true,
      forced: raw.Forced === true,
      machine: raw.AiTranslated === true || raw.MachineTranslated === true,
    });
  }
  return found
    .sort((a, b) => Number(b.hashMatch) - Number(a.hashMatch) || Number(a.machine) - Number(b.machine) || (b.rating ?? 0) - (a.rating ?? 0) || b.downloads - a.downloads)
    .slice(0, 40);
}

export class SubtitleSearchError extends Error {}

/// What to tell the user when a subtitle call fails.
export function explain(error: unknown): string {
  const status = error instanceof ApiError ? error.status : -1;
  if (status === 0) return "The server didn't answer. Check that it is on and the TV is connected.";
  if (status === 401 || status === 403) return "This account isn't allowed to download subtitles. Ask the server's admin to allow it.";
  return "Subtitle search isn't set up on the server. It needs a subtitle plugin such as OpenSubtitles.";
}

export async function search(session: Session, itemId: string, language: string): Promise<Found[]> {
  if (!/^[a-z]{3}$/.test(language)) throw new SubtitleSearchError("bad language");
  const reply = await request<unknown>(connectionOf(session), `/Items/${itemId}/RemoteSearch/Subtitles/${language}`, {
    query: { isPerfectMatch: "false" },
    timeoutMs: 30000,
  });
  return toFound(reply);
}

/// Asks the server to fetch one result and add it to the film's tracks.
export async function download(session: Session, itemId: string, subtitleId: string): Promise<void> {
  await request<unknown>(connectionOf(session), `/Items/${itemId}/RemoteSearch/Subtitles/${encodeURIComponent(subtitleId)}`, {
    method: "POST",
    timeoutMs: 60000,
  });
}

/// "★ 8.1 · 12k downloads · srt" for a result row.
export function describe(found: Found): string {
  const parts: string[] = [];
  if (found.hashMatch) parts.push("Exact match");
  if (found.rating) parts.push(found.rating.toFixed(1));
  if (found.downloads) parts.push(found.downloads >= 1000 ? `${Math.round(found.downloads / 1000)}k downloads` : `${found.downloads} downloads`);
  if (found.sdh) parts.push("SDH");
  if (found.forced) parts.push("Forced");
  if (found.machine) parts.push("Machine translated");
  if (found.format) parts.push(found.format);
  return parts.join(" · ");
}
