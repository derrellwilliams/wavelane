import { Icon } from "../../design/components/Icon";
import { canGoBack, handleBack } from "../../nav/focus";
import { input } from "../../platform/platform";
import { playing } from "./route";

/// The tablet's visible Back: a floating arrow whenever Back has somewhere to go (a detail page,
/// a drawer, the setup check). The Android back button and the edge swipe do the same thing. The
/// TV has the remote's Back key, and the player draws its own controls.
export function BackButton() {
  if (input.dpad || !canGoBack.value || playing.value) return null;
  return (
    <button class="back-button" type="button" aria-label="Back" onClick={() => void handleBack()}>
      <Icon name="arrow-left" />
    </button>
  );
}
