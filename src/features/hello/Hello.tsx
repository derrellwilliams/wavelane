import { signal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { Button } from "../../design/components/Button";
import { Mark } from "../../design/components/Mark";
import { useBack } from "../../nav/hooks";
import { PLATFORM, input, isAndroid } from "../../platform/platform";
import { callService, onTV } from "../../platform/service";
import { androidChecks, downloadTest } from "./androidChecks";
import "./hello.css";

/// Phase 0 screen: proves the app installs and renders the brand on the device, shows what the
/// remote sends, and checks that the platform's own pieces answer (webOS: the helper service;
/// Android: the shell, codecs, HLS and the download spike). Opened from the signed-in screen.
///
/// Extra checks can be added without touching this file: any `src/features/hello/*.local.ts` that
/// exports `extraChecks(run)` is picked up (those files are git-ignored, so they stay on this machine).

interface Check {
  label: string;
  result: string;
}

type RunCheck = (label: string, work: () => Promise<string>) => Promise<void>;

const lastKey = signal("Press a button on the remote");
const checks = signal<Check[]>([]);
/// The download test's own results and live progress, shown at the top so they are seen.
const downloads = signal<Check[]>([]);
const progress = signal("");

const localChecks = Object.values(
  import.meta.glob<{ extraChecks?: (run: RunCheck) => Promise<void> }>("./*.local.ts", { eager: true }),
);

function record(label: string, result: string) {
  checks.value = [...checks.value, { label, result }];
}

const runDownload: RunCheck = async (label, work) => {
  try {
    downloads.value = [...downloads.value, { label, result: await work() }];
  } catch (error) {
    downloads.value = [...downloads.value, { label, result: `Failed: ${error instanceof Error ? error.message : String(error)}` }];
  }
};

async function startDownloadTest() {
  if (progress.value) return;
  downloads.value = [];
  progress.value = "Starting…";
  try {
    await downloadTest(runDownload, (text) => (progress.value = text));
  } catch (error) {
    downloads.value = [...downloads.value, { label: "Download test", result: `Failed: ${error instanceof Error ? error.message : String(error)}` }];
  } finally {
    progress.value = "";
  }
}

const run: RunCheck = async (label, work) => {
  try {
    record(label, await work());
  } catch (error) {
    record(label, `Failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};

async function runChecks() {
  checks.value = [];
  if (isAndroid) {
    await androidChecks(run);
    return;
  }
  if (!onTV) {
    record("Service", "Not on a TV: the service checks only run on webOS");
    return;
  }
  await run("Service", async () => {
    const info = await callService<{ node: string; v8: string }>("info");
    return `Answering, Node ${info.node}, V8 ${info.v8}`;
  });
  for (const local of localChecks) await local.extraChecks?.(run);
}

export function Hello({ onClose }: { onClose: () => void }) {
  useBack(onClose);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      lastKey.value = `${event.key || "Unidentified"} · ${event.keyCode}`;
      // OK on the remote (or Enter) runs the checks again.
      if (event.keyCode === 13 && !event.repeat) void runChecks();
    };
    if (input.dpad) window.addEventListener("keydown", onKey);
    void runChecks();
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main class="page hello-page">
      <Mark />
      <h1 class="display">Setup check</h1>
      <p class="secondary">
        {input.dpad ? "Press OK to run the checks again, Back to return." : "Tap to run the checks again; the back button returns."}
      </p>
      {isAndroid && (
        <div class="row">
          <Button icon="arrow-clockwise" onPress={() => void runChecks()}>
            Run checks again
          </Button>
          <Button icon="arrow-right" onPress={() => void startDownloadTest()}>
            Test a download
          </Button>
        </div>
      )}
      {isAndroid && (progress.value || downloads.value.length > 0) && (
        <dl class="hello-list">
          <dt class="secondary">Download test</dt>
          <dd class="mono">{progress.value || "Finished"}</dd>
          {downloads.value.map((check) => (
            <>
              <dt class="secondary">{check.label}</dt>
              <dd class="mono">{check.result}</dd>
            </>
          ))}
        </dl>
      )}

      <dl class="hello-list">
        <dt class="secondary">Build</dt>
        <dd class="mono">{PLATFORM}</dd>
        {input.dpad && (
          <>
            <dt class="secondary">Remote</dt>
            <dd class="mono">{lastKey}</dd>
          </>
        )}
        <dt class="secondary">Browser</dt>
        <dd class="mono">{/Chrome\/[\d.]+/.exec(navigator.userAgent)?.[0] ?? navigator.userAgent}</dd>
        <dt class="secondary">Screen</dt>
        <dd class="mono">
          {window.innerWidth}×{window.innerHeight} · ratio {window.devicePixelRatio}
        </dd>
        {checks.value.map((check) => (
          <>
            <dt class="secondary">{check.label}</dt>
            <dd class="mono">{check.result}</dd>
          </>
        ))}
      </dl>
    </main>
  );
}
