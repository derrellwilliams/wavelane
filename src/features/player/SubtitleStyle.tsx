import { useEffect, useRef } from "preact/hooks";
import { Button } from "../../design/components/Button";
import { onEdge, pushScope } from "../../nav/focus";
import { useBack } from "../../nav/hooks";
import { cycle, DEFAULT_STYLE, labelFor, LABELS, OPTIONS, setStyle, subtitleStyle, type StyleKey } from "../../subtitles/style";
import { toLines } from "../../subtitles/cues";
import { SubtitleView } from "./SubtitleView";

const SAMPLE = toLines("The quick brown fox<br><i>jumps over the lazy dog.</i>");

/// Subtitle appearance with a live preview. Each button moves one choice to the next option.
/// Used from the player (over the film) and from Account.
export function SubtitleStyle({ onClose }: { onClose: () => void }) {
  const page = useRef<HTMLDivElement>(null);
  const style = subtitleStyle.value;
  useBack(onClose);
  useEffect(() => (page.current ? pushScope(page.current) : undefined), []);
  useEffect(() => onEdge(() => true), []);

  return (
    <div ref={page} class="sub-editor">
      <h1 class="display">Subtitle appearance</h1>
      <div class="sub-stage">
        <div class="sub-stage-inner">
          <SubtitleView lines={SAMPLE} style={style} />
        </div>
      </div>
      <div class="sub-options" data-focus-group>
        {(Object.keys(OPTIONS) as StyleKey[]).map((key, n) => (
          <Button key={key} autoFocus={n === 0} onPress={() => setStyle(cycle(subtitleStyle.value, key))}>
            {LABELS[key]}
            <span class="secondary">{labelFor(style, key)}</span>
          </Button>
        ))}
      </div>
      <div class="row" data-focus-group>
        <Button icon="arrow-counter-clockwise" onPress={() => setStyle(DEFAULT_STYLE)}>
          Reset
        </Button>
        <Button icon="check" onPress={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}
