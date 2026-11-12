/// The one place the app talks to a Jellyfin server. Thin on purpose: JSON in, JSON out, a time
/// limit, and errors that never carry the token, a query string or a request body.

const CLIENT = "Wavelane";
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

    const text = await response.text().catch(() => {
      throw new ApiError(0, what);
    });
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
