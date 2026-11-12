// Draws the launcher icons (webos/icon.png 80×80, webos/largeIcon.png 130×130): the family's wave
// in tan on the near-black canvas, drawn like Wavetile's app icon. Placeholder until Wavelane has its own mark.
// Run: npm run icons
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

// The wave mark's own curve (the path in src/design/components/Mark.tsx and Wavetile's icon), as
// cubic segments on a 90 × 16 box, sampled into points once.
const CURVE = [
  [1, 7.9, 6, -1.3, 11, -1.3, 16, 7.9],
  [16, 7.9, 20.5, 15.3, 25.5, 15.3, 31, 7.9],
  [31, 7.9, 36, 0.5, 41, 0.5, 46, 7.9],
  [46, 7.9, 51.3, 16.1, 56.3, 16.1, 61, 7.9],
  [61, 7.9, 66, -0.3, 71, -0.3, 76, 7.9],
  [76, 7.9, 80.6, 14.9, 85.6, 14.9, 91, 7.9],
];
const STEPS = 400;
const POINTS = CURVE.flatMap(([x0, y0, x1, y1, x2, y2, x3, y3]) =>
  Array.from({ length: STEPS }, (_, i) => {
    const t = i / STEPS;
    const u = 1 - t;
    return [
      u ** 3 * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t ** 3 * x3,
      u ** 3 * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3 * y3,
    ];
  }),
);
POINTS.push([91, 7.9]);

// Same proportions as Wavetile's app icon: the wave fills 76% of the width and the line is
// about 1.8% of the icon (a thin line, not the favicon's heavy one).
const WIDTH = 0.76;
const STROKE = 0.0176;

function png(size) {
  const scale = (size * WIDTH) / 90;
  const left = (size - 90 * scale) / 2 - 1 * scale;
  const top = size / 2 - 7.9 * scale;
  const dots = POINTS.map(([x, y]) => [left + x * scale, top + y * scale]);
  const half = size * STROKE * 0.5;
  const rows = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    for (let x = 0; x < size; x++) {
      // Distance to the nearest point of the curve (round caps for free).
      let nearest = Infinity;
      for (const [cx, cy] of dots) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d < nearest) nearest = d;
      }
      const cover = Math.max(0, Math.min(1, half - nearest + 0.5));
      for (let c = 0; c < 3; c++) {
        rows[row + 1 + x * 3 + c] = Math.round(INK[c] + (TAN[c] - INK[c]) * cover);
      }
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const dir = new URL("../webos/", import.meta.url);
writeFileSync(new URL("icon.png", dir), png(80));
writeFileSync(new URL("largeIcon.png", dir), png(130));
console.log("wrote webos/icon.png and webos/largeIcon.png");
