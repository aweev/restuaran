/**
 * Generates the PWA icons referenced by public/manifest.json and app/layout.tsx.
 *
 *   node scripts/generate-icons.mjs
 *
 * A generator rather than committed binaries, so the mark stays reviewable in
 * diffs and can be re-derived if the brand colour changes.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(HERE, "..", "public", "icons");

const INK = [0x1d, 0x17, 0x12];
const GOLD = [0xc9, 0xa2, 0x27];
const LEAF = [0x6f, 0x8f, 0x4a];

/** CRC-32, required for every PNG chunk. */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([len, typeAndData, crc]);
}

/** Encode RGBA pixel data as a PNG buffer. */
function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  // One filter byte (0 = None) per scanline.
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Draw the mark by hand: a warm radial plate, a gold ring, and a fig leaf.
 * `inset` shrinks the artwork so the maskable variant keeps a safe zone.
 */
function drawIcon(size, { inset = 0 } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const artR = (size / 2) * (1 - inset);
  const ringR = artR * 0.78;
  const stemW = artR * 0.055;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);

      // Base: deep ink, lifting toward a warm centre.
      const warmth = clamp01(1 - d / (artR * 1.15)) ** 2;
      let r = INK[0] + (GOLD[0] - INK[0]) * warmth * 0.3;
      let g = INK[1] + (GOLD[1] - INK[1]) * warmth * 0.3;
      let b = INK[2] + (GOLD[2] - INK[2]) * warmth * 0.3;

      // Plate ring.
      const ringDelta = Math.abs(d - ringR);
      if (ringDelta < artR * 0.035) {
        const t = 1 - ringDelta / (artR * 0.035);
        r = r * (1 - t) + GOLD[0] * t;
        g = g * (1 - t) + GOLD[1] * t;
        b = b * (1 - t) + GOLD[2] * t;
      }

      // Fig leaf: two mirrored ellipse lobes about a short stem.
      const ly = dy + artR * 0.16;
      const lx = Math.abs(dx);
      const lobeA = (lx / (artR * 0.42)) ** 2 + (ly / (artR * 0.27)) ** 2;
      const lobeB = (lx / (artR * 0.34)) ** 2 + ((ly + artR * 0.2) / (artR * 0.2)) ** 2;
      if (lobeA < 1 || lobeB < 1) {
        const t = clamp01(1 - Math.min(lobeA, lobeB) * 0.6);
        r = r * (1 - t) + LEAF[0] * t;
        g = g * (1 - t) + LEAF[1] * t;
        b = b * (1 - t) + LEAF[2] * t;
      }
      if (ly > artR * 0.05 && ly < artR * 0.34 && lx < stemW) {
        r = GOLD[0];
        g = GOLD[1];
        b = GOLD[2];
      }

      rgba[i] = Math.round(r);
      rgba[i + 1] = Math.round(g);
      rgba[i + 2] = Math.round(b);
      rgba[i + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  ["icon-192x192.png", 192, {}],
  ["icon-512x512.png", 512, {}],
  // Maskable icons are cropped to a circle by some launchers, so the artwork is
  // pulled in to stay inside the safe zone.
  ["icon-maskable-512x512.png", 512, { inset: 0.2 }],
];

for (const [name, size, opts] of targets) {
  const buf = drawIcon(size, opts);
  writeFileSync(resolve(OUT_DIR, name), buf);
  console.log(`wrote icons/${name} (${size}x${size}, ${buf.length} bytes)`);
}
