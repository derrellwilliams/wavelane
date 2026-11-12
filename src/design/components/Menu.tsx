import { useEffect, useRef } from "preact/hooks";
import { onEdge, pushScope } from "../../nav/focus";
import { useBack } from "../../nav/hooks";
import { Icon } from "./Icon";

export interface Option {
  id: string;
  label: string;
}

interface Props {
  title: string;
  options: Option[];
  value: string;
  onPick: (id: string) => void;
  onClose: () => void;
}

/// A drawer with one list to choose from (sort order, genre). Focus is held inside it while it is
/// open; OK picks and closes, Back closes.
export function Menu({ title, options, value, onPick, onClose }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  useBack(onClose);
  useEffect(() => (panel.current ? pushScope(panel.current) : undefined), []);
  // An arrow press with nowhere to go stays put, rather than reaching the screen underneath.
  useEffect(() => onEdge(() => true), []);

  return (
    <div class="drawer-scrim" onClick={onClose}>
      <div ref={panel} class="drawer" onClick={(event) => event.stopPropagation()}>
        <h2 class="section drawer-title">{title}</h2>
        <div class="drawer-list" data-scroll="y" data-focus-group>
          {options.map((option) => (
            <button
              key={option.id}
              class="button drawer-option"
              type="button"
              data-focusable
              data-autofocus={option.id === value || undefined}
              tabIndex={-1}
              onClick={() => {
                onPick(option.id);
                onClose();
              }}
            >
              <span class="drawer-label">{option.label}</span>
              {option.id === value && <Icon name="check" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
