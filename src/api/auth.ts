/// Finding a server and signing in: Quick Connect first, password second. Everything a server
/// sends back is checked before use, since "the server" is whatever answered at a typed address.
import type { AuthenticationResult, PublicSystemInfo, QuickConnectResult, UserDto } from "@jellyfin/sdk/lib/generated-client/models";
import { candidates } from "./address";
import { ApiError, request, type Connection } from "./client";
import { deviceId } from "./storage";

export interface ServerInfo {
  url: string;
  name: string;
  version: string;
}

export interface Session {
  server: string;
  serverName: string;
  serverVersion: string;
  userId: string;
  userName: string;
  token: string;
}

export interface QuickConnect {
  secret: string;
  code: string;
}

const MAX_NAME = 80;

function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= max ? value : null;
}

/// Server and user names are shown on screen: cut to a sane length. (They are only ever rendered
/// as text, never as markup.)
function label(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, MAX_NAME) : fallback;
}

const anonymous = (server: string): Connection => ({ server, deviceId: deviceId() });

export const connectionOf = (session: Session): Connection => ({
  server: session.server,
  token: session.token,
  deviceId: deviceId(),
});

async function probe(url: string): Promise<ServerInfo> {
  const info = await request<PublicSystemInfo>(anonymous(url), "/System/Info/Public", { timeoutMs: 6000 });
  const version = text(info?.Version, 20);
  if (!text(info?.Id, 64) || !version || !/^\d+(\.\d+){1,3}/.test(version)) throw new ApiError(0, "GET /System/Info/Public");
  return { url, name: label(info.ServerName, "Jellyfin"), version };
}

/// Tries every reading of a typed address at once and keeps the most likely one that answered.
/// Throws AddressError for text that can't be an address, ApiError when nothing answered.
export async function findServer(input: string): Promise<ServerInfo> {
  const results = await Promise.allSettled(candidates(input).map(probe));
  for (const result of results) if (result.status === "fulfilled") return result.value;
  throw new ApiError(0, "GET /System/Info/Public");
}

/// True when the server is at least `major.minor` (Skip Intro needs 10.10, trickplay 10.9).
export function versionAtLeast(version: string, major: number, minor: number): boolean {
  const [a = 0, b = 0] = version.split(".").map((part) => Number.parseInt(part, 10) || 0);
  return a > major || (a === major && b >= minor);
}

export async function quickConnectEnabled(server: string): Promise<boolean> {
  try {
    return (await request<boolean>(anonymous(server), "/QuickConnect/Enabled")) === true;
  } catch {
    return false;
  }
}

/// Asks the server for a code to show. Servers from 10.9 want POST, older ones GET.
export async function quickConnectStart(server: string): Promise<QuickConnect> {
  let result: QuickConnectResult;
  try {
    result = await request<QuickConnectResult>(anonymous(server), "/QuickConnect/Initiate", { method: "POST" });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 405) throw error;
    result = await request<QuickConnectResult>(anonymous(server), "/QuickConnect/Initiate");
  }
  const secret = text(result?.Secret, 128);
  const code = text(result?.Code, 12);
  if (!secret || !code || !/^[A-Za-z0-9]+$/.test(code)) throw new ApiError(0, "POST /QuickConnect/Initiate");
  return { secret, code };
}

/// Has the user approved the code yet? A 404 means the code expired: start again.
export async function quickConnectApproved(server: string, secret: string): Promise<boolean> {
  const result = await request<QuickConnectResult>(anonymous(server), "/QuickConnect/Connect", { query: { secret } });
  return result?.Authenticated === true;
}

function sessionFrom(server: ServerInfo, result: AuthenticationResult, what: string): Session {
  const token = text(result?.AccessToken, 256);
  const userId = text(result?.User?.Id, 64);
  // The token goes into a quoted header value, so it must not be able to break out of the quotes.
  if (!token || !userId || !/^[\w.~+/=-]+$/.test(token) || !/^[0-9a-f-]+$/i.test(userId)) throw new ApiError(0, what);
  return {
    server: server.url,
    serverName: server.name,
    serverVersion: server.version,
    userId,
    userName: label(result.User?.Name, "Signed in"),
    token,
  };
}

export async function signInWithQuickConnect(server: ServerInfo, secret: string): Promise<Session> {
  const path = "/Users/AuthenticateWithQuickConnect";
  const result = await request<AuthenticationResult>(anonymous(server.url), path, { method: "POST", body: { Secret: secret } });
  return sessionFrom(server, result, `POST ${path}`);
}

export async function signInWithPassword(server: ServerInfo, username: string, password: string): Promise<Session> {
  const path = "/Users/AuthenticateByName";
  const result = await request<AuthenticationResult>(anonymous(server.url), path, {
    method: "POST",
    body: { Username: username, Pw: password },
  });
  return sessionFrom(server, result, `POST ${path}`);
}

/// Checks a saved session still works and picks up a changed user name or server version.
/// Throws ApiError: 401 means the token was revoked, 0 that the server can't be reached.
export async function refresh(session: Session): Promise<Session> {
  const me = await request<UserDto>(connectionOf(session), "/Users/Me");
  let server: ServerInfo | null = null;
  try {
    server = await probe(session.server);
  } catch {
    // The name and version are only for show; keep the saved ones.
  }
  return {
    ...session,
    userName: label(me?.Name, session.userName),
    serverName: server?.name ?? session.serverName,
    serverVersion: server?.version ?? session.serverVersion,
  };
}

/// Tells the server to forget the token. Failing is fine: the token is dropped locally either way.
export async function signOut(session: Session): Promise<void> {
  try {
    await request<void>(connectionOf(session), "/Sessions/Logout", { method: "POST", timeoutMs: 4000 });
  } catch {
    // Offline or already revoked.
  }
}
