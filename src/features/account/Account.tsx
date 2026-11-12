import { useCallback, useRef, useState } from "preact/hooks";
import { versionAtLeast, type Session } from "../../api/auth";
import { Button } from "../../design/components/Button";
import { Icon } from "../../design/components/Icon";
import { Mark } from "../../design/components/Mark";
import { Connect } from "../letterboxd/Connect";
import { SubtitleStyle } from "../player/SubtitleStyle";
import { useEnter } from "../shell/enter";

interface Props {
  session: Session;
  onSetupCheck: () => void;
  onSignOut: () => void;
}

/// Who is signed in to what, the setup check and sign-out. Stands in for Settings (phase 6), and
/// flags a server too old for features planned later.
export function Account({ session, onSetupCheck, onSignOut }: Props) {
  const screen = useRef<HTMLElement>(null);
  const [styling, setStyling] = useState(false);
  const [lists, setLists] = useState(false);
  const closeLists = useCallback(() => setLists(false), []);
  useEnter(screen, !styling && !lists);

  const missing = !versionAtLeast(session.serverVersion, 10, 9)
    ? "Scrub thumbnails need Jellyfin 10.9 and Skip Intro needs 10.10."
    : !versionAtLeast(session.serverVersion, 10, 10)
      ? "Skip Intro needs Jellyfin 10.10."
      : "";

  if (lists) return <Connect onClose={closeLists} />;
  if (styling) return <SubtitleStyle onClose={() => setStyling(false)} />;

  return (
    <main ref={screen} class="page">
      <Mark />
      <h1 class="display">Account</h1>

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

      <div class="row actions" data-focus-group>
        <Button icon="wrench" onPress={onSetupCheck} autoFocus>
          Setup check
        </Button>
        <Button icon="subtitles" onPress={() => setStyling(true)}>
          Subtitle appearance
        </Button>
        <Button icon="film-reel" onPress={() => setLists(true)}>
          Letterboxd
        </Button>
        <Button icon="sign-out" onPress={onSignOut}>
          Sign out
        </Button>
      </div>
    </main>
  );
}
