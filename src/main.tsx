import { render } from "preact";
import "./design/base.css";
import "./design/components/components.css";
import { App } from "./App";
import "./design/touch.css";
import { handleBack, startFocusEngine } from "./nav/focus";
import { startTouch } from "./nav/touch";
import { startScrolling } from "./nav/scroll";
import { PLATFORM, input, isAndroid } from "./platform/platform";

// Layout tokens and the focus ring follow this attribute (see tokens.css).
document.documentElement.dataset.platform = PLATFORM;

// The d-pad engine only runs where there is a remote. Back (onBack / useBack) is shared: the TV
// reaches it through the remote's Back key, the tablet through the native back button.
if (input.dpad) {
  startFocusEngine();
  startScrolling();
}
if (input.touch) startTouch(() => void handleBack());
if (isAndroid) void import("./platform/native").then((native) => native.startNative());

render(<App />, document.getElementById("app")!);
