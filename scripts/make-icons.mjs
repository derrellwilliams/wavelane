// Draws the launcher icons (webos/icon.png 80×80, webos/largeIcon.png 130×130): the family's wave
// in tan on the near-black canvas. Placeholder until Wavelane has its own mark.
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

function png(size) {
  const margin = size * 0.14;
  const amplitude = size * 0.075;
  const half = size * 0.035; // half the stroke width
  const waves = 3;
  const k = (2 * Math.PI * waves) / (size - 2 * margin);
  const rows = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    for (let x = 0; x < size; x++) {
      // Distance to the nearest point of the curve, sampled along it (round caps for free).
      let nearest = Infinity;
      for (let cx = margin; cx <= size - margin; cx += 0.25) {
        const cy = size / 2 - amplitude * Math.sin((cx - margin) * k);
        nearest = Math.min(nearest, Math.hypot(x + 0.5 - cx, y + 0.5 - cy));
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
