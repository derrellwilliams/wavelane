import { loadNative } from "./native-load";

/// Keeps the tablet's screen from sleeping while a film plays. The TV has its own screen saver
/// rules for video, so there it does nothing.
export function keepAwake(on: boolean): void {
  void loadNative()
    .then((native) => native?.Downloads.keepAwake({ on }))
    .catch(() => undefined);
}
