import { versionAtLeast, type Session } from "../../api/auth";
import { Button } from "../../design/components/Button";
import { Icon } from "../../design/components/Icon";
import { Mark } from "../../design/components/Mark";
import { useAutoFocus } from "../../nav/hooks";

interface Props {
  session: Session;
  onSetupCheck: () => void;
  onSignOut: () => void;
}

/// Phase 1 stand-in for Home: confirms who is signed in to what, and flags a server too old for
/// features planned later. The real Home (shelves from the library) replaces it in phase 2.
export function Home({ session, onSetupCheck, onSignOut }: Props) {
  useAutoFocus();

  const missing = !versionAtLeast(session.serverVersion, 10, 9)
    ? "Scrub thumbnails need Jellyfin 10.9 and Skip Intro needs 10.10."
    : !versionAtLeast(session.serverVersion, 10, 10)
      ? "Skip Intro needs Jellyfin 10.10."
      : "";

  return (
    <main class="page">
      <Mark />
      <h1 class="display">Signed in</h1>
      <p class="secondary page-text">The library arrives in the next build. For now this confirms the connection.</p>

      <dl class="facts">
        <dt class="secondary">User</dt>
        <dd>{session.userName}</dd>
        <dt class="secondary">Server</dt>
        <dd>{session.serverName}</dd>
        <dt class="secondary">Address</dt>
        <dd class="mono">{session.server}</dd>
        <dt class="secondary">Version</dt>
        <dd class="mono">Jellyfin {session.serverVersion}</dd>
      </dl>
      {missing && (
        <p class="notice secondary">
          <Icon name="warning" />
          {missing}
        </p>
      )}

      <div class="row actions">
        <Button icon="wrench" onPress={onSetupCheck} autoFocus>
          Setup check
        </Button>
        <Button icon="sign-out" onPress={onSignOut}>
          Sign out
        </Button>
      </div>
    </main>
  );
}
