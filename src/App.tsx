import { signal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { refresh, signOut } from "./api/auth";
import { ApiError } from "./api/client";
import { session, setSession } from "./api/session";
import { forgetEverything } from "./data/resource";
import { Button } from "./design/components/Button";
import { Mark } from "./design/components/Mark";
import { Hello } from "./features/hello/Hello";
import { resetRoute } from "./features/shell/route";
import { BackButton } from "./features/shell/BackButton";
import { Shell } from "./features/shell/Shell";
import { SignIn } from "./features/signin/SignIn";
import { useAutoFocus } from "./nav/hooks";

/// Decides which screen shows: sign-in, the signed-in app, or "can't reach the server" when a
/// saved session can't be checked.

type Status = "checking" | "ready" | "offline";
type View = "home" | "setup";

const status = signal<Status>("ready");
const view = signal<View>("home");

/// Confirms the saved session with the server. At launch this runs quietly behind the app, which
/// is already showing the last visit's library from the cache. Only a clear "token rejected" signs the user out;
/// a server that is off or unreachable keeps the session for next time.
async function check(quiet = false) {
  const saved = session.value;
  if (!saved) return;
  if (!quiet) status.value = "checking";
  try {
    setSession(await refresh(saved));
    status.value = "ready";
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      forgetEverything();
      setSession(null);
      status.value = "ready";
    } else {
      status.value = "offline";
    }
  }
}

function leave() {
  const current = session.value;
  if (current) void signOut(current);
  // The next person to sign in must not see this one's library.
  forgetEverything();
  resetRoute();
  setSession(null);
  view.value = "home";
  status.value = "ready";
}

function Offline({ serverName }: { serverName: string }) {
  useAutoFocus();
  return (
    <main class="page">
      <Mark />
      <h1 class="display">Can't reach {serverName}</h1>
      <p class="secondary page-text">Check that the server is on and the TV is connected to the network.</p>
      <div class="row actions">
        <Button icon="arrow-clockwise" onPress={() => void check()} autoFocus>
          Try again
        </Button>
        <Button icon="sign-out" onPress={leave}>
          Sign out
        </Button>
      </div>
    </main>
  );
}

export function App() {
  return (
    <>
      <Screens />
      <BackButton />
    </>
  );
}

function Screens() {
  useEffect(() => void check(true), []);

  const current = session.value;
  // Signed out (by choice, or because the server rejected the token): start from Home next time.
  useEffect(() => {
    if (!current) resetRoute();
  }, [current]);
  if (!current) return <SignIn />;
  if (status.value === "checking") {
    return (
      <main class="page">
        <Mark />
      </main>
    );
  }
  if (status.value === "offline") return <Offline serverName={current.serverName} />;
  if (view.value === "setup") return <Hello onClose={() => (view.value = "home")} />;
  return <Shell session={current} onSetupCheck={() => (view.value = "setup")} onSignOut={leave} />;
}
