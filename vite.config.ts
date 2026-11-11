import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import preact from "@preact/preset-vite";

/// webOS loads the app from file://, where Chromium refuses module scripts and anything marked
/// `crossorigin`. The bundle is one classic script, so the tags are rewritten to match.
function webosHtml(): Plugin {
  return {
    name: "webos-html",
    enforce: "post",
    transformIndexHtml(html) {
      return html
        .replace(/<script type="module" crossorigin/g, "<script defer")
        .replace(/<link rel="stylesheet" crossorigin/g, '<link rel="stylesheet"');
    },
  };
}

export default defineConfig({
  // Relative URLs: the app is served from a folder on the TV, not a site root.
  base: "./",
  // appinfo.json and the launcher icons are copied to the root of dist as they are.
  publicDir: "webos",
  plugins: [preact(), webosHtml()],
  build: {
    // webOS 24 is Chromium 108 and LG never updates it.
    target: "chrome108",
    modulePreload: false,
    cssCodeSplit: false,
    rollupOptions: {
      output: { format: "iife" },
    },
  },
  test: { include: ["src/**/*.test.ts", "service/**/*.test.js"] },
});
