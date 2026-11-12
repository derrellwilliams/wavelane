/// Playback settings kept in app storage: the highest quality the TV asks the server for, and
/// whether the next episode starts by itself.
import { load, save } from "../api/storage";
import { DEFAULT_MAX_BITRATE } from "./profile";

export interface Quality {
  id: string;
  label: string;
  /// Bits per second; the server transcodes anything above this.
  bitrate: number;
}

export const QUALITIES: Quality[] = [
  { id: "auto", label: "Auto (original quality)", bitrate: DEFAULT_MAX_BITRATE },
  { id: "40", label: "40 Mbps", bitrate: 40_000_000 },
  { id: "20", label: "20 Mbps", bitrate: 20_000_000 },
  { id: "10", label: "10 Mbps", bitrate: 10_000_000 },
  { id: "4", label: "4 Mbps", bitrate: 4_000_000 },
];

export function readQuality(raw: string | null = load("quality")): Quality {
  return QUALITIES.find((quality) => quality.id === raw) ?? QUALITIES[0]!;
}
export const saveQuality = (id: string) => save("quality", id);

export const autoplayOn = (raw: string | null = load("autoplayNext")) => raw !== "off";
export const saveAutoplay = (on: boolean) => save("autoplayNext", on ? "on" : "off");
