import { describe, expect, it } from "vitest";
import { parseFeed, parseFilmRating } from "./parse";

describe("parseFilmRating", () => {
  it("reads the average and count", () => {
    expect(parseFilmRating('{"ratingValue":4.54,"ratingCount":2912345}')).toEqual({ rating: 4.54, count: 2912345 });
  });
  it("gives nulls for a page without one or an absurd one", () => {
    expect(parseFilmRating("Just a moment...")).toEqual({ rating: null, count: null });
    expect(parseFilmRating('"ratingValue": 47, "ratingCount": 10').rating).toBeNull();
    expect(parseFilmRating('"ratingValue": 3.2, "ratingCount": 99999999999')).toEqual({ rating: 3.2, count: null });
  });
});

describe("parseFeed", () => {
  const item = (tmdb: string, extra = "") => `<item><tmdb:movieId>${tmdb}</tmdb:movieId>${extra}</item>`;
  it("keeps films with checked fields and skips the rest", () => {
    const xml =
      item("496243", "<letterboxd:memberRating>4.5</letterboxd:memberRating><letterboxd:watchedDate>2026-01-02</letterboxd:watchedDate><letterboxd:rewatch>Yes</letterboxd:rewatch>") +
      item("12x") +
      "<item>a list</item>" +
      item("7", "<letterboxd:memberRating>9</letterboxd:memberRating><letterboxd:watchedDate>soon</letterboxd:watchedDate>");
    expect(parseFeed(xml)).toEqual([
      { tmdb: "496243", rating: 4.5, date: "2026-01-02", rewatch: true },
      { tmdb: "7", rating: null, date: null, rewatch: false },
    ]);
  });
  it("reads at most 100 entries", () => {
    expect(parseFeed(Array.from({ length: 150 }, (_, i) => item(String(i + 1))).join("")).length).toBe(100);
  });
});
