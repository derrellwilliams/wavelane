// Draws every launcher icon: the cube from Wavetile (WavetileMark.swift), in tan on the near-black
// canvas, at its resting pose (edges to the top middle, right middle and bottom-left corner).
// Run: npm run icons
//   webos/icon.png 80×80 and webos/largeIcon.png 130×130
//   android mipmap-*/ic_launcher.png (square), ic_launcher_round.png, ic_launcher_foreground.png (adaptive layer)
import { deflateSync, crc32 } from "node:zlib";
import { writeFileSync } from "node:fs";

const INK = [0x1a, 0x1a, 0x1a];
const TAN = [0xec, 0xe4, 0xd2];

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body) >>> 0, body.length + 4);
  return out;
}

// The mark on Wavetile's 100-unit grid (WavetileMark.draw): a rounded frame 10 to 90 with radius 8,
// three butt-capped edges from the center (50, 50), and a hub dot as wide as the line.
const FRAME_HALF = 40;
const FRAME_RADIUS = 8;
const CENTER = 50;
const ENDS = [
  [50, 12], // top middle
  [88, 50], // right middle
  [12, 88], // bottom-left corner
];

// Same weight as the app: Wavetile draws the line at 2.25 pt however big the mark is, which on its
// 96 pt splash is 2.34 grid units. The mark's box is 75% of the icon, so the line is 1.76% of the
// icon, the weight the old wave icon had.
const BOX = 0.75;
const LINE = 2.25 / 0.96; // grid units

// Signed distance (negative inside) from a point to the cube's ink, in grid units.
function sd(px, py) {
  const half = LINE / 2;
  // Frame: the outline of a rounded square, stroked on its path.
  const qx = Math.abs(px - CENTER) - (FRAME_HALF - FRAME_RADIUS);
  const qy = Math.abs(py - CENTER) - (FRAME_HALF - FRAME_RADIUS);
  const box = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - FRAME_RADIUS;
  let best = Math.abs(box) - half;
  // Hub dot.
  best = Math.min(best, Math.hypot(px - CENTER, py - CENTER) - half);
  // Edges: rectangles with square ends.
  for (const [ex, ey] of ENDS) {
    const dx = ex - CENTER;
    const dy = ey - CENTER;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    const rx = px - (CENTER + dx / 2);
    const ry = py - (CENTER + dy / 2);
    const along = Math.abs(rx * ux + ry * uy) - len / 2;
    const across = Math.abs(-rx * uy + ry * ux) - half;
    const d = Math.hypot(Math.max(along, 0), Math.max(across, 0)) + Math.min(Math.max(along, across), 0);
    best = Math.min(best, d);
  }
  return best;
}

/**
 * RGBA PNG. `shape` is "square" (ink fills the canvas), "round" (ink in a circle, clear outside) or
 * "layer" (cube only, clear background, for an adaptive icon: the visible window is 72 of 108 dp).
 */
function png(size, shape = "square") {
  const visible = shape === "layer" ? (size * 72) / 108 : size;
  const scale = (visible * BOX) / 100; // pixels per grid unit
  const origin = (size - 100 * scale) / 2;
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    for (let x = 0; x < size; x++) {
      const gx = (x + 0.5 - origin) / scale;
      const gy = (y + 0.5 - origin) / scale;
      const cover = Math.max(0, Math.min(1, 0.5 - sd(gx, gy) * scale));
      let alpha = 255;
      let ink = cover;
      if (shape === "round") {
        const r = size / 2;
        alpha = Math.round(255 * Math.max(0, Math.min(1, r - Math.hypot(x + 0.5 - r, y + 0.5 - r) + 0.5)));
      } else if (shape === "layer") {
        alpha = Math.round(255 * cover);
        ink = 1;
      }
      const at = row + 1 + x * 4;
      for (let c = 0; c < 3; c++) rows[at + c] = Math.round(INK[c] + (TAN[c] - INK[c]) * ink);
      rows[at + 3] = alpha;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const webos = new URL("../webos/", import.meta.url);
writeFileSync(new URL("icon.png", webos), png(80));
writeFileSync(new URL("largeIcon.png", webos), png(130));

// Android: launcher icon 48 dp, adaptive layer 108 dp, at each density.
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [name, k] of Object.entries(DENSITIES)) {
  const dir = new URL(`../android/app/src/main/res/mipmap-${name}/`, import.meta.url);
  writeFileSync(new URL("ic_launcher.png", dir), png(48 * k, "square"));
  writeFileSync(new URL("ic_launcher_round.png", dir), png(48 * k, "round"));
  writeFileSync(new URL("ic_launcher_foreground.png", dir), png(108 * k, "layer"));
}
console.log("wrote webos icons and android mipmaps");
