/// Tablet-only: the bridge to the Android shell (Capacitor). Loaded through `import()` behind
/// `isAndroid`, so none of it is in the webOS bundle.
import { App } from "@capacitor/app";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { handleBack } from "../nav/focus";

/// Wavelane's own Java plugin (android/.../WavelaneDownloads.java): Android's DownloadManager
/// for saving films to the tablet, and the numbers the setup check shows.
export interface DownloadsPlugin {
  info(): Promise<{ directory: string; freeBytes: number; totalBytes: number; webView: string; sdk: number }>;
  enqueue(options: { url: string; authorization: string; name: string }): Promise<{ id: number }>;
  status(options: { id: number }): Promise<{ state: string; bytes: number; total: number; reason: number }>;
  remove(options: { id: number }): Promise<void>;
  keepAwake(options: { on: boolean }): Promise<void>;
  /// Makes Wavelane the home screen when it is the device owner; says whether it is.
  claimHome(): Promise<{ owner: boolean }>;
  releaseHome(): Promise<{ owner: boolean }>;
  /// One GET to letterboxd.com (the plugin only talks to that host).
  letterboxd(options: { path: string }): Promise<{ status: number; path: string; body: string }>;
}

export const Downloads = registerPlugin<DownloadsPlugin>("WavelaneDownloads");

/// Address the WebView can load a saved file from (it supports seeking, which video needs).
export function localFileUrl(absolutePath: string): string {
  return Capacitor.convertFileSrc("file://" + absolutePath);
}

/// Whether Wavelane is the tablet's device owner (so Home opens it). Quietly false on any error.
export async function homeOwned(): Promise<boolean> {
  try {
    return (await Downloads.claimHome()).owner;
  } catch {
    return false;
  }
}

export function startNative(): void {
  void homeOwned();
  void App.addListener("backButton", () => {
    // Back at the first screen leaves the app, like any Android app.
    if (!handleBack()) void App.minimizeApp();
  });
}
