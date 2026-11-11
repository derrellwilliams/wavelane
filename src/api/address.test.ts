import { describe, expect, it } from "vitest";
import { AddressError, candidates, isLanHost } from "./address";

describe("isLanHost", () => {
  it.each(["192.168.86.20", "10.0.0.5", "172.16.4.1", "172.31.255.1", "127.0.0.1", "100.100.1.2", "localhost", "nas", "jellyfin.local", "media.home.arpa", "[fd12::1]", "fe80::1"])(
    "%s is local",
    (host) => expect(isLanHost(host)).toBe(true),
  );
  it.each(["8.8.8.8", "172.32.0.1", "100.128.0.1", "jellyfin.example.com", "192.168.1.1.example.com", "2001:db8::1"])(
    "%s is not local",
    (host) => expect(isLanHost(host)).toBe(false),
  );
});

describe("candidates", () => {
  it("tries Jellyfin's port first for a bare LAN address", () => {
    expect(candidates(" 192.168.86.20 ")).toEqual(["http://192.168.86.20:8096", "https://192.168.86.20", "http://192.168.86.20"]);
  });

  it("keeps a typed port", () => {
    expect(candidates("192.168.86.20:8920")).toEqual(["http://192.168.86.20:8920", "https://192.168.86.20:8920"]);
  });

  it("only offers HTTPS for a public name", () => {
    expect(candidates("jellyfin.example.com")).toEqual(["https://jellyfin.example.com"]);
    expect(candidates("jellyfin.example.com:8096")).toEqual(["https://jellyfin.example.com:8096"]);
  });

  it("uses a full URL as typed, minus the trailing slash, and keeps a base path", () => {
    expect(candidates("https://example.com/jellyfin/")).toEqual(["https://example.com/jellyfin"]);
    expect(candidates("http://nas:8096/")).toEqual(["http://nas:8096"]);
  });

  it("refuses plain HTTP to a public server", () => {
    expect(() => candidates("http://jellyfin.example.com")).toThrow(AddressError);
  });

  it("refuses empty input, other schemes and embedded credentials", () => {
    expect(() => candidates("  ")).toThrow(AddressError);
    expect(() => candidates("ftp://nas")).toThrow(AddressError);
    expect(() => candidates("https://user:pw@example.com")).toThrow(AddressError);
    expect(() => candidates("not an address")).toThrow(AddressError);
  });
});
