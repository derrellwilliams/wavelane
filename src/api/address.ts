/// Turns what the user typed for "Server address" into URLs worth trying, and enforces the rule
/// that plain HTTP is only used inside the home network (the sign-in token would otherwise cross
/// the internet unencrypted).

const JELLYFIN_HTTP_PORT = 8096;

export class AddressError extends Error {}

/// True for addresses that can only be reached on the local network (or a private tunnel).
export function isLanHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "::1") return true;

  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 100 && b >= 64 && b <= 127) // carrier-grade NAT range, used by Tailscale
    );
  }
  if (host.includes(":")) return /^f[cd]/.test(host) || /^fe[89ab]/.test(host); // IPv6 private and link-local
  // Names: one-word hosts and the suffixes home routers hand out.
  return !host.includes(".") || /\.(local|lan|home|internal|home\.arpa)$/.test(host);
}

function parse(text: string): URL {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new AddressError("That doesn't look like a server address");
  }
  if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname || url.username || url.password) {
    throw new AddressError("That doesn't look like a server address");
  }
  return url;
}

/// Base URL without a trailing slash, query or fragment.
function base(url: URL): string {
  return url.origin + url.pathname.replace(/\/+$/, "");
}

/// URLs to try for a typed address, best guess first. Throws AddressError when the text can't be
/// an address, or asks for plain HTTP to a server outside the home network.
export function candidates(input: string): string[] {
  const text = input.trim();
  if (!text) throw new AddressError("Enter your server's address");

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
    const url = parse(text);
    if (url.protocol === "http:" && !isLanHost(url.hostname)) {
      throw new AddressError("Use https:// for a server outside your home network");
    }
    return [base(url)];
  }

  const secure = parse(`https://${text}`);
  const plain = parse(`http://${text}`);
  const lan = isLanHost(plain.hostname);
  if (plain.port) return lan ? [base(plain), base(secure)] : [base(secure)];
  if (!lan) return [base(secure)];

  const withPort = new URL(plain.href);
  withPort.port = String(JELLYFIN_HTTP_PORT);
  return [base(withPort), base(secure), base(plain)];
}
