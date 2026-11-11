import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { AddressError } from "../../api/address";
import {
  findServer,
  quickConnectApproved,
  quickConnectEnabled,
  quickConnectStart,
  signInWithPassword,
  signInWithQuickConnect,
  type QuickConnect,
  type ServerInfo,
} from "../../api/auth";
import { ApiError } from "../../api/client";
import { setSession } from "../../api/session";
import { load, save } from "../../api/storage";
import { Button } from "../../design/components/Button";
import { Icon } from "../../design/components/Icon";
import { Mark } from "../../design/components/Mark";
import { TextField } from "../../design/components/TextField";
import { move } from "../../nav/focus";
import { useAutoFocus, useBack } from "../../nav/hooks";
import "./signin.css";

/// Sign-in: server address, then a Quick Connect code to approve from a phone or computer, with
/// username and password as the fallback (and the only way when the server has Quick Connect off).

type Step = "server" | "quick" | "password";

const POLL_MS = 3000;
const UNREACHABLE = "No Jellyfin server answered. Check the address, and that the TV is on the same network.";

function explain(error: unknown): string {
  if (error instanceof AddressError) return error.message;
  if (error instanceof ApiError) {
    if (error.status === 0) return UNREACHABLE;
    if (error.status === 401) return "Wrong username or password.";
    return `The server refused (HTTP ${error.status}).`;
  }
  return "Something went wrong. Try again.";
}

export function SignIn() {
  const step = useSignal<Step>("server");
  const address = useSignal(load("address") ?? "");
  const server = useSignal<ServerInfo | null>(null);
  const quick = useSignal<QuickConnect | null>(null);
  const username = useSignal("");
  const password = useSignal("");
  const busy = useSignal(false);
  const problem = useSignal("");

  useAutoFocus(step.value);
  useBack(
    step.value === "server"
      ? null
      : () => {
          problem.value = "";
          step.value = step.value === "password" && quick.value ? "quick" : "server";
        },
  );

  async function connect() {
    if (busy.value) return;
    busy.value = true;
    problem.value = "";
    try {
      const found = await findServer(address.value);
      save("address", address.value.trim());
      server.value = found;
      quick.value = (await quickConnectEnabled(found.url)) ? await quickConnectStart(found.url).catch(() => null) : null;
      step.value = quick.value ? "quick" : "password";
    } catch (error) {
      problem.value = explain(error);
    } finally {
      busy.value = false;
    }
  }

  async function submitPassword() {
    const target = server.value;
    if (busy.value || !target || !username.value.trim()) return;
    busy.value = true;
    problem.value = "";
    try {
      setSession(await signInWithPassword(target, username.value.trim(), password.value));
    } catch (error) {
      problem.value = explain(error);
      busy.value = false;
    }
  }

  // While the code is showing, ask the server every few seconds whether it has been approved.
  const polling = step.value === "quick" ? server.value : null;
  useEffect(() => {
    if (!polling) return;
    let stopped = false;
    let timer = 0;

    const check = async () => {
      const current = quick.value;
      if (!current) return;
      try {
        if (await quickConnectApproved(polling.url, current.secret)) {
          const signedIn = await signInWithQuickConnect(polling, current.secret);
          if (!stopped) setSession(signedIn);
          return;
        }
        if (!stopped) problem.value = "";
      } catch (error) {
        if (stopped) return;
        if (error instanceof ApiError && error.status === 404) {
          // The code expired: show a fresh one.
          quick.value = await quickConnectStart(polling.url).catch(() => current);
        } else {
          problem.value = error instanceof ApiError && error.status === 0 ? "Lost contact with the server. Still trying." : explain(error);
        }
      }
      if (!stopped) timer = window.setTimeout(check, POLL_MS);
    };

    timer = window.setTimeout(check, POLL_MS);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [polling]);

  const serverLine = server.value && (
    <p class="secondary">
      {server.value.name} <span class="mono">· Jellyfin {server.value.version}</span>
    </p>
  );
  const notice = problem.value && (
    <p class="notice secondary" role="alert">
      <Icon name="warning" />
      {problem.value}
    </p>
  );

  return (
    <main class="page">
      <Mark />

      {step.value === "server" && (
        <>
          <h1 class="display">Connect to Jellyfin</h1>
          <p class="secondary page-text">Enter your server's address, for example 192.168.1.20 or jellyfin.example.com.</p>
          <div class="stack">
            <TextField
              label="Server address"
              value={address.value}
              onChange={(value) => (address.value = value)}
              onDone={() => void connect()}
              placeholder="192.168.1.20"
              mono
              autoFocus={!address.value}
            />
            <Button icon="arrow-right" onPress={() => void connect()} disabled={busy.value} autoFocus={!!address.value}>
              {busy.value ? "Looking for the server" : "Connect"}
            </Button>
          </div>
          {notice}
        </>
      )}

      {step.value === "quick" && quick.value && (
        <>
          <h1 class="display">Quick Connect</h1>
          {serverLine}
          <p class="signin-code">{quick.value.code}</p>
          <p class="secondary page-text">
            On a phone or computer that's signed in to Jellyfin, open your user menu, choose Quick Connect and enter this code. This screen
            signs in by itself once the code is approved.
          </p>
          <div class="row actions">
            <Button icon="key" onPress={() => ((problem.value = ""), (step.value = "password"))} autoFocus>
              Use a password
            </Button>
            <Button icon="arrow-left" onPress={() => ((problem.value = ""), (step.value = "server"))}>
              Change server
            </Button>
          </div>
          {notice}
        </>
      )}

      {step.value === "password" && (
        <>
          <h1 class="display">Sign in</h1>
          {serverLine}
          <div class="stack">
            <TextField label="Username" value={username.value} onChange={(value) => (username.value = value)} onDone={() => move("down")} autoFocus />
            <TextField
              label="Password"
              value={password.value}
              onChange={(value) => (password.value = value)}
              onDone={() => void submitPassword()}
              secret
            />
            <div class="row">
              <Button icon="arrow-right" onPress={() => void submitPassword()} disabled={busy.value || !username.value.trim()}>
                {busy.value ? "Signing in" : "Sign in"}
              </Button>
              <Button icon="arrow-left" onPress={() => ((problem.value = ""), (step.value = quick.value ? "quick" : "server"))}>
                {quick.value ? "Quick Connect" : "Change server"}
              </Button>
            </div>
          </div>
          {notice}
        </>
      )}
    </main>
  );
}
