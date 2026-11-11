import { signal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { callService, onTV } from "../../platform/service";
import "./hello.css";

/// Phase 0 screen: proves the app installs and renders the brand on the TV, shows what the remote
/// sends, and checks that the app's helper service answers. Replaced by sign-in in phase 1.
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

const localChecks = Object.values(
  import.meta.glob<{ extraChecks?: (run: RunCheck) => Promise<void> }>("./*.local.ts", { eager: true }),
);

function record(label: string, result: string) {
  checks.value = [...checks.value, { label, result }];
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

export function Hello() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      lastKey.value = `${event.key || "Unidentified"} · ${event.keyCode}`;
      // OK on the remote (or Enter) runs the checks again.
      if (event.keyCode === 13) void runChecks();
    };
    window.addEventListener("keydown", onKey);
    void runChecks();
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main class="hello">
      <svg class="hello-mark" viewBox="0 0 92 16" aria-hidden="true">
        <path d="M1 7.9C6 -1.3 11 -1.3 16 7.9C20.5 15.3 25.5 15.3 31 7.9C36 0.5 41 0.5 46 7.9C51.3 16.1 56.3 16.1 61 7.9C66 -0.3 71 -0.3 76 7.9C80.6 14.9 85.6 14.9 91 7.9" />
      </svg>
      <h1 class="display">Wavelane</h1>
      <p class="secondary">Setup check. Press OK to run the checks again.</p>

      <dl class="hello-list">
        <dt class="secondary">Remote</dt>
        <dd class="mono">{lastKey}</dd>
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
