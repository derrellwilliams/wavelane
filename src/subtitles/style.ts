/// How subtitles look (size, color, background, edge, position, brightness) and the per-film
/// sync offset. Choices are kept in app storage; anything unexpected there falls back to the
/// default. The look itself is in CSS (player.css) keyed on these values.
import { signal } from "@preact/signals";
import { load, save } from "../api/storage";

export const OPTIONS = {
  size: [
    { id: "s", label: "Small" },
    { id: "m", label: "Medium" },
    { id: "l", label: "Large" },
    { id: "xl", label: "Extra large" },
  ],
  color: [
    { id: "tan", label: "Tan" },
    { id: "white", label: "White" },
  ],
  background: [
    { id: "none", label: "None" },
    { id: "dim", label: "Dim" },
    { id: "solid", label: "Solid" },
  ],
  edge: [
    { id: "outline", label: "Outline" },
    { id: "shadow", label: "Shadow" },
    { id: "none", label: "None" },
  ],
  position: [
    { id: "low", label: "Low" },
    { id: "mid", label: "Higher" },
    { id: "high", label: "Highest" },
  ],
  brightness: [
    { id: "full", label: "Full" },
    { id: "soft", label: "Softer" },
    { id: "dim", label: "Dim" },
  ],
} as const;

export type StyleKey = keyof typeof OPTIONS;
export type SubStyle = { [K in StyleKey]: (typeof OPTIONS)[K][number]["id"] };

export const DEFAULT_STYLE: SubStyle = { size: "l", color: "tan", background: "none", edge: "outline", position: "low", brightness: "full" };

export const LABELS: Record<StyleKey, string> = {
  size: "Size",
  color: "Color",
  background: "Background",
  edge: "Edge",
  position: "Position",
  brightness: "Brightness",
};

export function readStyle(raw: string | null): SubStyle {
  if (!raw) return DEFAULT_STYLE;
  try {
    const saved = JSON.parse(raw) as Record<string, unknown> | null;
    const style = { ...DEFAULT_STYLE } as Record<StyleKey, string>;
    for (const key of Object.keys(OPTIONS) as StyleKey[]) {
      const value = saved?.[key];
      if (OPTIONS[key].some((option) => option.id === value)) style[key] = value as string;
    }
    return style as SubStyle;
  } catch {
    return DEFAULT_STYLE;
  }
}

export const subtitleStyle = signal<SubStyle>(readStyle(load("subtitleStyle")));

export function setStyle(next: SubStyle): void {
  subtitleStyle.value = next;
  save("subtitleStyle", JSON.stringify(next));
}

/// The style with one choice moved on to the next option.
export function cycle(style: SubStyle, key: StyleKey): SubStyle {
  const options = OPTIONS[key] as readonly { id: string }[];
  const at = options.findIndex((option) => option.id === style[key]);
  return { ...style, [key]: options[(at + 1) % options.length]!.id } as SubStyle;
}

export const labelFor = (style: SubStyle, key: StyleKey): string => OPTIONS[key].find((option) => option.id === style[key])?.label ?? "";

const MAX_OFFSET = 300;

/// Seconds, rounded to a tenth and kept within ±5 minutes.
export function clampOffset(seconds: number): number {
  if (!Number.isFinite(seconds)) return 0;
  return Math.round(Math.min(MAX_OFFSET, Math.max(-MAX_OFFSET, seconds)) * 10) / 10;
}

/// The saved sync offset for a film (0 when none). Positive shows subtitles later.
export function readOffset(itemId: string): number {
  return clampOffset(Number(load(`subOffset.${itemId}`)));
}

export function saveOffset(itemId: string, seconds: number): void {
  const value = clampOffset(seconds);
  save(`subOffset.${itemId}`, value === 0 ? null : String(value));
}

export function offsetLabel(seconds: number): string {
  return `${seconds > 0 ? "+" : ""}${seconds.toFixed(1)} s`;
}
