import { useEffect, useState } from "preact/hooks";
import type { RefObject } from "preact";
import { activeCues, type Cue, type Run } from "../../subtitles/cues";
import type { SubStyle } from "../../subtitles/style";

/// The cues showing right now, read off the video every frame (a text update only when the set
/// changes), so a subtitle appears and goes within a frame of its time rather than a timeupdate
/// (up to 250 ms) late. `offset` is the sync setting: positive shows subtitles later.
export function useActiveLines(video: RefObject<HTMLVideoElement | null>, cues: readonly Cue[], offset: number): Run[][] {
  const [active, setActive] = useState<Cue[]>([]);
  useEffect(() => {
    if (!cues.length) {
      setActive([]);
      return;
    }
    let frame = 0;
    let key = "";
    const tick = () => {
      const element = video.current;
      if (element) {
        const found = activeCues(cues, element.currentTime - offset);
        const next = found.map((cue) => cue.index).join(",");
        if (next !== key) {
          key = next;
          setActive(found);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [cues, offset]);
  return active.flatMap((cue) => cue.lines);
}

/// Subtitle lines, drawn as text nodes only (the cue text is untrusted: no markup is ever built
/// from it).
export function SubtitleView({ lines, style, lifted }: { lines: Run[][]; style: SubStyle; lifted?: boolean }) {
  if (!lines.length) return null;
  return (
    <div
      class={lifted ? "sub is-lifted" : "sub"}
      data-size={style.size}
      data-color={style.color}
      data-background={style.background}
      data-edge={style.edge}
      data-position={style.position}
      data-brightness={style.brightness}
    >
      <div class="sub-box">
        {lines.map((line, n) => (
          <p key={n} class="sub-line">
            {line.map((run, m) => (
              <span key={m} class={`${run.i ? "is-i " : ""}${run.b ? "is-b " : ""}${run.u ? "is-u" : ""}`.trim() || undefined}>
                {run.text}
              </span>
            ))}
          </p>
        ))}
      </div>
    </div>
  );
}
