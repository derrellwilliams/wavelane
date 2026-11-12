import type { ComponentChildren } from "preact";
import { Button } from "../../design/components/Button";
import { refreshAll } from "../../data/resource";

/// A short message where a screen's contents would be: nothing found, or nothing loaded.
export function Status({ title, children }: { title: string; children?: ComponentChildren }) {
  return (
    <div class="status">
      <h2 class="section">{title}</h2>
      {children}
    </div>
  );
}

/// The server didn't answer and there is no saved copy to show.
export function Unreachable() {
  return (
    <Status title="Couldn't load this">
      <p class="secondary">The server didn't answer. Check that it is on and the TV is connected.</p>
      <div class="row" data-focus-group>
        <Button icon="arrow-clockwise" onPress={refreshAll} autoFocus>
          Try again
        </Button>
      </div>
    </Status>
  );
}
