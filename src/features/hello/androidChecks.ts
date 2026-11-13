/// Setup checks that only make sense on the tablet: what the WebView can decode (and whether in
/// hardware), whether HLS plays natively, and the download spike (a real film fetched through the
/// system DownloadManager, then played and seeked from the saved file).
import { authHeader, request, type Connection } from "../../api/client";
import { session } from "../../api/session";
import { deviceId } from "../../api/storage";
import { loadNative } from "../../platform/native-load";

export type RunCheck = (label: string, work: () => Promise<string>) => Promise<void>;

const VIDEO: [string, string][] = [
  ["H.264 High 4.0", 'video/mp4; codecs="avc1.640028"'],
  ["H.264 High 5.1", 'video/mp4; codecs="avc1.640033"'],
  ["HEVC Main 4.0", 'video/mp4; codecs="hvc1.1.6.L120.90"'],
  ["HEVC Main 10", 'video/mp4; codecs="hvc1.2.4.L153.90"'],
  ["VP9", 'video/webm; codecs="vp09.00.40.08"'],
  ["AV1", 'video/mp4; codecs="av01.0.08M.08"'],
];
const AUDIO: [string, string][] = [
  ["AAC", 'audio/mp4; codecs="mp4a.40.2"'],
  ["MP3", "audio/mpeg"],
  ["Opus", 'audio/webm; codecs="opus"'],
  ["FLAC", 'audio/mp4; codecs="flac"'],
  ["AC-3", 'audio/mp4; codecs="ac-3"'],
  ["E-AC-3", 'audio/mp4; codecs="ec-3"'],
];

async function decoding(type: string): Promise<string> {
  const plays = document.createElement("video").canPlayType(type) || "no";
  const mse = typeof MediaSource === "undefined" ? "no MSE" : MediaSource.isTypeSupported(type) ? "MSE yes" : "MSE no";
  let hardware = "";
  try {
    const info = await navigator.mediaCapabilities.decodingInfo({
      type: "file",
      video: { contentType: type, width: 1920, height: 1080, bitrate: 8_000_000, framerate: 30 },
    });
    hardware = info.supported ? ` · ${info.smooth ? "smooth" : "not smooth"} · ${info.powerEfficient ? "hardware" : "software"}` : " · unsupported";
  } catch {
    hardware = "";
  }
  return `${plays} · ${mse}${hardware}`;
}

async function audioSupport(type: string): Promise<string> {
  const plays = document.createElement("audio").canPlayType(type) || "no";
  return `${plays}${typeof MediaSource !== "undefined" && MediaSource.isTypeSupported(type) ? " · MSE yes" : ""}`;
}

export async function androidChecks(run: RunCheck): Promise<void> {
  await run("Shell", async () => {
    const native = await loadNative();
    if (!native) return "Not the tablet build";
    const info = await native.Downloads.info();
    return `Android API ${info.sdk} · WebView ${info.webView}`;
  });
  await run("Memory", async () => {
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    return `${memory ?? "?"} GB reported · ${navigator.hardwareConcurrency} cores`;
  });
  await run("Storage", async () => {
    const native = await loadNative();
    const info = await native?.Downloads.info();
    if (!info) return "n/a";
    const gb = (n: number) => `${(n / 1e9).toFixed(1)} GB`;
    return `${gb(info.freeBytes)} free of ${gb(info.totalBytes)} · ${info.directory}`;
  });
  for (const [label, type] of VIDEO) await run(label, () => decoding(type));
  for (const [label, type] of AUDIO) await run(label, () => audioSupport(type));
  await run("MKV / WebM", async () => {
    const video = document.createElement("video");
    return `mkv ${video.canPlayType("video/x-matroska") || "no"} · webm ${video.canPlayType("video/webm") || "no"}`;
  });
  await run("HLS", async () => {
    const native = document.createElement("video").canPlayType("application/vnd.apple.mpegurl") || "no";
    return `native ${native} · hls.js can run: ${typeof MediaSource !== "undefined" ? "yes (MSE)" : "no"}`;
  });
}

const TEST_NAME = "wavelane-spike.bin";

