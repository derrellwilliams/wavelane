import { isAndroid } from "./platform";

/// The Android bridge, or null on the TV. Always go through this: a direct import would put
/// Capacitor into the webOS bundle.
export function loadNative(): Promise<typeof import("./native") | null> {
  return isAndroid ? import("./native") : Promise.resolve(null);
}
