import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { onEdge, pushScope } from "../../nav/focus";
import { useBack } from "../../nav/hooks";

interface Props {
  title: string;
  children: ComponentChildren;
  onClose: () => void;
  /// What Back does when it isn't "close" (a step back inside the drawer).
  onBack?: () => void;
}

/// A sheet from the right edge that holds focus while it is open. Clicking outside or Back closes it.
export function Drawer({ title, children, onClose, onBack }: Props) {
  const panel = useRef<HTMLDivElement>(null);
  useBack(onBack ?? onClose);
  useEffect(() => (panel.current ? pushScope(panel.current) : undefined), []);
  // An arrow press with nowhere to go stays put, rather than reaching the screen underneath.
  useEffect(() => onEdge(() => true), []);

  return (
    <div class="drawer-scrim" onClick={onClose}>
      <div ref={panel} class="drawer" onClick={(event) => event.stopPropagation()}>
        <h2 class="section drawer-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
