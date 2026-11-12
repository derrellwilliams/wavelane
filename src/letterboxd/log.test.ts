// @ts-ignore: Node types are not installed (the app has none); the tests run in Node.
import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Item } from "../api/items";
import { readCsv } from "./csv";
import { buildLog } from "./log";
import { matchLibrary, normalize } from "./match";

const movie = (id: string, name: string, year: number): Item =>
  ({ id, type: "Movie", name, sortName: name, year, genres: [], played: false, favorite: false }) as Item;

describe("csv", () => {
  it("reads quotes, doubled quotes, CRLF and a BOM", () => {
    expect(readCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n')).toEqual([["a", "b"], ["x, y", 'say "hi"']]);
  });
  it("refuses an oversized file", () => {
    expect(() => readCsv("a".repeat(11 * 1024 * 1024))).toThrow();
  });
});

describe("log", () => {
  const head = "Date,Name,Year,Letterboxd URI";
  it("merges the files and drops bad rows", () => {
    const log = buildLog({
      watched: `${head}\n2020-01-01,Alien,1979,https://boxd.it/aaa\n2020-01-01,Bad,abc,https://boxd.it/bbb\n2020-01-01,Evil,1999,http://evil.example/x`,
      ratings: `${head},Rating\n2020-01-01,Alien,1979,https://boxd.it/aaa,4.5\n2020-01-01,Heat,1995,https://boxd.it/ccc,9`,
      diary: `${head},Rating,Rewatch,Tags,Watched Date\n2020-01-01,Alien,1979,https://boxd.it/aaa,4.5,Yes,,2021-03-04`,
      watchlist: `${head}\n2020-01-01,Ran,1985,https://boxd.it/ddd`,
    });
    const by = Object.fromEntries(log.map((f) => [f.name, f]));
    expect(log).toHaveLength(3);
    expect(by.Alien).toMatchObject({ rating: 4.5, rewatches: 1, last: "2021-03-04", watched: true });
    expect(by.Heat?.rating).toBeUndefined();
    expect(by.Ran).toMatchObject({ watchlist: true, watched: false });
  });
});

describe("match", () => {
  const film = (name: string, year: number, uri: string) => ({ name, year, uri, watched: true, rewatches: 0, watchlist: false });
  it("normalizes", () => {
    expect(normalize("The Amélie & Co.")).toBe("amelie and co");
  });
  it("needs the exact year for remade titles, allows ±1 otherwise", () => {
    const log = [film("Dune", 1984, "u1"), film("Dune", 2021, "u2"), film("Heat", 1995, "u3")];
    const lib = [movie("a", "Dune", 2021), movie("b", "Dune", 1985), movie("c", "Heat", 1996)];
    const { byItem, missing } = matchLibrary(log, lib);
    expect(byItem.get("a")?.uri).toBe("u2");
    expect(byItem.get("c")?.uri).toBe("u3");
    expect(byItem.has("b")).toBe(false);
    expect(missing.map((f) => f.uri)).toEqual(["u1"]);
  });
});

const dir = "scratch/export-2026-11-11";
describe.skipIf(!existsSync(`${dir}/watched.csv`))("the real export (aggregates only)", () => {
  const read = (n: string): string => readFileSync(`${dir}/${n}.csv`, "utf8");
  it("matches the counts recorded in CLAUDE.md", () => {
    const log = buildLog({ watched: read("watched"), ratings: read("ratings"), diary: read("diary"), watchlist: read("watchlist") });
    expect(log.filter((f) => f.watched)).toHaveLength(636);
    expect(log.filter((f) => f.rating !== undefined)).toHaveLength(594);
    expect(log.filter((f) => f.watchlist)).toHaveLength(46);
    expect(log.reduce((n, f) => n + f.rewatches, 0)).toBe(11);
  });
});
