/// The one place the app talks to a Jellyfin server. Thin on purpose: JSON in, JSON out, a time
/// limit, and errors that never carry the token, a query string or a request body.

const CLIENT = "Wavetile TV";
const DEVICE = "LG TV";
export const APP_VERSION = "0.1.0";

export interface Connection {
  server: string; // base URL, no trailing slash
  token?: string;
  deviceId: string;
}

/// `status` is the HTTP status, or 0 when the server couldn't be reached (offline, timeout, CORS).
export class ApiError extends Error {
  constructor(
    readonly status: number,
    what: string,
  ) {
    super(status ? `${what}: HTTP ${status}` : `${what}: server not reachable`);
  }
}

/// Jellyfin's Authorization header. Values are fixed strings or hex, so nothing needs escaping.
export function authHeader(deviceId: string, token?: string): string {
  const parts = [`Client="${CLIENT}"`, `Device="${DEVICE}"`, `DeviceId="${deviceId}"`, `Version="${APP_VERSION}"`];
  if (token) parts.push(`Token="${token}"`);
  return `MediaBrowser ${parts.join(", ")}`;
}

interface Options {
  method?: "GET" | "POST" | "DELETE";
  query?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  /// Return the reply as text instead of parsing it as JSON (subtitle files).
  as?: "text";
}

const MAX_TEXT_REPLY = 5_000_000;
/// Library replies are paged, so even a big page is well under this.
const MAX_JSON_REPLY = 20_000_000;

/// Reads a reply's body but stops as soon as it passes `max` bytes, so a broken or hostile server
/// can't make the app hold an endless reply in memory. Throws RangeError when the reply is too big.
export async function readCapped(response: Response, max: number): Promise<Uint8Array<ArrayBuffer>> {
  const declared = Number(response.headers.get("Content-Length"));
  if (declared > max) {
    response.body?.cancel().catch(() => undefined);
    throw new RangeError("reply too large");
  }
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      reader.cancel().catch(() => undefined);
      throw new RangeError("reply too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return bytes;
}

export async function request<T>(connection: Connection, path: string, options: Options = {}): Promise<T> {
  const method = options.method ?? "GET";
  const what = `${method} ${path}`; // safe to show or log: no host, query or body
  const query = options.query ? `?${new URLSearchParams(options.query)}` : "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10000);

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: authHeader(connection.deviceId, connection.token),
    };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";

    let response: Response;
    try {
      response = await fetch(connection.server + path + query, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
        credentials: "omit",
        redirect: "error", // a redirect could carry the token to another host
      });
    } catch {
      throw new ApiError(0, what);
    }
    if (!response.ok) throw new ApiError(response.status, what);
    if (response.status === 204) return undefined as T;

    // The time limit above still runs while the body arrives, so a slow trickle is cut off too.
    const bytes = await readCapped(response, options.as === "text" ? MAX_TEXT_REPLY : MAX_JSON_REPLY).catch(() => {
      throw new ApiError(0, what);
    });
    const text = new TextDecoder().decode(bytes); // UTF-8, BOM dropped, as response.text() does
    if (options.as === "text") return text as T;
    if (!text) return undefined as T;
    try {
      return JSON.parse(text) as T;
    } catch {
      // Something answered, but not a Jellyfin server (a router page, a captive portal).
      throw new ApiError(0, what);
    }
  } finally {
    clearTimeout(timer);
  }
}
