import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "./auth";
import { everything, latest, search, setFavorite, setPlayed } from "./library";

const USER = "9f8e7d6c00000000000000000000aaaa";
const ID = "0123456789abcdef0123456789abcdef";
const SESSION: Session = {
  server: "http://nas:8096",
  serverName: "Home",
  serverVersion: "12.4.0",
  userId: USER,
  userName: "Me",
  token: "tok",
};

interface Call {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: Record<string, string>;
}

/// Replaces fetch: `answer` gets each call and returns the JSON to reply with (or a status).
function serve(answer: (call: Call) => unknown) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", async (address: string, init: RequestInit) => {
    const url = new URL(address);
    const call = { method: init.method ?? "GET", path: url.pathname, query: url.searchParams, headers: init.headers as Record<string, string> };
    calls.push(call);
    const reply = answer(call);
    if (typeof reply === "number") return new Response(null, { status: reply });
    return new Response(JSON.stringify(reply), { status: 200 });
  });
  return calls;
}

const movie = (n: number) => ({ Id: n.toString(16).padStart(32, "0"), Type: "Movie", Name: `Movie ${n}` });

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("everything", () => {
  it("asks for one type, as this user, with the token in the header and not the URL", async () => {
    const calls = serve(() => ({ Items: [movie(1), movie(2)] }));
    await expect(everything(SESSION, "Movie")).resolves.toHaveLength(2);
    expect(calls).toHaveLength(1);
    const { path, query, headers } = calls[0]!;
    expect(path).toBe("/Items");
    expect(query.get("userId")).toBe(USER);
    expect(query.get("includeItemTypes")).toBe("Movie");
    expect(query.get("recursive")).toBe("true");
    expect(query.get("fields")).toContain("ProviderIds");
    expect(headers.Authorization).toContain('Token="tok"');
    expect([...query.values()].join(" ")).not.toContain("tok");
  });

  it("keeps asking for pages until one comes back short", async () => {
    const calls = serve(({ query }) => {
      const start = Number(query.get("startIndex"));
      const size = start === 0 ? 2000 : 3;
      return { Items: Array.from({ length: size }, (_, index) => movie(start + index + 1)) };
    });
    await expect(everything(SESSION, "Movie")).resolves.toHaveLength(2003);
    expect(calls.map((call) => call.query.get("startIndex"))).toEqual(["0", "2000"]);
  });
});

describe("shelves and search", () => {
  it("reads the bare array that Latest returns", async () => {
    serve(() => [movie(1)]);
    await expect(latest(SESSION, "Movie")).resolves.toHaveLength(1);
  });

  it("still returns titles when the people search fails", async () => {
    const calls = serve(({ path, query }) => {
      if (path === "/Persons") return 404;
      return { Items: query.get("includeItemTypes") === "Movie" ? [movie(1)] : [] };
    });
    const found = await search(SESSION, "heat & co");
    expect(found.movies).toHaveLength(1);
    expect(found.people).toEqual([]);
    expect(calls.find((call) => call.path === "/Items")?.query.get("searchTerm")).toBe("heat & co");
  });
});

describe("marking", () => {
  it("posts to switch on and deletes to switch off", async () => {
    const calls = serve(() => ({}));
    await setFavorite(SESSION, ID, true);
    await setPlayed(SESSION, ID, false);
    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([`POST /UserFavoriteItems/${ID}`, `DELETE /UserPlayedItems/${ID}`]);
    expect(calls[0]!.query.get("userId")).toBe(USER);
  });
});
