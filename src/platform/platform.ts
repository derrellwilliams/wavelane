/// Which device this build is for. Set at build time (`vite build --mode android` is the tablet,
/// everything else is the TV), so the other platform's code is dropped from each bundle.
/// This is the one switch: screens never ask "which device"; they ask for what the switch decides
/// (input mode, device profile, layout tokens, Letterboxd transport).

export type Platform = "webos" | "android";

declare const __PLATFORM__: Platform | undefined;

export const PLATFORM: Platform = typeof __PLATFORM__ === "undefined" ? "webos" : __PLATFORM__;
export const isAndroid = PLATFORM === "android";

export interface InputMode {
  /// The d-pad focus engine and remote-driven scrolling are running.
  dpad: boolean;
  /// Fingers: native scrolling, tap, long press, swipe.
  touch: boolean;
}

export function inputFor(platform: Platform): InputMode {
  return platform === "android" ? { dpad: false, touch: true } : { dpad: true, touch: false };
}

export const input = inputFor(PLATFORM);
