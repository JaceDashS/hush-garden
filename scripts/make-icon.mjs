// Draws assets/icon.png (the smiling speaker) without any image library, so the icon is reproducible from code.
// Run: node scripts/make-icon.mjs
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const SIZE = 1024;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pixels = new Uint8Array(SIZE * SIZE * 4);

const hex = (value) => [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16)];

/** Paints a shape given by a signed distance function (negative inside) with a one pixel soft edge. */
function paint(distance, color, opacity = 1) {
  const [r, g, b] = hex(color);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const coverage = Math.max(0, Math.min(1, 0.5 - distance(x + 0.5, y + 0.5))) * opacity;
      if (coverage <= 0) continue;
      const i = (y * SIZE + x) * 4;
      pixels[i] = pixels[i] * (1 - coverage) + r * coverage;
      pixels[i + 1] = pixels[i + 1] * (1 - coverage) + g * coverage;
      pixels[i + 2] = pixels[i + 2] * (1 - coverage) + b * coverage;
      pixels[i + 3] = 255;
    }
  }
}

const circle = (cx, cy, radius) => (x, y) => Math.hypot(x - cx, y - cy) - radius;
const ellipse = (cx, cy, rx, ry) => (x, y) => (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry);
const box = (cx, cy, halfWidth, halfHeight, radius) => (x, y) => {
  const dx = Math.abs(x - cx) - halfWidth + radius;
  const dy = Math.abs(y - cy) - halfHeight + radius;
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - radius;
};
/** The lower half of a ring: a smile. */
const smile = (cx, cy, radius, width) => (x, y) => Math.max(Math.abs(Math.hypot(x - cx, y - cy) - radius) - width / 2, cy - y);

const INK = "#4a4038";
paint(() => -1, "#dff3ea");
paint(circle(512, 540, 400), "#bfe8b0");
paint(box(512, 512, 250, 370, 110), INK);
paint(box(512, 512, 226, 346, 90), "#d9a877");
paint(circle(512, 330, 92), INK);
paint(circle(512, 330, 72), "#fffaf2");
paint(circle(512, 330, 32), INK);
paint(circle(512, 600, 150), INK);
paint(circle(512, 600, 130), "#fffaf2");
paint(circle(458, 575, 20), INK);
paint(circle(566, 575, 20), INK);
paint(smile(512, 615, 42, 16), INK);
paint(ellipse(420, 628, 30, 19), "#ff9eb5");
paint(ellipse(604, 628, 30, 19), "#ff9eb5");

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(body) >>> 0);
  return Buffer.concat([length, body, crc]);
}

const header = Buffer.alloc(13);
header.writeUInt32BE(SIZE, 0);
header.writeUInt32BE(SIZE, 4);
header.set([8, 6, 0, 0, 0], 8);
const rows = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) rows.set(pixels.subarray(y * SIZE * 4, (y + 1) * SIZE * 4), y * (SIZE * 4 + 1) + 1);
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", zlib.deflateSync(rows, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
fs.mkdirSync(path.join(root, "assets"), { recursive: true });
fs.writeFileSync(path.join(root, "assets", "icon.png"), png);
console.log("assets/icon.png written (" + png.length + " bytes)");
