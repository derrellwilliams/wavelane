import { describe, expect, it } from "vitest";
import { hostOf, hostsFrom, isLanHost, networkConfig } from "./android-config.mjs";

describe("android network config", () => {
  it("accepts private and local addresses only", () => {
    for (const host of ["192.168.1.20", "10.0.0.5", "172.16.0.1", "172.31.255.1", "127.0.0.1", "localhost", "nas", "jelly.local", "fd12::1"]) {
      expect(isLanHost(host), host).toBe(true);
    }
    for (const host of ["8.8.8.8", "172.32.0.1", "172.15.0.1", "192.169.1.1", "300.1.1.1", "example.com", "jelly.example.org"]) {
      expect(isLanHost(host), host).toBe(false);
    }
  });

  it("reads a host out of an address", () => {
    expect(hostOf("http://192.168.1.20:8096")).toBe("192.168.1.20");
    expect(hostOf("192.168.1.20")).toBe("192.168.1.20");
    expect(hostOf("https://nas.local/jellyfin")).toBe("nas.local");
    expect(hostOf("")).toBeNull();
  });

  it("refuses a public host and leaves duplicates out", () => {
    expect(() => hostsFrom({ server: "https://jelly.example.com" })).toThrow(/private or local/);
    expect(hostsFrom({ server: "192.168.1.20", hosts: ["192.168.1.20", "nas"] })).toEqual(["192.168.1.20", "nas"]);
    expect(hostsFrom({})).toEqual([]);
  });

  it("blocks all plain HTTP except localhost and the named hosts", () => {
    const xml = networkConfig(["192.168.1.20"]);
    expect(xml).toContain('<base-config cleartextTrafficPermitted="false">');
    expect(xml.match(/<domain /g)).toHaveLength(2);
    expect(xml).toContain(">localhost<");
    expect(xml).toContain(">192.168.1.20<");
    expect(xml).not.toContain("*");
  });
});
