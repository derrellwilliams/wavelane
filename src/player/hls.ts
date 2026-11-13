/// HLS for the tablet. The server's converted streams are HLS; the WebView may or may not play
/// that itself, and hls.js (an MSE player) is the way when it doesn't, or when the native
/// player fails. The TV never reaches this: its bundle drops the call (see `isAndroid`).
import type Hls from "hls.js";

/// The WebView plays HLS addresses by itself.
export function nativeHls(): boolean {
  return document.createElement("video").canPlayType("application/vnd.apple.mpegurl") !== "";
}

/// Whether hls.js can run here (needs Media Source Extensions).
export async function hlsSupported(): Promise<boolean> {
  const { default: Library } = await import("hls.js");
  return Library.isSupported();
}

/// Plays `url` in `video` through hls.js. Calls `onFatal` once if the stream can't be recovered.
/// Returns what to call to let go of the video element.
export async function attachHls(video: HTMLVideoElement, url: string, startSeconds: number, onFatal: () => void): Promise<() => void> {
  const { default: Library } = await import("hls.js");
  if (!Library.isSupported()) {
    onFatal();
    return () => undefined;
  }
  const hls: Hls = new Library({ startPosition: startSeconds > 0 ? startSeconds : -1, lowLatencyMode: false, enableWorker: true });
  let failed = false;
  hls.on(Library.Events.ERROR, (_event, data) => {
    if (!data.fatal) return;
    // One try at each kind of recovery, then give up.
    if (data.type === Library.ErrorTypes.NETWORK_ERROR && !failed) {
      hls.startLoad();
    } else if (data.type === Library.ErrorTypes.MEDIA_ERROR && !failed) {
      hls.recoverMediaError();
    } else {
      onFatal();
      return;
    }
    failed = true;
  });
  hls.attachMedia(video);
  hls.loadSource(url);
  return () => hls.destroy();
}