function once(target: EventTarget, event: string, ms: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no "${event}" in ${ms / 1000} s`)), ms);
    target.addEventListener(
      event,
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    target.addEventListener("error", () => {
      clearTimeout(timer);
      reject(new Error("the player reported an error"));
    }, { once: true });
  });
}

/// Downloads the smallest film file on the server through DownloadManager, then plays and seeks it
/// from the saved file. Each step is its own line so a failure shows where. A full-size film can
/// take several minutes on Wi-Fi; progress shows live and the file is deleted at the end.
export async function downloadTest(run: RunCheck, live: (text: string) => void = () => undefined): Promise<void> {
  const current = session.value;
  if (!current) return run("Download test", async () => "Sign in first");
  const native = await loadNative();
  if (!native) return run("Download test", async () => "Not the tablet build");
  const { Downloads, localFileUrl } = native;
  const connection: Connection = { server: current.server, token: current.token, deviceId: deviceId() };

  let id = "";
  let size = 0;
  live("Looking for a small film on the server…");
  await run("1 Pick a small film", async () => {
    const reply = await request<{ Items?: { Id?: string; MediaSources?: { Size?: number }[] }[] }>(connection, "/Items", {
      query: {
        userId: current.userId,
        IncludeItemTypes: "Movie",
        Recursive: "true",
        SortBy: "Runtime",
        SortOrder: "Ascending",
        Limit: "400",
        Fields: "MediaSources",
      },
      timeoutMs: 30000,
    });
    // The smallest file in the library (at least 20 MB, so not a stub). Short films are not always
    // small files, so every size is looked at, not just the first few.
    const sizes: { id: string; bytes: number }[] = [];
    for (const entry of reply.Items ?? []) {
      const bytes = entry.MediaSources?.[0]?.Size ?? 0;
      if (entry.Id && /^[0-9a-f]{32}$/i.test(entry.Id) && bytes >= 20e6) sizes.push({ id: entry.Id, bytes });
    }
    sizes.sort((x, y) => x.bytes - y.bytes);
    const smallest = sizes[0];
    if (!smallest) throw new Error(`no film file of 20 MB or more among ${reply.Items?.length ?? 0} checked`);
    const free = (await Downloads.info()).freeBytes;
    if (smallest.bytes * 1.2 > free) {
      throw new Error(`smallest film is ${(smallest.bytes / 1e9).toFixed(1)} GB but only ${(free / 1e9).toFixed(1)} GB is free`);
    }
    id = smallest.id;
    size = smallest.bytes;
    const gb = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${(n / 1e6).toFixed(0)} MB`);
    return `using ${gb(smallest.bytes)}, the smallest of ${sizes.length} films (next: ${sizes.slice(1, 4).map((entry) => gb(entry.bytes)).join(", ") || "none"})`;
  });
  if (!id) return;

  let handle = -1;
  let directory = "";
  let saved = false;
  await run("2 Download (system DownloadManager)", async () => {
    directory = (await Downloads.info()).directory;
    const started = Date.now();
    handle = (
      await Downloads.enqueue({
        url: `${current.server}/Items/${id}/Download`,
        authorization: authHeader(connection.deviceId, connection.token),
        name: TEST_NAME,
      })
    ).id;
    const allowed = Math.min(1200, Math.max(180, Math.round(size / 1e6)));
    for (let tick = 0; tick < allowed; tick++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const status = await Downloads.status({ id: handle });
      live(`Downloading: ${(status.bytes / 1e6).toFixed(0)} of ${(size / 1e6).toFixed(0)} MB (${status.state}, ${tick + 1} s)`);
      if (status.state === "successful") {
        saved = true;
        const seconds = (Date.now() - started) / 1000;
        return `done in ${seconds.toFixed(0)} s · ${(status.bytes / 1e6).toFixed(0)} MB · ${(status.bytes / 1e6 / seconds).toFixed(1)} MB/s`;
      }
      if (status.state === "failed") throw new Error(`failed, reason code ${status.reason} (see DownloadManager.ERROR_*)`);
      if (tick === 20 && status.bytes === 0) throw new Error(`no data after 20 s, state ${status.state}, reason ${status.reason}`);
    }
    throw new Error(`not finished after ${allowed} s (expected ${(size / 1e6).toFixed(0)} MB)`);
  });

  if (saved) {
    live("Playing the saved file…");
    await run("3 Play and seek the saved file", async () => {
      const video = document.createElement("video");
      video.muted = true;
      video.preload = "metadata";
      video.src = localFileUrl(`${directory}/${TEST_NAME}`);
      try {
        await once(video, "loadedmetadata", 15000);
        const duration = video.duration;
        video.currentTime = duration / 2;
        await once(video, "seeked", 10000);
        const middle = video.currentTime;
        await video.play();
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const moved = video.currentTime - middle;
        return `${video.videoWidth}×${video.videoHeight}, ${Math.round(duration)} s · seek to ${Math.round(middle)} s OK · played ${moved.toFixed(1)} s in 2 s`;
      } finally {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
    });
  }
  if (handle >= 0) {
    await run("4 Delete the test file", async () => {
      await Downloads.remove({ id: handle });
      return "removed";
    });
  }
}
